// GET /functions/v1/poll-generation?job_id=<uuid>
// Checks a Kie.ai task, and on success downloads the video into Supabase
// Storage (Kie.ai result URLs expire in ~24h) and marks the scene ready.
// The frontend polls this endpoint until the job reaches a terminal state.
// Requires the caller's Supabase JWT; the caller must own the show.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { kieRecordInfo, kieResultUrls } from "../_shared/kie.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TERMINAL = new Set(["completed", "failed"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const kieKey = Deno.env.get("KIE_API_KEY");
  if (!kieKey) {
    return Response.json({ error: "KIE_API_KEY is not set on this function." }, { status: 500, headers: cors });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }
  const userId = userData.user.id;

  const jobId = new URL(req.url).searchParams.get("job_id");
  if (!jobId) {
    return Response.json({ error: "job_id is required" }, { status: 400, headers: cors });
  }

  const db = createClient(supabaseUrl, serviceKey);

  const { data: job, error: jobErr } = await db
    .from("generation_jobs")
    .select("*, scenes!inner(id, episode_id, scene_number, episodes!inner(id, show_id, shows!inner(id, owner_id)))")
    .eq("id", jobId)
    .single();
  if (jobErr || !job) {
    return Response.json({ error: "Job not found" }, { status: 404, headers: cors });
  }
  const ownerId = (
    job.scenes as unknown as { episodes: { shows: { owner_id: string } } }
  ).episodes.shows.owner_id;
  if (ownerId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  if (TERMINAL.has(job.status)) {
    return Response.json({ status: job.status, video_url: null }, { headers: cors });
  }
  if (!job.provider_task_id) {
    return Response.json({ status: job.status }, { headers: cors });
  }

  let record;
  try {
    record = await kieRecordInfo(kieKey, job.provider_task_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "recordInfo failed";
    return Response.json({ error: message }, { status: 502, headers: cors });
  }

  const state = record?.state ?? "unknown";
  const sceneId = (job.scenes as unknown as { id: string }).id;
  const episodeId = (job.scenes as unknown as { episodes: { id: string } }).episodes.id;

  if (state === "success") {
    const urls = kieResultUrls(record);
    if (urls.length === 0) {
      await db.from("generation_jobs").update({ status: "failed", error: "No result URL returned" }).eq("id", jobId);
      await db.from("scenes").update({ status: "failed" }).eq("id", sceneId);
      return Response.json({ status: "failed", error: "No result URL returned" }, { headers: cors });
    }

    // Download immediately: provider URLs expire in ~24h.
    const videoRes = await fetch(urls[0]);
    if (!videoRes.ok) {
      throw new Error(`Could not download result video: ${videoRes.status}`);
    }
    const bytes = new Uint8Array(await videoRes.arrayBuffer());
    const storagePath = `${episodeId}/${sceneId}.mp4`;
    const { error: upErr } = await db.storage
      .from("episode-videos")
      .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) {
      await db.from("generation_jobs").update({ status: "failed", error: upErr.message }).eq("id", jobId);
      await db.from("scenes").update({ status: "failed" }).eq("id", sceneId);
      return Response.json({ status: "failed", error: upErr.message }, { headers: cors });
    }

    const { data: pub } = db.storage.from("episode-videos").getPublicUrl(storagePath);
    await db.from("generation_jobs").update({ status: "completed" }).eq("id", jobId);
    await db.from("scenes").update({ status: "ready", video_url: pub.publicUrl }).eq("id", sceneId);

    // If every scene in the episode is ready, mark the episode ready.
    const { data: siblings } = await db.from("scenes").select("status").eq("episode_id", episodeId);
    if (siblings && siblings.length > 0 && siblings.every((s) => s.status === "ready")) {
      await db.from("episodes").update({ status: "ready" }).eq("id", episodeId);
    }

    return Response.json({ status: "completed", video_url: pub.publicUrl }, { headers: cors });
  }

  if (state === "fail") {
    const failMsg = record?.failMsg || record?.failCode || "Generation failed";
    await db.from("generation_jobs").update({ status: "failed", error: failMsg }).eq("id", jobId);
    await db.from("scenes").update({ status: "failed" }).eq("id", sceneId);
    return Response.json({ status: "failed", error: failMsg }, { headers: cors });
  }

  // Still in flight: waiting | queuing | generating
  const mapped = state === "generating" ? "processing" : "queued";
  await db.from("generation_jobs").update({ status: mapped }).eq("id", jobId);
  await db.from("scenes").update({ status: mapped }).eq("id", sceneId);
  return Response.json({ status: mapped, provider_state: state }, { headers: cors });
});
