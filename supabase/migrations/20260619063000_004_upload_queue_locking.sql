/*
Add locking columns to upload_queue to support workers claiming jobs
This migration is idempotent and safe to run multiple times.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'upload_queue' AND column_name = 'locked_by') THEN
    ALTER TABLE upload_queue ADD COLUMN locked_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'upload_queue' AND column_name = 'lock_expires_at') THEN
    ALTER TABLE upload_queue ADD COLUMN lock_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index to quickly find stale locks
CREATE INDEX IF NOT EXISTS idx_upload_queue_lock_expires ON upload_queue(lock_expires_at);
