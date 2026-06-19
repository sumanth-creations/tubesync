# TubeSync — YouTube Automation Platform

A multi-user SaaS dashboard for YouTube creators: AI-assisted titles/descriptions/scripts,
upload queue management, Shorts generation, upload scheduling, SEO scoring, and YouTube
channel connection via OAuth.

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + React Router + Supabase
(Postgres + Auth + Storage + Edge Functions)

---

## 1. What's included

- Email/password auth (Supabase Auth), protected routes
- Dashboard, AI content generator, upload queue, video library, Shorts, calendar,
  SEO analyzer, settings
- `youtube-oauth` Edge Function: connects a user's YouTube channel via Google OAuth,
  stores tokens, refreshes them, disconnects
- Full Postgres schema with Row Level Security — every table is scoped to `auth.uid()`
  so users only ever see their own data
- Storage buckets for video files (private) and thumbnails (public-read)

## 2. What's NOT included yet (by design, scoped out for this pass)

- **Actually uploading the video file to YouTube.** Today the app lets users generate
  metadata (title/description/tags) and queues a `videos` row, but there's no background
  worker that takes a file from Storage and pushes it through YouTube's resumable upload
  API. The `upload_queue` table and UI are ready for this — it just needs a worker
  (e.g. a scheduled Edge Function or external worker) to consume the queue. Ask me when
  you're ready to build this — it's the next logical step.
- A billing/subscription layer (Stripe, etc.) if you want to charge for this SaaS.

## 3. Supabase setup

This project already points at an existing Supabase project (see `.env`). To deploy the
database schema and edge function to that project:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # ref is in your Supabase project URL

# Push all migrations (creates every table, RLS policy, storage bucket)
supabase db push

# Deploy the YouTube OAuth edge function
supabase functions deploy youtube-oauth
```

If you'd rather use a **brand-new** Supabase project instead of the one already wired up:
1. Create a project at https://supabase.com/dashboard
2. Copy its Project URL and anon key into `.env` (see `.env.example` for the format)
3. Run the `supabase link` + `db push` + `functions deploy` commands above against the new project

## 4. Google OAuth setup (YouTube connect)

**Important:** the OAuth client secret that shipped with the original project export was
hardcoded in source — treat it as compromised. Generate a fresh one:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create (or reuse, but **reset the secret on**) an OAuth 2.0 Client ID of type "Web application"
3. Under **Authorized redirect URIs**, add your deployed frontend URL, e.g.:
   `https://yourapp.com/` (the app reads the `?code=` param from the root and routes it
   internally to Settings — see `src/App.tsx`'s `RootRedirect`)
4. Enable the **YouTube Data API v3** for the project (APIs & Services → Library)
5. Set these as **Supabase Edge Function secrets** (never put them in frontend `.env`,
   never hardcode them in the function):

```bash
supabase secrets set GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
supabase secrets set GOOGLE_REDIRECT_URI=https://yourapp.com/
```

The redirect URI here **must exactly match** what you registered in step 3, including
trailing slash.

## 5. Local development

```bash
npm install
npm run dev
```

App runs at `http://localhost:8080`. Note: Google OAuth won't complete locally unless
`http://localhost:8080/` is also added as an authorized redirect URI in Google Cloud
Console (and `GOOGLE_REDIRECT_URI` is set to that for local testing).

## 6. Build & deploy the frontend

```bash
npm run build
```

This outputs static files to `dist/`. Deploy `dist/` to any static host (Vercel, Netlify,
Cloudflare Pages, etc.) and set the two `VITE_SUPABASE_*` env vars in that host's
dashboard at build time.

## 7. Database schema summary

| Table | Purpose |
|---|---|
| `videos` | Core video records (draft → queued → uploaded) |
| `youtube_channels` | Connected YouTube channels + OAuth tokens |
| `upload_queue` | Queue of videos pending upload to YouTube |
| `upload_schedules` | Recurring auto-upload schedule configs |
| `shorts` | AI-generated short clips derived from a source video |
| `ai_generations` | Saved AI-generated content (titles, scripts, etc.) |
| `video_jobs` | Background job tracking (generate/upload/process) |
| `analytics` | Per-day channel analytics snapshots |
| `activities` | Activity feed shown on the dashboard |

All tables have RLS enabled — a user can only read/write rows where `user_id = auth.uid()`.

## 8. Security notes

- The anon key in `.env` is safe to expose in frontend code by design — Supabase RLS is
  what actually protects data, not secrecy of this key.
- The Supabase **service role key** and Google **client secret** must never appear in
  frontend code or be committed — they live only as Edge Function secrets
  (`supabase secrets set ...`).
- Rotate the Google OAuth client secret (see section 4) before going live, since the one
  originally bundled with this project was exposed in source.
