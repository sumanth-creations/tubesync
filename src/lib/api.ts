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

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { full_name: fullName } },
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
  return { id: user.id, email: user.email || '', created_at: user.created_at || '', avatar_url: user.user_metadata?.avatar_url, full_name: user.user_metadata?.full_name };
}

export async function getYouTubeChannels(): Promise<YouTubeChannel[]> {
  const { data, error } = await supabase.from('youtube_channels').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getYouTubeConnectUrl(): Promise<{ authUrl: string; state: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth?action=connect`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to get connect URL');
  return response.json();
}

export async function handleYouTubeCallback(code: string): Promise<{ success: boolean; channel?: Partial<YouTubeChannel> }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth?action=callback&code=${code}&user_id=${user.id}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to connect YouTube');
  return response.json();
}

export async function getYouTubeStatus(): Promise<{ connected: boolean; channels: YouTubeChannel[] }> {
  const channels = await getYouTubeChannels();
  return { connected: channels.length > 0, channels };
}

export async function disconnectYouTube(channelId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'disconnect', channelId }) });
  if (!response.ok) throw new Error('Failed to disconnect');
}

export async function refreshYouTubeToken(channelId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'refresh', channelId }) });
  if (!response.ok) throw new Error('Failed to refresh token');
}

export async function createVideo(video: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase.from('videos').insert({ ...video, status: video.status || 'draft' }).select().single();
  if (error) throw error;
  return data;
}

export async function updateVideo(id: string, updates: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase.from('videos').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
  const { data, error } = await supabase.from('videos').select('*').not('scheduled_publish_at', 'is', null).order('scheduled_publish_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getUploadQueue(): Promise<UploadQueue[]> {
  const { data, error } = await supabase.from('upload_queue').select('*, videos(*)').order('priority', { ascending: false }).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function queueForUpload(videoId: string, priority = 0): Promise<UploadQueue> {
  const { data, error } = await supabase.from('upload_queue').insert({ video_id: videoId, priority }).select().single();
  if (error) throw error;
  return data;
}

export async function uploadVideoFile(videoId: string, file: File | Blob, onProgress?: (percent: number) => void, fileName = 'video.webm'): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const name = file instanceof File ? file.name : fileName;
  const type = file.type || 'video/mp4';
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${user.id}/${videoId}/${Date.now()}_${safeName}`;
  onProgress?.(0);
  const { error: uploadError } = await supabase.storage.from('video-files').upload(path, file, { upsert: true, contentType: type });
  if (uploadError) throw uploadError;
  onProgress?.(100);
  const { error: updateError } = await supabase.from('videos').update({ file_path: path, status: 'ready' }).eq('id', videoId);
  if (updateError) throw updateError;
  return path;
}

export async function pushVideoToYouTube(videoId: string, youtubeChannelId: string): Promise<void> {
  await queueForUpload(videoId);
  const { error: updateError } = await supabase.from('videos').update({ status: 'queued', youtube_channel_id: youtubeChannelId }).eq('id', videoId);
  if (updateError) throw updateError;
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-upload`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ videoId, youtubeChannelId }) });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'Failed to start YouTube upload'); }
}

export async function retryUpload(videoId: string): Promise<void> {
  await supabase.from('videos').update({ status: 'queued', retry_count: 0, error_message: null }).eq('id', videoId);
  await supabase.from('upload_queue').delete().eq('video_id', videoId);
  await queueForUpload(videoId);
}

export async function generateAIContent(title: string, format: 'short' | 'medium' | 'long' = 'short'): Promise<AIContent> {
  await new Promise(resolve => setTimeout(resolve, 1200));
  return { titles: [], descriptions: [], tags: [], hashtags: [], seo_keywords: [], thumbnail_ideas: [], scripts: [], video_ideas: [], trending_topics: [], viral_scores: [] };
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

export async function getVideoJobs(videoId?: string): Promise<VideoJob[]> {
  let query = supabase.from('video_jobs').select('*').order('created_at', { ascending: false });
  if (videoId) query = query.eq('video_id', videoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

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
    const start = i * 60; const end = start + 60;
    const { data: short } = await supabase.from('shorts').insert({ source_video_id: sourceVideoId, title: `${sourceVideo.title} - Short ${i + 1}`, description: sourceVideo.description, start_time: start, end_time: end, duration: 60, viral_score: 75, captions: [], thumbnail_text: 'Part', status: 'ready' }).select().single();
    if (short) shorts.push(short);
  }
  return shorts;
}

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

export async function getAnalytics(): Promise<Analytics[]> {
  const { data, error } = await supabase.from('analytics').select('*').order('date', { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}

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

export async function getDashboardStats(): Promise<any> {
  const [videos, channels, activities] = await Promise.all([getVideos(1000), getYouTubeChannels(), getActivities(10)]);
  return { totalVideos: videos.length, uploadedCount: 0, pendingCount: 0, failedCount: 0, scheduledCount: 0, channelCount: channels.length, recentActivity: activities };
}

export async function getUserSettings(): Promise<any> {
  const { data, error } = await supabase.from('user_settings').select('gemini_api_key, channel_niche').maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, gemini_api_key: apiKey, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function saveChannelNiche(niche: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, channel_niche: niche, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function callAiGenerate(mode: any, apiKey: string, params: any): Promise<any> { return {}; }

export async function generateAIContentReal(title: string, format: any = 'short'): Promise<AIContent> {
  const settings = await getUserSettings();
  const apiKey = settings?.gemini_api_key;
  if (!apiKey) throw new Error('NO_API_KEY');
  return callAiGenerate('content', apiKey, { title, format });
}

export async function generateVideoMetadata(fileName: string, niche?: string): Promise<any> {
  const settings = await getUserSettings();
  const apiKey = settings?.gemini_api_key;
  if (!apiKey) throw new Error('NO_API_KEY');
  return callAiGenerate('video_metadata', apiKey, { fileName, niche });
}

export function suggestBestPostTime(niche?: string): any { return {}; }

export interface FactsContent { title: string; facts: any[]; social_caption: string; youtube_description: string; image_search_queries: string[]; }

export async function scheduleAutoPublish(videoId: string, youtubeChannelId: string, scheduledFor: Date): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('scheduled_publishes').insert({ user_id: user.id, video_id: videoId, youtube_channel_id: youtubeChannelId, scheduled_for: scheduledFor.toISOString(), status: 'pending' });
  if (error) throw error;
  await supabase.from('videos').update({ status: 'scheduled', scheduled_publish_at: scheduledFor.toISOString() }).eq('id', videoId);
}

export async function generateFactsContent(keyword: string): Promise<FactsContent> {
  const settings = await getUserSettings();
  const apiKey = settings?.gemini_api_key;
  if (!apiKey) throw new Error('NO_API_KEY');
  return callAiGenerate('facts', apiKey, { keyword });
}

export async function chatWithAgent(message: string, history: any[]): Promise<string> {
  const settings = await getUserSettings();
  const apiKey = settings?.gemini_api_key;
  if (!apiKey) throw new Error('NO_API_KEY');
  const result = await callAiGenerate('chat', apiKey, { message, history });
  return result.reply;
}

export const getUserVideos = async (): Promise<Video[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
};

export const getChannelStats = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data: videos } = await supabase.from('videos').select('*').eq('user_id', user.id);
  const { count: channelCount } = await supabase.from('youtube_channels').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  return { totalViews: 0, avgViews: 0, subscribers: 0, channelCount: channelCount || 0, videoCount: videos?.length || 0, worstVideo: null, bestVideo: null };
};

export async function createShortsFromLink(youtube_url: string): Promise<Short[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  
  const { data, error } = await supabase.functions.invoke('yt-analyzer', { 
    body: { youtube_url },
    headers: { 'Authorization': `Bearer ${session.access_token}` }
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.shorts;
}

export async function getRenderQueue(): Promise<Short[]> {
  const { data, error } = await supabase.from('shorts').select('*').in('status', ['pending_render', 'rendering', 'ready', 'draft', 'pending']).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function triggerVideoRender(videoId: string): Promise<void> {
  const { error } = await supabase.from('shorts').update({ status: 'rendering' }).eq('id', videoId);
  if (error) throw error;
}

export async function approveAndUploadShort(shortId: string, youtubeChannelId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/channel-router`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ short_id: shortId, youtube_channel_id: youtubeChannelId }) });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'Failed to upload short'); }
}