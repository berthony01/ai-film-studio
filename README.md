# AI Film Studio

The studio that comes with a stage. A platform for creating serialized AI films,
series, and anime: lock your characters once, generate episode by episode with
consistent identity, and publish to a theater where watch time earns creators money.

## Architecture

| Layer    | Choice   | Why                                                        |
|----------|----------|------------------------------------------------------------|
| Frontend | Vite + React + TS + Tailwind, hosted on Vercel | Free hobby tier, preview URL per PR for QA |
| Backend  | Supabase (Postgres + Auth + Storage + Edge Functions) | Already in the stack, generous free tier |
| Video AI | Kie.ai API (unified jobs API) | Cheapest aggregator path, single API key |
| Payments | Stripe (Phase 3) | Already connected |

One repo holds the web app plus `supabase/` (migrations, edge functions).

## The core loop

1. **Series bible**: shows own characters (locked cast with reference images) and worlds.
2. **Scenes**: each scene carries a prompt plus the character bible. Identity is anchored
   by reference images, not prose alone.
3. **Generation**: `generate-scene` edge function submits to Kie.ai (`POST
   /api/v1/jobs/createTask`), records a `generation_jobs` row.
4. **Polling**: the frontend polls `poll-generation`, which checks
   `GET /api/v1/jobs/recordInfo`. On success it **immediately downloads the video
   into Supabase Storage** (provider URLs expire in ~24h) and marks the scene ready.
   When every scene in an episode is ready, the episode flips to ready.
5. **Theater**: published episodes appear on `/watch`.

## Setup

### 1. Supabase project
Create a project at supabase.com, then run the migration:
`supabase/migrations/20261015_init.sql` (via the SQL editor or CLI).
It creates tables, RLS policies, storage buckets, and the new-user profile trigger.

### 2. Edge functions
Deploy with the Supabase CLI:
```
supabase functions deploy generate-scene --project-ref <ref>
supabase functions deploy poll-generation --project-ref <ref>
supabase secrets set KIE_API_KEY=<your-key> --project-ref <ref>
```
Optional model overrides: `KIE_T2V_MODEL`, `KIE_I2V_MODEL`.
Verify current model IDs on https://kie.ai/market before the first paid generation.

### 3. Frontend
```
cp .env.example .env   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```
Deploy to Vercel from the `main` branch. Every PR gets a preview URL.

## Project structure

```
src/
  pages/        Landing (waitlist) · Login · Dashboard · ShowDetail · Watch
  components/   Layout · ProtectedRoute
  lib/          supabase client · auth context · table types
supabase/
  migrations/   20261015_init.sql (schema + RLS + buckets)
  functions/    generate-scene · poll-generation · _shared/kie.ts
```

## Roadmap

- **Phase 0 (now)**: validation. Landing page + waitlist. Measure creator intent.
- **Phase 1**: MVP studio. Series bible, scene generation, episode assembly. (This repo.)
- **Phase 2**: theater. Discovery feed, watch-time tracking, creator profiles.
- **Phase 3**: monetization. Stripe paywalls, creator payouts, curation tooling.
- **Later**: move video storage to Cloudflare R2 when egress outgrows Supabase.
