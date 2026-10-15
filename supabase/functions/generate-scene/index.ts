// POST /functions/v1/generate-scene  { scene_id: string, model?: string }
// Submits a scene to Kie.ai for video generation and records a generation job.
// Requires the caller's Supabase JWT; the caller must own the show.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { kieCreateTask } from "../_shared/kie.ts";

// Model IDs change as Kie.ai updates its catalog. Verify current IDs on
// https://kie.ai/market before the first paid generation, or override per
// request with { "model": "<id>" }. Aspect ratio 9:16 targets vertical episodes.
const DEFAULT_T2V_MODEL = Deno.env.get("KIE_T2V_MODEL") ?? "kling-2.6/text-to-video";
const DEFAULT_I2V_MODEL = Deno.env.get("KIE_I2V_MODEL") ?? "bytedance/seedance-2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  }

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

  const { scene_id: sceneId, model: modelOverride } = await req.json().catch(() => ({}));
  if (!sceneId) {
    return Response.json({ error: "scene_id is required" }, { status: 400, headers: cors });
  }

  const db = createClient(supabaseUrl, serviceKey);

  // Load scene -> episode -> show and verify ownership.
  const { data: scene, error: sceneErr } = await db
    .from("scenes")
    .select("*, episodes!inner(id, show_id, shows!inner(id, owner_id, title))")
    .eq("id", sceneId)
    .single();
  if (sceneErr || !scene) {
    return Response.json({ error: "Scene not found" }, { status: 404, headers: cors });
  }
  const ownerId = (scene.episodes as unknown as { shows: { owner_id: string } }).shows.owner_id;
  if (ownerId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  // Load the locked characters referenced by this scene to anchor identity.
  const characterIds: string[] = scene.character_ids ?? [];
  let characters: { name: string; description: string | null; reference_image_url: string | null }[] = [];
  if (characterIds.length > 0) {
    const { data } = await db.from("characters").select("name, description, reference_image_url").in("id", characterIds);
    if (data) characters = data;
  }

  // Build the generation prompt: character bible first, then the scene.
  // Identity is anchored by reference images, not by prose alone.
  const bible = characters
    .map((c) => `Character "${c.name}"${c.description ? `: ${c.description}` : ""}. Maintain this exact identity.`)
    .join("\n");
  const prompt = [
    bible,
    `Scene: ${scene.prompt}`,
    "Vertical 9:16 cinematic shot. Keep every locked character visually identical to their reference.",
  ]
    .filter(Boolean)
    .join("\n");

  const referenceImages = [
    ...(scene.reference_image_url ? [scene.reference_image_url] : []),
    ...characters.map((c) => c.reference_image_url).filter(Boolean),
  ] as string[];

  const useImageModel = referenceImages.length > 0;
  const model = modelOverride ?? (useImageModel ? DEFAULT_I2V_MODEL : DEFAULT_T2V_MODEL);
  const input: Record<string, unknown> = useImageModel
    ? {
        prompt,
        first_frame_url: referenceImages[0],
        image_urls: referenceImages,
        aspect_ratio: "9:16",
        resolution: "720p",
        duration: "5",
      }
    : {
        prompt,
        aspect_ratio: "9:16",
        duration: "5",
      };

  let taskId: string;
  try {
    taskId = await kieCreateTask(kieKey, model, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kie.ai request failed";
    return Response.json({ error: message }, { status: 502, headers: cors });
  }

  const { data: job, error: jobErr } = await db
    .from("generation_jobs")
    .insert({ scene_id: sceneId, provider_task_id: taskId, model, status: "queued" })
    .select()
    .single();
  if (jobErr) {
    return Response.json({ error: jobErr.message }, { status: 500, headers: cors });
  }

  await db.from("scenes").update({ status: "queued" }).eq("id", sceneId);
  await db.from("episodes").update({ status: "generating" }).eq("id", scene.episode_id);

  return Response.json({ job_id: job.id, task_id: taskId, model }, { headers: cors });
});
