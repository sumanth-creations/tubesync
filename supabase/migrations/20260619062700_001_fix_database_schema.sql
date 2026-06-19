/*
# Fix Database Schema for YouTube Automation Platform

1. New Tables
- `youtube_channels`: Stores connected YouTube channel info with OAuth tokens
- `activities`: Activity log for user actions
- `ai_generations`: AI-generated content storage
- `upload_queue`: Video upload queue management
- `video_jobs`: Background job tracking for video processing
- `analytics`: Channel analytics data

2. Modified Tables
- `videos`: Add missing columns (category_id, file_path, thumbnail_file_path, youtube_video_url, published_at, retry_count, viral_score, seo_score, updated_at)

3. Security
- Enable RLS on all new tables
- Add owner-scoped policies using auth.uid()
- All user_id columns default to auth.uid()

4. Important Notes
- This is idempotent - uses IF NOT EXISTS / IF EXISTS
- Preserves existing data
- Adds indexes for performance
*/

-- ============================================
-- YOUTUBE CHANNELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  youtube_channel_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  channel_thumbnail TEXT,
  subscriber_count BIGINT DEFAULT 0,
  video_count BIGINT DEFAULT 0,
  view_count BIGINT DEFAULT 0,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_channels" ON youtube_channels;
CREATE POLICY "select_own_channels" ON youtube_channels FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_channels" ON youtube_channels;
CREATE POLICY "insert_own_channels" ON youtube_channels FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_channels" ON youtube_channels;
CREATE POLICY "update_own_channels" ON youtube_channels FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_channels" ON youtube_channels;
CREATE POLICY "delete_own_channels" ON youtube_channels FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_user ON youtube_channels(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_youtube_channels_yt_id ON youtube_channels(youtube_channel_id);

-- ============================================
-- ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  type TEXT NOT NULL CHECK (type IN ('video_created', 'video_uploaded', 'video_scheduled', 'video_failed', 'channel_connected', 'ai_generated', 'shorts_created', 'upload_queued')),
  title TEXT NOT NULL,
  description TEXT,
  video_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activities" ON activities;
CREATE POLICY "select_own_activities" ON activities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_activities" ON activities;
CREATE POLICY "insert_own_activities" ON activities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_activities" ON activities;
CREATE POLICY "delete_own_activities" ON activities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activities_user_created ON activities(user_id, created_at DESC);

-- ============================================
-- AI GENERATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID,
  type TEXT NOT NULL CHECK (type IN ('title', 'description', 'tags', 'thumbnail_idea', 'script', 'hashtags', 'seo_keywords', 'video_idea', 'trending_topic')),
  content TEXT NOT NULL,
  score INTEGER,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai" ON ai_generations;
CREATE POLICY "select_own_ai" ON ai_generations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ai" ON ai_generations;
CREATE POLICY "insert_own_ai" ON ai_generations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ai" ON ai_generations;
CREATE POLICY "delete_own_ai" ON ai_generations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- UPLOAD QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'uploading', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_queue" ON upload_queue;
CREATE POLICY "select_own_queue" ON upload_queue FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_queue" ON upload_queue;
CREATE POLICY "insert_own_queue" ON upload_queue FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_queue" ON upload_queue;
CREATE POLICY "update_own_queue" ON upload_queue FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_queue" ON upload_queue;
CREATE POLICY "delete_own_queue" ON upload_queue FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_upload_queue_user_status ON upload_queue(user_id, status);

-- ============================================
-- VIDEO JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('generate', 'upload', 'process', 'shorts', 'caption')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  result_data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_jobs" ON video_jobs;
CREATE POLICY "select_own_jobs" ON video_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_jobs" ON video_jobs;
CREATE POLICY "insert_own_jobs" ON video_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_jobs" ON video_jobs;
CREATE POLICY "update_own_jobs" ON video_jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_jobs" ON video_jobs;
CREATE POLICY "delete_own_jobs" ON video_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_status ON video_jobs(user_id, status);

-- ============================================
-- ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  youtube_channel_id TEXT,
  date DATE NOT NULL,
  views BIGINT DEFAULT 0,
  subscribers_gained INTEGER DEFAULT 0,
  subscribers_lost INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  watch_time_minutes INTEGER DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  click_through_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analytics" ON analytics;
CREATE POLICY "select_own_analytics" ON analytics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_analytics" ON analytics;
CREATE POLICY "insert_own_analytics" ON analytics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics(user_id, date DESC);

-- ============================================
-- UPDATE VIDEOS TABLE (add missing columns)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'category_id') THEN
    ALTER TABLE videos ADD COLUMN category_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'file_path') THEN
    ALTER TABLE videos ADD COLUMN file_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'thumbnail_file_path') THEN
    ALTER TABLE videos ADD COLUMN thumbnail_file_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'youtube_video_url') THEN
    ALTER TABLE videos ADD COLUMN youtube_video_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'published_at') THEN
    ALTER TABLE videos ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'retry_count') THEN
    ALTER TABLE videos ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'viral_score') THEN
    ALTER TABLE videos ADD COLUMN viral_score INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'seo_score') THEN
    ALTER TABLE videos ADD COLUMN seo_score INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'updated_at') THEN
    ALTER TABLE videos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Update videos RLS policies to ensure proper ownership
DROP POLICY IF EXISTS "select_own_videos" ON videos;
CREATE POLICY "select_own_videos" ON videos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_videos" ON videos;
CREATE POLICY "insert_own_videos" ON videos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_videos" ON videos;
CREATE POLICY "update_own_videos" ON videos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_videos" ON videos;
CREATE POLICY "delete_own_videos" ON videos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_videos_user_status ON videos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_videos_scheduled ON videos(scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL;