import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import type { Show, Character, World, Episode, Scene, ShowStatus } from "../lib/types";

type Tab = "characters" | "worlds" | "episodes";

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<Show | null>(null);
  const [tab, setTab] = useState<Tab>("characters");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scenesByEpisode, setScenesByEpisode] = useState<Record<string, Scene[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  // Form state
  const [charName, setCharName] = useState("");
  const [charDesc, setCharDesc] = useState("");
  const [charRef, setCharRef] = useState("");
  const [worldName, setWorldName] = useState("");
  const [worldDesc, setWorldDesc] = useState("");
  const [epTitle, setEpTitle] = useState("");
  const [epSynopsis, setEpSynopsis] = useState("");
  const [scenePrompt, setScenePrompt] = useState("");
  const [sceneEpId, setSceneEpId] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const db = getSupabase();
    const [{ data: s }, { data: chars }, { data: w }, { data: eps }] = await Promise.all([
      db.from("shows").select("*").eq("id", id).single(),
      db.from("characters").select("*").eq("show_id", id).order("created_at"),
      db.from("worlds").select("*").eq("show_id", id).order("created_at"),
      db.from("episodes").select("*").eq("show_id", id).order("episode_number"),
    ]);
    if (s) setShow(s as Show);
    if (chars) setCharacters(chars as Character[]);
    if (w) setWorlds(w as World[]);
    if (eps) {
      const epList = eps as Episode[];
      setEpisodes(epList);
      if (epList.length > 0) {
        const { data: scenes } = await db
          .from("scenes")
          .select("*")
          .in("episode_id", epList.map((e) => e.id))
          .order("scene_number");
        const grouped: Record<string, Scene[]> = {};
        ((scenes ?? []) as Scene[]).forEach((sc) => {
          (grouped[sc.episode_id] ||= []).push(sc);
        });
        setScenesByEpisode(grouped);
        setSceneEpId((prev) => prev || epList[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const refreshScenes = async (episodeId: string) => {
    const { data } = await getSupabase()
      .from("scenes")
      .select("*")
      .eq("episode_id", episodeId)
      .order("scene_number");
    setScenesByEpisode((g) => ({ ...g, [episodeId]: (data ?? []) as Scene[] }));
  };

  const addCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim() || !id) return;
    const { data, error } = await getSupabase()
      .from("characters")
      .insert({
        show_id: id,
        name: charName.trim(),
        description: charDesc.trim() || null,
        reference_image_url: charRef.trim() || null,
      })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setCharacters((c) => [...c, data as Character]);
      setCharName("");
      setCharDesc("");
      setCharRef("");
    }
  };

  const addWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worldName.trim() || !id) return;
    const { data, error } = await getSupabase()
      .from("worlds")
      .insert({
        show_id: id,
        name: worldName.trim(),
        description: worldDesc.trim() || null,
      })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setWorlds((w) => [...w, data as World]);
      setWorldName("");
      setWorldDesc("");
    }
  };

  const addEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epTitle.trim() || !id) return;
    const nextNumber = episodes.length > 0 ? Math.max(...episodes.map((x) => x.episode_number)) + 1 : 1;
    const { data, error } = await getSupabase()
      .from("episodes")
      .insert({
        show_id: id,
        episode_number: nextNumber,
        title: epTitle.trim(),
        synopsis: epSynopsis.trim() || null,
        status: "draft",
      })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      const ep = data as Episode;
      setEpisodes((list) => [...list, ep]);
      setScenesByEpisode((g) => ({ ...g, [ep.id]: [] }));
      setSceneEpId(ep.id);
      setEpTitle("");
      setEpSynopsis("");
    }
  };

  const addScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenePrompt.trim() || !sceneEpId) return;
    const existing = scenesByEpisode[sceneEpId] ?? [];
    const nextNumber = existing.length > 0 ? Math.max(...existing.map((s) => s.scene_number)) + 1 : 1;
    const { data, error } = await getSupabase()
      .from("scenes")
      .insert({
        episode_id: sceneEpId,
        scene_number: nextNumber,
        prompt: scenePrompt.trim(),
        character_ids: [],
        status: "draft",
      })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setScenesByEpisode((g) => ({ ...g, [sceneEpId]: [...(g[sceneEpId] ?? []), data as Scene] }));
      setScenePrompt("");
    }
  };

  const generateScene = async (scene: Scene) => {
    setGenerating(scene.id);
    setError("");
    try {
      const { data, error } = await getSupabase().functions.invoke("generate-scene", {
        body: { scene_id: scene.id },
      });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      await refreshScenes(scene.episode_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(null);
    }
  };

  const setStatus = async (status: ShowStatus) => {
    if (!id) return;
    const { error } = await getSupabase().from("shows").update({ status }).eq("id", id);
    if (!error) setShow((s) => (s ? { ...s, status } : s));
  };

  if (loading) return <div className="px-4 py-24 text-center text-zinc-400">Loading show...</div>;
  if (!show)
    return (
      <div className="px-4 py-24 text-center">
        <p>Show not found.</p>
        <Link to="/app" className="text-violet-400 hover:underline">
          Back to studio
        </Link>
      </div>
    );

  const inputCls =
    "rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link to="/app" className="text-sm text-zinc-400 hover:text-white">
        ← Back to studio
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{show.title}</h1>
          {show.logline && <p className="mt-1 text-zinc-400">{show.logline}</p>}
        </div>
        <div className="flex gap-2">
          {(["draft", "in_production", "published"] as ShowStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => setStatus(st)}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                show.status === st ? "bg-violet-600 text-white" : "bg-white/10 text-zinc-300"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-900/40 px-4 py-2 text-sm text-red-300">{error}</p>}

      <div className="mt-8 flex gap-2 border-b border-white/10">
        {(["characters", "worlds", "episodes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-medium capitalize ${
              tab === t ? "border-b-2 border-violet-400 text-white" : "text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "characters" && (
        <div className="mt-6">
          <form onSubmit={addCharacter} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-4">
            <input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="Character name" required className={inputCls} />
            <input value={charDesc} onChange={(e) => setCharDesc(e.target.value)} placeholder="Description (age, look, style)" className={inputCls} />
            <input value={charRef} onChange={(e) => setCharRef(e.target.value)} placeholder="Reference image URL" className={inputCls} />
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2.5 font-semibold hover:bg-violet-500">
              Lock character
            </button>
          </form>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {characters.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.reference_image_url && (
                    <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
                      locked
                    </span>
                  )}
                </div>
                {c.reference_image_url && (
                  <img src={c.reference_image_url} alt={c.name} className="mt-3 aspect-square w-full rounded-xl object-cover" />
                )}
                {c.description && <p className="mt-2 text-sm text-zinc-400">{c.description}</p>}
              </div>
            ))}
            {characters.length === 0 && (
              <p className="text-zinc-500">No characters yet. Lock your cast above.</p>
            )}
          </div>
        </div>
      )}

      {tab === "worlds" && (
        <div className="mt-6">
          <form onSubmit={addWorld} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-3">
            <input value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder="World / location name" required className={inputCls} />
            <input value={worldDesc} onChange={(e) => setWorldDesc(e.target.value)} placeholder="Description (era, mood, palette)" className={inputCls} />
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2.5 font-semibold hover:bg-violet-500">
              Add world
            </button>
          </form>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {worlds.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="font-semibold">{w.name}</h3>
                {w.description && <p className="mt-2 text-sm text-zinc-400">{w.description}</p>}
              </div>
            ))}
            {worlds.length === 0 && <p className="text-zinc-500">No worlds yet.</p>}
          </div>
        </div>
      )}

      {tab === "episodes" && (
        <div className="mt-6 space-y-6">
          <form onSubmit={addEpisode} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-3">
            <input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} placeholder="Episode title" required className={inputCls} />
            <input value={epSynopsis} onChange={(e) => setEpSynopsis(e.target.value)} placeholder="Synopsis" className={inputCls} />
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2.5 font-semibold hover:bg-violet-500">
              Add episode
            </button>
          </form>

          {episodes.map((ep) => (
            <div key={ep.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  E{ep.episode_number}: {ep.title}
                </h3>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs capitalize text-zinc-300">
                  {ep.status}
                </span>
              </div>
              {ep.video_url && <video src={ep.video_url} controls className="mt-3 w-full max-w-xl rounded-xl" />}

              <div className="mt-4 space-y-2">
                {(scenesByEpisode[ep.id] ?? []).map((sc) => (
                  <div
                    key={sc.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold text-violet-300">Scene {sc.scene_number}</span>
                        {" · "}
                        <span className="capitalize text-zinc-400">{sc.status}</span>
                      </p>
                      <p className="truncate text-sm text-zinc-400">{sc.prompt}</p>
                      {sc.video_url && (
                        <video src={sc.video_url} controls className="mt-2 w-full max-w-md rounded-lg" />
                      )}
                    </div>
                    <button
                      onClick={() => generateScene(sc)}
                      disabled={generating === sc.id || sc.status === "processing" || sc.status === "queued"}
                      className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
                    >
                      {generating === sc.id ? "Starting..." : sc.video_url ? "Regenerate" : "Generate"}
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={addScene} className="mt-4 flex gap-3">
                <input
                  value={sceneEpId === ep.id ? scenePrompt : ""}
                  onChange={(e) => {
                    setSceneEpId(ep.id);
                    setScenePrompt(e.target.value);
                  }}
                  placeholder={`Scene prompt for E${ep.episode_number}...`}
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="submit"
                  onClick={() => setSceneEpId(ep.id)}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:border-white/40"
                >
                  Add scene
                </button>
              </form>
            </div>
          ))}
          {episodes.length === 0 && <p className="text-zinc-500">No episodes yet. Add your first above.</p>}
        </div>
      )}
    </div>
  );
}
