export interface YouTubeChannel {
  id: string;
  user_id: string;
  youtube_channel_id: string;
  channel_title: string;
  channel_thumbnail: string | null;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  youtube_channel_id: string | null;
  title: string;
  description: string | null;
  tags: string[];
  hashtags: string[];
  privacy_status: 'public' | 'unlisted' | 'private';
  category_id: string | null;
  status: 'draft' | 'ready' | 'queued' | 'generating' | 'uploading' | 'uploaded' | 'failed' | 'scheduled';
  is_short: boolean;
  file_path: string | null;
  thumbnail_file_path: string | null;
  thumbnail_url: string | null;
  youtube_video_id: string | null;
  youtube_video_url: string | null;
  duration: number | null;
  scheduled_publish_at: string | null;
  published_at: string | null;
  progress: number;
  error_message: string | null;
  retry_count: number;
  viral_score: number | null;
  seo_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface UploadQueue {
  id: string;
  user_id: string;
  video_id: string | null;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  priority: number;
  progress: number;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AIGeneration {
  id: string;
  user_id: string;
  video_id: string | null;
  type: 'title' | 'description' | 'tags' | 'thumbnail_idea' | 'script' | 'hashtags' | 'seo_keywords' | 'video_idea' | 'trending_topic';
  content: string;
  score: number | null;
  used: boolean;
  created_at: string;
}

export interface VideoJob {
  id: string;
  user_id: string;
  video_id: string | null;
  job_type: 'generate' | 'upload' | 'process' | 'shorts' | 'caption';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface UploadSchedule {
  id: string;
  user_id: string;
  youtube_channel_id: string | null;
  name: string;
  frequency: 'daily' | 'every_2_days' | 'every_3_days' | 'weekly' | 'custom';
  custom_days: number[] | null;
  start_time: string;
  timezone: string;
  is_active: boolean;
  next_upload_at: string | null;
  videos_count: number;
  created_at: string;
  updated_at: string;
}

export interface Short {
  id: string;
  user_id: string;
  source_video_id: string | null;
  title: string;
  description: string | null;
  start_time: number | null;
  end_time: number | null;
  duration: number | null;
  viral_score: number | null;
  captions: string[] | null;
  thumbnail_text: string | null;
  status: 'pending' | 'generating' | 'ready' | 'uploaded' | 'failed';
  file_path: string | null;
  youtube_video_id: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Analytics {
  id: string;
  user_id: string;
  youtube_channel_id: string | null;
  date: string;
  views: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  watch_time_minutes: number;
  impressions: number;
  click_through_rate: number | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: 'video_created' | 'video_uploaded' | 'video_scheduled' | 'video_failed' | 'channel_connected' | 'ai_generated' | 'shorts_created' | 'upload_queued';
  title: string;
  description: string | null;
  video_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AIContent {
  titles: string[];
  descriptions: string[];
  tags: string[];
  hashtags: string[];
  seo_keywords: string[];
  thumbnail_ideas: string[];
  scripts: string[];
  video_ideas: string[];
  trending_topics: string[];
  viral_scores: number[];
}

export interface ChannelStats {
  subscriber_count: number;
  view_count: number;
  video_count: number;
  total_videos: number;
  uploaded_count: number;
  pending_count: number;
  failed_count: number;
  scheduled_count: number;
}

export interface AppUser {
  id: string;
  email: string;
  created_at: string;
  avatar_url?: string;
  full_name?: string;
}

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: Video;
        Insert: Partial<Video>;
        Update: Partial<Video>;
      };
      youtube_channels: {
        Row: YouTubeChannel;
        Insert: Partial<YouTubeChannel>;
        Update: Partial<YouTubeChannel>;
      };
      activities: {
        Row: Activity;
        Insert: Partial<Activity>;
        Update: Partial<Activity>;
      };
      upload_queue: {
        Row: UploadQueue;
        Insert: Partial<UploadQueue>;
        Update: Partial<UploadQueue>;
      };
      ai_generations: {
        Row: AIGeneration;
        Insert: Partial<AIGeneration>;
        Update: Partial<AIGeneration>;
      };
      video_jobs: {
        Row: VideoJob;
        Insert: Partial<VideoJob>;
        Update: Partial<VideoJob>;
      };
      analytics: {
        Row: Analytics;
        Insert: Partial<Analytics>;
        Update: Partial<Analytics>;
      };
      upload_schedules: {
        Row: UploadSchedule;
        Insert: Partial<UploadSchedule>;
        Update: Partial<UploadSchedule>;
      };
      shorts: {
        Row: Short;
        Insert: Partial<Short>;
        Update: Partial<Short>;
      };
    };
  };
}
