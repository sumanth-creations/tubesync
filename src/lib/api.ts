import { supabase } from './supabase';
import type {
  YouTubeChannel, Video, UploadQueue, AIGeneration, VideoJob,
  UploadSchedule, Short, Analytics, Activity, AIContent, AppUser
} from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ============ Auth ============
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    created_at: user.created_at || '',
    avatar_url: user.user_metadata?.avatar_url,
    full_name: user.user_metadata?.full_name,
  };
}

// ============ YouTube Channels ============
export async function getYouTubeChannels(): Promise<YouTubeChannel[]> {
  const { data, error } = await supabase.from('youtube_channels').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getYouTubeConnectUrl(): Promise<{ authUrl: string; state: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth?action=connect`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to get connect URL');
  return response.json();
}

export async function handleYouTubeCallback(code: string): Promise<{ success: boolean; channel?: Partial<YouTubeChannel> }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/youtube-oauth?action=callback&code=${code}&user_id=${user.id}`,
    { headers: getAuthHeaders() }
  );

  if (!response.ok) throw new Error('Failed to connect YouTube');
  return response.json();
}

export async function getYouTubeStatus(): Promise<{ connected: boolean; channels: YouTubeChannel[] }> {
  const channels = await getYouTubeChannels();
  return { connected: channels.length > 0, channels };
}

export async function disconnectYouTube(channelId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'disconnect', channelId }),
  });
  if (!response.ok) throw new Error('Failed to disconnect');
}

export async function refreshYouTubeToken(channelId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'refresh', channelId }),
  });
  if (!response.ok) throw new Error('Failed to refresh token');
}

// ============ Videos ============
export async function createVideo(video: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase.from('videos').insert({
    ...video,
    status: video.status || 'draft',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateVideo(id: string, updates: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase
    .from('videos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getVideos(limit = 100, status?: string): Promise<Video[]> {
  let query = supabase.from('videos').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data || [];
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;
}

export async function getScheduledVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .not('scheduled_publish_at', 'is', null)
    .order('scheduled_publish_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ============ Upload Queue ============
export async function getUploadQueue(): Promise<UploadQueue[]> {
  const { data, error } = await supabase
    .from('upload_queue')
    .select('*, videos(*)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function queueForUpload(videoId: string, priority = 0): Promise<UploadQueue> {
  const { data, error } = await supabase
    .from('upload_queue')
    .insert({ video_id: videoId, priority })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Uploads a video file to Supabase Storage under the current user's folder
// and records the path on the video row. Returns the storage path.
export async function uploadVideoFile(
  videoId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${user.id}/${videoId}/${Date.now()}_${safeName}`;

  // Supabase JS storage upload doesn't expose progress natively in v2,
  // so we report a simple start/finish signal to the caller.
  onProgress?.(0);
  const { error: uploadError } = await supabase.storage
    .from('video-files')
    .upload(path, file, { upsert: true, contentType: file.type || 'video/mp4' });
  if (uploadError) throw uploadError;
  onProgress?.(100);

  const { error: updateError } = await supabase
    .from('videos')
    .update({ file_path: path, status: 'ready' })
    .eq('id', videoId);
  if (updateError) throw updateError;

  return path;
}

// Queues the video for upload AND immediately invokes the youtube-upload
// edge function to process it (rather than waiting for a poller).
export async function pushVideoToYouTube(videoId: string, youtubeChannelId: string): Promise<void> {
  await queueForUpload(videoId);
  await supabase.from('videos').update({ status: 'queued', youtube_channel_id: youtubeChannelId }).eq('id', videoId);

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to start YouTube upload');
  }
}

export async function retryUpload(videoId: string): Promise<void> {
  await supabase.from('videos').update({ status: 'queued', retry_count: 0, error_message: null }).eq('id', videoId);
  await supabase.from('upload_queue').delete().eq('video_id', videoId);
  await queueForUpload(videoId);
}

// ============ AI Generation ============
export async function generateAIContent(title: string, format: 'short' | 'medium' | 'long' = 'short'): Promise<AIContent> {
  await new Promise(resolve => setTimeout(resolve, 1200));

  const shortPrompts = [
    `${title} - You Won't Believe What Happens Next!`,
    `POV: ${title} in 60 Seconds`,
    `${title} - The SECRET Nobody Tells You (#shorts)`,
    `This ${title} Hack Changed Everything!`,
    `Wait for it... ${title} Reaction!`,
  ];

  const longPrompts = [
    `The Complete Guide to ${title} - Everything You Need to Know`,
    `How ${title} Changed My Life - Full Story`,
    `${title} Masterclass: From Beginner to Expert`,
    `5 ${title} Secrets That Will Blow Your Mind`,
    `The Truth About ${title} - No One Talks About This`,
  ];

  const descs = [
    `${title} - In this comprehensive video, I show you everything you need to know! Don't forget to like, comment, and subscribe for more content!`,
    `Want to learn ${title}? This is the only video you'll ever need. I break down everything step by step. Timestamps coming soon!`,
    `Here's my complete walkthrough of ${title}. Whether you're a beginner or advanced, there's something for everyone. Drop a comment!`,
  ];

  const tags = [title.toLowerCase().split(' ')[0], 'tutorial', 'howto', 'guide', '2024', 'education', 'tips'];
  const hashtags = [`#${title.replace(/\s+/g, '')}`, '#2024', '#tutorial', '#viral', '#fyp', '#trending'];
  const seo = [`${title} tutorial`, `${title} guide`, `${title} tips`, `${title} 2024`, `best ${title}`, `learn ${title}`];
  const thumbnails = [
    `Bright background with bold "${title.split(' ').slice(0, 3).join(' ')}" text, surprised face expression`,
    `Split-screen before/after with "${title}" as main heading`,
    `Close-up face with text overlay: "The TRUTH About ${title}"`,
    `Minimalist design with gradient background and centered title`,
    `Dramatic before/after transformation with arrow pointing to result`,
  ];
  const scripts = [
    `Hook: "You won't believe what I discovered about ${title}..."\nProblem: "Most people get ${title} completely wrong."\nSolution: "Here's the exact method that works..."\nCTA: "Subscribe for more ${title} secrets!"`,
    `Hook: "Stop doing ${title} the wrong way!"\nStory: "I spent 3 years figuring this out..."\nValue: "The 3-step process I wish I knew..."\nCTA: "Like this video if it helped you!"`,
  ];
  const ideas = [
    `${title} Challenge - Try This for 30 Days`,
    `Reacting to ${title} Gone Wrong`,
    `Before vs After: ${title} Transformation`,
    `${title} Myths Debunked`,
    `The ${title} Routine That Got Me Results`,
  ];
  const topics = [
    `trending: ${title} hacks`,
    `viral: ${title} challenge`,
    `hot: ${title} tutorial`,
    `rising: ${title} tips 2024`,
    `viral: ${title} reaction`,
  ];

  return {
    titles: format === 'short' ? shortPrompts : longPrompts,
    descriptions: descs,
    tags,
    hashtags,
    seo_keywords: seo,
    thumbnail_ideas: thumbnails,
    scripts,
    video_ideas: ideas,
    trending_topics: topics,
    viral_scores: [92, 88, 85, 79, 73],
  };
}

export async function saveAIGeneration(generation: Partial<AIGeneration>): Promise<AIGeneration> {
  const { data, error } = await supabase.from('ai_generations').insert(generation).select().single();
  if (error) throw error;
  return data;
}

export async function getAIGenerations(type?: string): Promise<AIGeneration[]> {
  let query = supabase.from('ai_generations').select('*').order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============ Video Jobs ============
export async function getVideoJobs(videoId?: string): Promise<VideoJob[]> {
  let query = supabase.from('video_jobs').select('*').order('created_at', { ascending: false });
  if (videoId) query = query.eq('video_id', videoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============ Shorts ============
export async function getShorts(): Promise<Short[]> {
  const { data, error } = await supabase.from('shorts').select('*, videos(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function generateShorts(sourceVideoId: string, count: number): Promise<Short[]> {
  const { data: sourceVideo } = await supabase.from('videos').select('*').eq('id', sourceVideoId).single();
  if (!sourceVideo) throw new Error('Source video not found');

  const shorts: Short[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * 60;
    const end = start + 60;
    const { data: short } = await supabase.from('shorts').insert({
      source_video_id: sourceVideoId,
      title: `${sourceVideo.title} - Short ${i + 1}`,
      description: sourceVideo.description,
      start_time: start,
      end_time: end,
      duration: 60,
      viral_score: Math.floor(Math.random() * 30) + 70,
      captions: [`Hook ${i + 1}`, `Climax ${i + 1}`, `CTA ${i + 1}`],
      thumbnail_text: `${sourceVideo.title.split(' ').slice(0, 3).join(' ')} Part ${i + 1}`,
      status: 'ready',
    }).select().single();
    if (short) shorts.push(short);
  }
  return shorts;
}

// ============ Upload Schedules ============
export async function getUploadSchedules(): Promise<UploadSchedule[]> {
  const { data, error } = await supabase.from('upload_schedules').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createUploadSchedule(schedule: Partial<UploadSchedule>): Promise<UploadSchedule> {
  const { data, error } = await supabase.from('upload_schedules').insert(schedule).select().single();
  if (error) throw error;
  return data;
}

export async function updateUploadSchedule(id: string, updates: Partial<UploadSchedule>): Promise<UploadSchedule> {
  const { data, error } = await supabase.from('upload_schedules').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUploadSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('upload_schedules').delete().eq('id', id);
  if (error) throw error;
}

// ============ Analytics ============
export async function getAnalytics(): Promise<Analytics[]> {
  const { data, error } = await supabase.from('analytics').select('*').order('date', { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}

// ============ Activities ============
export async function getActivities(limit = 50): Promise<Activity[]> {
  const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function logActivity(activity: Partial<Activity>): Promise<Activity> {
  const { data, error } = await supabase.from('activities').insert(activity).select().single();
  if (error) throw error;
  return data;
}

// ============ Dashboard Stats ============
export async function getDashboardStats(): Promise<{
  totalVideos: number;
  uploadedCount: number;
  pendingCount: number;
  failedCount: number;
  scheduledCount: number;
  channelCount: number;
  recentActivity: Activity[];
}> {
  const [videos, channels, activities] = await Promise.all([
    getVideos(1000),
    getYouTubeChannels(),
    getActivities(10),
  ]);

  const uploaded = videos.filter(v => v.status === 'uploaded').length;
  const pending = videos.filter(v => ['queued', 'uploading', 'generating'].includes(v.status)).length;
  const failed = videos.filter(v => v.status === 'failed').length;
  const scheduled = videos.filter(v => v.status === 'scheduled' || v.scheduled_publish_at).length;

  return {
    totalVideos: videos.length,
    uploadedCount: uploaded,
    pendingCount: pending,
    failedCount: failed,
    scheduledCount: scheduled,
    channelCount: channels.length,
    recentActivity: activities,
  };
}
