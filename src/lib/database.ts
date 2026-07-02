import { supabase } from './supabase';

export interface Video {
  id: string;
  user_id: string;
  youtube_url: string;
  title: string;
  hook_text?: string;
  hook_context?: string;
  hook_start_time?: string;
  script: string;
  channel_id?: string;
  thumbnail_url?: string;
  duration?: number;
  status: 'draft' | 'rendering' | 'scheduled' | 'posted';
  scheduled_time?: string;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  user_id: string;
  channel_name: string;
  youtube_channel_id: string;
  access_token?: string;
  refresh_token?: string;
  created_at: string;
}

export async function getVideos(): Promise<Video[]> {
  const { data, error } = await supabase
  .from('videos')
  .select('*')
  .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createVideo(video: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase
  .from('videos')
  .insert([video])
  .select()
  .single();
  
  if (error) throw error;
  return data;
}

export async function updateVideo(id: string, updates: Partial<Video>): Promise<Video> {
  const { data, error } = await supabase
  .from('videos')
  .update(updates)
  .eq('id', id)
  .select()
  .single();
  
  if (error) throw error;
  return data;
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase
  .from('videos')
  .delete()
  .eq('id', id);
  
  if (error) throw error;
}

export async function getChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
  .from('channels')
  .select('*')
  .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createChannel(channel: Partial<Channel>): Promise<Channel> {
  const { data, error } = await supabase
  .from('channels')
  .insert([channel])
  .select()
  .single();
  
  if (error) throw error;
  return data;
}
export interface Video {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  script?: string;
  status: 'draft' | 'rendering' | 'scheduled' | 'posted' | 'failed' | 'uploaded' | 'generating';
  thumbnail_url?: string;
  youtube_video_id?: string;
  scheduled_publish_at?: string;
  progress?: number;
  error_message?: string;
  is_short?: boolean;
  video_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AppUser { id: string; email: string; created_at: string; }
export interface YouTubeChannel { id: string; channel_id: string; title: string; }
export interface Activity { id: string; type: string; created_at: string; }
export interface Short { id: string; title: string; video_id: string; }
export interface UploadQueue extends Video {}
export interface AIGeneration { id: string }
export interface VideoJob { id: string }
export interface UploadSchedule { id: string }
export interface Analytics { id: string }
export interface AIContent { id: string }