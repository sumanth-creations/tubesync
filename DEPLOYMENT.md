**Supabase: youtube-upload-worker Deployment**

- Prerequisites:
  - Install Supabase CLI: `npm install -g supabase` or follow Supabase docs.
  - Have a Supabase project and `supabase` authenticated locally.

- Secrets (set with `supabase secrets set`):
  - `SUPABASE_SERVICE_ROLE_KEY` (Service Role key; NEVER commit)
  - `SUPABASE_URL` (project URL)
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

- Steps:
  1. Link repo to project: `supabase link --project-ref <project-ref>`
  2. Push DB migrations: `supabase db push --schema supabase/migrations` (or use GUI/migrations apply)
  3. Deploy edge function: `supabase functions deploy youtube-upload-worker --no-verify-jwt --project-ref <project-ref>`
     - You can run the worker on-demand via: `supabase functions invoke youtube-upload-worker --body '{}'`
  4. Set function secrets:
     - `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=...`

- Running in production:
  - Configure a scheduled trigger (cron) to invoke the function periodically (e.g., every minute).
  - Use `supabase functions` scheduled jobs or an external runner to post to the function endpoint.

- Notes:
  - The worker uses the Supabase Service Role key and Google client secrets from environment; do not store them in repo.
  - The migration adds `locked_by` and `lock_expires_at` to `upload_queue` to support lock tracking; the worker currently claims jobs via an atomic PATCH filter.
