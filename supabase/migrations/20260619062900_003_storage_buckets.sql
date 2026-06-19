/*
# Storage Buckets

1. New Buckets
- `video-files`: Raw video uploads (private — owner-only access)
- `thumbnails`: Thumbnail images (public-read so they can be shown in UI/YouTube)

2. Security
- Owner-scoped policies based on the first path segment being the user's UID
  (e.g. `videos/{user_id}/myvideo.mp4`)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('video-files', 'video-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- video-files: owner can manage their own folder (path: {user_id}/...)
DROP POLICY IF EXISTS "video_files_select_own" ON storage.objects;
CREATE POLICY "video_files_select_own" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'video-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "video_files_insert_own" ON storage.objects;
CREATE POLICY "video_files_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'video-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "video_files_update_own" ON storage.objects;
CREATE POLICY "video_files_update_own" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'video-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "video_files_delete_own" ON storage.objects;
CREATE POLICY "video_files_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'video-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- thumbnails: public read, owner-only write (path: {user_id}/...)
DROP POLICY IF EXISTS "thumbnails_select_public" ON storage.objects;
CREATE POLICY "thumbnails_select_public" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "thumbnails_insert_own" ON storage.objects;
CREATE POLICY "thumbnails_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "thumbnails_update_own" ON storage.objects;
CREATE POLICY "thumbnails_update_own" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "thumbnails_delete_own" ON storage.objects;
CREATE POLICY "thumbnails_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
