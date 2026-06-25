// supabase/functions/youtube-upload/index.ts
//
// Takes a videoId, reads the video metadata + file from Supabase Storage,
// and performs a real upload to YouTube via the resumable upload protocol,
// updating status/progress on the videos and upload_queue tables as it goes.
//
// NOTE ON LIMITS: Supabase Edge Functions run on Deno Deploy and have
// memory/time constraints. This works well for small-to-medium files
// (tested approach: stream the whole file in one resumable PUT). For very
// large files (multi-GB), a dedicated worker outside Edge Functions would
// be more reliable — this is a reasonable starting point for most creators.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

interface VideoRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  privacy_status: string;
  category_id: string | null;
  file_path: string | null;
  youtube_channel_id: string | null;
}

interface ChannelRow {
  id: string;
  user_id: string;
  youtube_channel_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}

async function supabaseQuery(table: string, method: string, body?: unknown, filter?: string) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (filter) url += `?${filter}`;
  const response = await fetch(url, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(method === 'PATCH' || method === 'POST' ? { 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

async function getValidAccessToken(channel: ChannelRow): Promise<string> {
  const expiresAt = new Date(channel.token_expires_at).getTime();
  const now = Date.now();

  // Refresh if expiring within the next 2 minutes
  if (expiresAt - now > 2 * 60 * 1000) {
    return channel.access_token;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured on server');
  }

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: channel.refresh_token,
    }).toString(),
  });

  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh YouTube access token. Please reconnect your channel.');
  }

  const tokenData = await refreshResponse.json();
  const newAccessToken = tokenData.access_token;
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabaseQuery('youtube_channels', 'PATCH', {
    access_token: newAccessToken,
    token_expires_at: newExpiresAt,
  }, `id=eq.${channel.id}`);

  return newAccessToken;
}

async function setVideoStatus(videoId: string, status: string, extra: Record<string, unknown> = {}) {
  await supabaseQuery('videos', 'PATCH', { status, updated_at: new Date().toISOString(), ...extra }, `id=eq.${videoId}`);
}

async function setQueueStatus(videoId: string, status: string, extra: Record<string, unknown> = {}) {
  await supabaseQuery('upload_queue', 'PATCH', { status, ...extra }, `video_id=eq.${videoId}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated (forwarded user JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userData = await userResp.json();
    const userId = userData.id;

    const { videoId } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Missing videoId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the video row and confirm ownership
    const videoResp = await supabaseQuery('videos', 'GET', undefined, `id=eq.${videoId}&user_id=eq.${userId}`);
    const videos: VideoRow[] = videoResp.ok ? await videoResp.json() : [];
    const video = videos[0];

    if (!video) {
      return new Response(JSON.stringify({ error: 'Video not found or not owned by you' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!video.file_path) {
      return new Response(JSON.stringify({ error: 'No video file uploaded for this video yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!video.youtube_channel_id) {
      return new Response(JSON.stringify({ error: 'No YouTube channel selected for this video' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the connected channel + tokens
    const channelResp = await supabaseQuery(
      'youtube_channels', 'GET', undefined,
      `youtube_channel_id=eq.${video.youtube_channel_id}&user_id=eq.${userId}`
    );
    const channels: ChannelRow[] = channelResp.ok ? await channelResp.json() : [];
    const channel = channels[0];
    if (!channel) {
      return new Response(JSON.stringify({ error: 'YouTube channel not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await setVideoStatus(videoId, 'uploading', { progress: 0 });
    await setQueueStatus(videoId, 'uploading', { started_at: new Date().toISOString() });

    const accessToken = await getValidAccessToken(channel);

    // Download the file from Supabase Storage (service role, so RLS doesn't block us)
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/video-files/${video.file_path}`;
    const fileResp = await fetch(fileUrl, {
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!fileResp.ok || !fileResp.body) {
      await setVideoStatus(videoId, 'failed', { error_message: 'Could not read video file from storage' });
      await setQueueStatus(videoId, 'failed', { error_message: 'Could not read video file from storage' });
      return new Response(JSON.stringify({ error: 'Could not read video file from storage' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileBlob = await fileResp.blob();
    const fileSize = fileBlob.size;
    const contentType = fileResp.headers.get('content-type') || 'video/mp4';

    // Step 1: Initiate a resumable upload session with YouTube
    const metadata = {
      snippet: {
        title: video.title.slice(0, 100),
        description: video.description || '',
        tags: video.tags || [],
        categoryId: video.category_id || '22',
      },
      status: {
        privacyStatus: video.privacy_status || 'private',
        selfDeclaredMadeForKids: false,
      },
    };

    const initResp = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(fileSize),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResp.ok) {
      const errText = await initResp.text();
      await setVideoStatus(videoId, 'failed', { error_message: `YouTube init failed: ${errText.slice(0, 500)}` });
      await setQueueStatus(videoId, 'failed', { error_message: 'YouTube init failed' });
      return new Response(JSON.stringify({ error: 'Failed to initiate YouTube upload', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadUrl = initResp.headers.get('Location');
    if (!uploadUrl) {
      await setVideoStatus(videoId, 'failed', { error_message: 'YouTube did not return an upload URL' });
      await setQueueStatus(videoId, 'failed', { error_message: 'No upload URL returned' });
      return new Response(JSON.stringify({ error: 'No upload URL returned by YouTube' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await setVideoStatus(videoId, 'uploading', { progress: 25 });

    // Step 2: Upload the file bytes in one PUT (suitable for small/medium files)
    const uploadResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
      },
      body: fileBlob,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      await setVideoStatus(videoId, 'failed', { error_message: `YouTube upload failed: ${errText.slice(0, 500)}` });
      await setQueueStatus(videoId, 'failed', { error_message: 'Upload failed' });
      return new Response(JSON.stringify({ error: 'YouTube upload failed', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadedVideo = await uploadResp.json();
    const youtubeVideoId = uploadedVideo.id;

    await setVideoStatus(videoId, 'uploaded', {
      progress: 100,
      youtube_video_id: youtubeVideoId,
      youtube_video_url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
      published_at: new Date().toISOString(),
    });
    await setQueueStatus(videoId, 'completed', { completed_at: new Date().toISOString(), progress: 100 });

    await supabaseQuery('activities', 'POST', {
      user_id: userId,
      type: 'video_uploaded',
      title: 'Video uploaded to YouTube',
      description: video.title,
      video_id: videoId,
      metadata: { youtube_video_id: youtubeVideoId },
    });

    return new Response(JSON.stringify({
      success: true,
      youtubeVideoId,
      youtubeVideoUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('YouTube upload error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
