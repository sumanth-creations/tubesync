/*
# Realtime + Final Indexes

1. Enable Supabase Realtime on tables the dashboard/upload queue UI polls,
   so status changes (uploading -> uploaded, etc.) can push to the client
   instead of relying purely on polling.
2. A couple of extra indexes for common lookup patterns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE videos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'upload_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE upload_queue;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activities;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_videos_youtube_channel ON videos(youtube_channel_id);
CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status);
