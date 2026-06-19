import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase configuration in environment');
}

async function supabaseQuery(table: string, method: string, body?: unknown, filter?: string, preferReturn?: string) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (filter) url += `?${filter}`;
  const headers: Record<string,string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (preferReturn) headers['Prefer'] = preferReturn;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function getSignedUrl(bucket: string, path: string, expires = 3600) {
  const url = `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeURIComponent(path)}?expires=${expires}`;
  const res = await fetch(url, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
  if (!res.ok) throw new Error(`Failed to get signed URL: ${await res.text()}`);
  return (await res.json()).signedURL || (await res.json()).signedUrl || (await res.json()).signed_url;
}

async function refreshAccessToken(channel: any) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Missing Google OAuth client secrets');
  const refreshToken = channel.refresh_token;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!resp.ok) throw new Error('Token refresh failed');
  const data = await resp.json();
  const newAccessToken = data.access_token;
  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await supabaseQuery('youtube_channels', 'PATCH', { access_token: newAccessToken, token_expires_at: newExpiresAt, updated_at: new Date().toISOString() }, `id=eq.${channel.id}`);
  return { access_token: newAccessToken, token_expires_at: newExpiresAt };
}

async function claimJob(jobId: string) {
  // Attempt to atomically claim a queued job by changing status from 'queued' to 'uploading'
  const body = { status: 'uploading', started_at: new Date().toISOString() };
  const res = await supabaseQuery('upload_queue', 'PATCH', body, `id=eq.${jobId}&status=eq.queued`, 'return=representation');
  if (!res.ok) return null;
  const items = await res.json();
  return items[0];
}

async function processJob(job: any) {
  try {
    // Load video record
    const vRes = await supabaseQuery('videos', 'GET', undefined, `id=eq.${job.video_id}`);
    if (!vRes.ok) throw new Error('Failed to fetch video');
    const videos = await vRes.json();
    const video = videos[0];
    if (!video) throw new Error('Video not found');

    if (video.youtube_video_id) {
      // Already uploaded — mark job completed
      await supabaseQuery('upload_queue', 'PATCH', { status: 'completed', completed_at: new Date().toISOString(), progress: 100 }, `id=eq.${job.id}`);
      return { skipped: true };
    }

    if (!video.file_path) throw new Error('Video has no file_path');

    // Load channel
    const cRes = await supabaseQuery('youtube_channels', 'GET', undefined, `id=eq.${video.youtube_channel_id}`);
    if (!cRes.ok) throw new Error('Failed to load youtube channel');
    const channels = await cRes.json();
    const channel = channels[0];
    if (!channel) throw new Error('YouTube channel not found for this video');

    // Refresh token if expired/close to expiry
    const now = new Date();
    if (!channel.access_token || !channel.token_expires_at || new Date(channel.token_expires_at).getTime() - now.getTime() < 60_000) {
      const refreshed = await refreshAccessToken(channel);
      channel.access_token = refreshed.access_token;
      channel.token_expires_at = refreshed.token_expires_at;
    }

    // Get signed URL from Supabase storage
    const signed = await getSignedUrl('video-files', video.file_path);
    const fileResp = await fetch(signed);
    if (!fileResp.ok) throw new Error('Failed to download video from storage');
    const arrayBuffer = await fileResp.arrayBuffer();
    const contentLength = arrayBuffer.byteLength;

    // Initiate YouTube resumable upload
    const metadata = {
      snippet: {
        title: video.title || 'Untitled',
        description: video.description || '',
        tags: video.tags || [],
      },
      status: {
        privacyStatus: video.privacy_status || 'private',
        scheduledStartTime: video.scheduled_publish_at || undefined,
      },
    };

    const initResp = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channel.access_token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(contentLength),
        'X-Upload-Content-Type': 'application/octet-stream',
      },
      body: JSON.stringify(metadata),
    });

    if (!initResp.ok) {
      const text = await initResp.text();
      throw new Error(`Failed to initiate YouTube upload: ${text}`);
    }

    const uploadUrl = initResp.headers.get('Location') || initResp.headers.get('location');
    if (!uploadUrl) throw new Error('No upload Location returned from YouTube');

    // Upload file data in one request (simple approach)
    const putResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(contentLength),
      },
      body: arrayBuffer,
    });

    if (!putResp.ok) {
      const t = await putResp.text();
      throw new Error(`YouTube upload failed: ${t}`);
    }

    const result = await putResp.json();
    const youtubeId = result.id || result.videoId || result.resource?.id;
    if (!youtubeId) throw new Error('YouTube did not return video id');

    // Update videos and queue
    await supabaseQuery('videos', 'PATCH', { youtube_video_id: youtubeId, status: 'uploaded', progress: 100, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }, `id=eq.${video.id}`);
    await supabaseQuery('upload_queue', 'PATCH', { status: 'completed', completed_at: new Date().toISOString(), progress: 100 }, `id=eq.${job.id}`);

    // Log job
    await supabaseQuery('video_jobs', 'POST', { user_id: job.user_id, video_id: video.id, job_type: 'upload', status: 'completed', progress: 100, result_data: { youtube_video_id: youtubeId }, created_at: new Date().toISOString() });
    await supabaseQuery('activities', 'POST', { user_id: job.user_id, type: 'video_uploaded', title: video.title, video_id: video.id, metadata: { youtube_video_id: youtubeId }, created_at: new Date().toISOString() });

    return { success: true, youtubeId };

  } catch (err) {
    console.error('Job failed', err);
    // Increment retry_count and set status accordingly
    try {
      const qRes = await supabaseQuery('upload_queue', 'GET', undefined, `id=eq.${job.id}`);
      const rows = qRes.ok ? await qRes.json() : [];
      const current = rows[0] || { retry_count: 0 };
      const newRetry = (current.retry_count || 0) + 1;
      const newStatus = newRetry >= 3 ? 'failed' : 'queued';
      await supabaseQuery('upload_queue', 'PATCH', { retry_count: newRetry, status: newStatus, error_message: String(err.message || err), updated_at: new Date().toISOString() }, `id=eq.${job.id}`);
      await supabaseQuery('video_jobs', 'POST', { user_id: job.user_id, video_id: job.video_id, job_type: 'upload', status: 'failed', error_message: String(err.message || err), retry_count: newRetry, created_at: new Date().toISOString() });
    } catch (e) {
      console.error('Failed to update retry info', e);
    }

    return { success: false, error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    // Basic endpoint: POST to trigger a single run; GET returns status
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, message: 'youtube-upload-worker ready' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST: process up to N queued jobs
    const body = req.headers.get('Content-Type')?.includes('application/json') ? await req.json().catch(() => ({})) : {};
    const limit = body.limit || 5;

    // Fetch candidate jobs
    const listRes = await supabaseQuery('upload_queue', 'GET', undefined, `status=eq.queued&order=priority.desc,created_at.asc&limit=${limit}`);
    if (!listRes.ok) throw new Error('Failed to list queue');
    const candidates = await listRes.json();

    const results: any[] = [];
    for (const c of candidates) {
      // Try to atomically claim
      const claimed = await claimJob(c.id);
      if (!claimed) continue; // another worker claimed it
      const res = await processJob(claimed);
      results.push({ id: claimed.id, result: res });
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Worker error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
