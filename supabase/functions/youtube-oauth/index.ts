import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Google OAuth credentials — must be set as Supabase Edge Function secrets.
// NEVER hardcode these. Set them with:
//   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=...
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI');

function missingConfigResponse() {
  return new Response(JSON.stringify({
    error: 'Server is not configured for YouTube OAuth. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set as Supabase secrets.',
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface YouTubeChannelResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
    };
    statistics: {
      subscriberCount: string;
      videoCount: string;
      viewCount: string;
    };
  }>;
}

async function getYouTubeChannel(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error('Failed to fetch YouTube channel');
  const data = await response.json() as YouTubeChannelResponse;
  return data.items?.[0];
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
      ...(method === 'PATCH' ? { 'Prefer': 'return=minimal' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return missingConfigResponse();
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    let body: Record<string, unknown> = {};

    // Support both GET query params and POST JSON body
    if (req.method === 'POST') {
      try {
        body = await req.json();
        if (!action) action = body.action as string;
      } catch {
        // No body
      }
    }

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /youtube-oauth?action=connect
    if (action === 'connect') {
      const state = crypto.randomUUID();

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube',
        state,
        access_type: 'offline',
        prompt: 'consent',
      }).toString();

      return new Response(JSON.stringify({ authUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /youtube-oauth?action=callback&code=...&user_id=...
    if (action === 'callback') {
      const code = url.searchParams.get('code') || body.code as string;
      const userId = url.searchParams.get('user_id') || body.userId as string;
      if (!code || !userId) {
        return new Response(JSON.stringify({ error: 'Missing code or user_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
          code,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        return new Response(JSON.stringify({ error: 'Token exchange failed', details: errorText }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Get channel info
      const channel = await getYouTubeChannel(accessToken);
      if (!channel) {
        return new Response(JSON.stringify({ error: 'No YouTube channel found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store in database
      const channelData = {
        user_id: userId,
        youtube_channel_id: channel.id,
        channel_title: channel.snippet.title,
        channel_thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url,
        subscriber_count: parseInt(channel.statistics.subscriberCount || '0'),
        video_count: parseInt(channel.statistics.videoCount || '0'),
        view_count: parseInt(channel.statistics.viewCount || '0'),
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
      };

      await supabaseQuery('youtube_channels', 'POST', channelData);

      return new Response(JSON.stringify({
        success: true,
        channel: {
          id: channel.id,
          channel_title: channel.snippet.title,
          channel_thumbnail: channel.snippet.thumbnails?.medium?.url,
          subscriber_count: parseInt(channel.statistics.subscriberCount || '0'),
          video_count: parseInt(channel.statistics.videoCount || '0'),
          view_count: parseInt(channel.statistics.viewCount || '0'),
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /youtube-oauth?action=status&user_id=...
    if (action === 'status') {
      const userId = url.searchParams.get('user_id') || body.userId as string;
      if (!userId) {
        return new Response(JSON.stringify({ connected: false, channels: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await supabaseQuery('youtube_channels', 'GET', undefined, `user_id=eq.${userId}`);
      const channels = response.ok ? await response.json() : [];

      return new Response(JSON.stringify({
        connected: channels.length > 0,
        channels: channels || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /youtube-oauth (refresh)
    if (action === 'refresh') {
      const channelId = body.channelId as string;

      const response = await supabaseQuery('youtube_channels', 'GET', undefined, `id=eq.${channelId}`);
      const channels = response.ok ? await response.json() : [];
      const channel = channels[0];

      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenData = await refreshResponse.json();
      const newAccessToken = tokenData.access_token;
      const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      await supabaseQuery('youtube_channels', 'PATCH', {
        access_token: newAccessToken,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }, `id=eq.${channelId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /youtube-oauth (disconnect)
    if (action === 'disconnect') {
      const channelId = body.channelId as string;
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'Missing channelId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabaseQuery('youtube_channels', 'DELETE', undefined, `id=eq.${channelId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('YouTube OAuth error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
