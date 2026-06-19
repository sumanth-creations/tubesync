/*
# Initial Schema for TubeSync — YouTube Automation Platform

1. New Tables
- `videos`: Core table for video records (drafts, queued, uploaded, etc.)
- `upload_schedules`: Recurring upload schedule configs per channel
- `shorts`: AI-generated short clips derived from a source video

2. Security
- Enable RLS on all tables
- Owner-scoped policies using auth.uid()
- All user_id columns default to auth.uid()

3. Notes
- This is the base migration. Later migrations (002) extend these tables
  with additional columns (category_id, file_path, viral_score, etc.)
  using idempotent IF NOT EXISTS checks, so running 001 then 002 is safe.
- Uses CREATE TABLE IF NOT EXISTS so it is safe to re-run.
*/

-- ============================================
-- VIDEOS TABLE (core table — everything else references this)
-- ============================================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  youtube_channel_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  privacy_status TEXT NOT NULL DEFAULT 'private' CHECK (privacy_status IN ('public', 'unlisted', 'private')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'queued', 'generating', 'uploading', 'uploaded', 'failed', 'scheduled')),
  is_short BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  youtube_video_id TEXT,
  duration INTEGER,
  scheduled_publish_at TIMESTAMPTZ,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);

-- ============================================
-- UPLOAD SCHEDULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS upload_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  youtube_channel_id TEXT,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'every_2_days', 'every_3_days', 'weekly', 'custom')),
  custom_days INTEGER[],
  start_time TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  next_upload_at TIMESTAMPTZ,
  videos_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE upload_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_schedules" ON upload_schedules;
CREATE POLICY "select_own_schedules" ON upload_schedules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_schedules" ON upload_schedules;
CREATE POLICY "insert_own_schedules" ON upload_schedules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_schedules" ON upload_schedules;
CREATE POLICY "update_own_schedules" ON upload_schedules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_schedules" ON upload_schedules;
CREATE POLICY "delete_own_schedules" ON upload_schedules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_schedules_user ON upload_schedules(user_id);

-- ============================================
-- SHORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  source_video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER,
  viral_score INTEGER,
  captions TEXT[],
  thumbnail_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'uploaded', 'failed')),
  file_path TEXT,
  youtube_video_id TEXT,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_shorts" ON shorts;
CREATE POLICY "select_own_shorts" ON shorts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_shorts" ON shorts;
CREATE POLICY "insert_own_shorts" ON shorts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_shorts" ON shorts;
CREATE POLICY "update_own_shorts" ON shorts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_shorts" ON shorts;
CREATE POLICY "delete_own_shorts" ON shorts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_shorts_user ON shorts(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_source_video ON shorts(source_video_id);
