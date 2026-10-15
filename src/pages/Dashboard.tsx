import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Show } from "../lib/types";

export default function Dashboard() {
  const { user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from("shows")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && data) setShows(data as Show[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { data, error } = await getSupabase()
        .from("shows")
        .insert({
          owner_id: user!.id,
          title: title.trim(),
          logline: logline.trim() || null,
          genre: genre.trim() || null,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      setShows((s) => [data as Show, ...s]);
      setTitle("");
      setLogline("");
      setGenre("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create the show.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Your studio</h1>
      <p className="mt-1 text-zinc-400">Shows in development. Pick one to open its series bible.</p>

      <form
        onSubmit={createShow}
        className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <h2 className="font-semibold">Start a new show</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Show title"
            required
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
          />
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Genre (e.g. sci-fi anime)"
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
          />
          <input
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            placeholder="One-line premise"
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold hover:bg-violet-500 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create show"}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>

      <div className="mt-10">
        {loading ? (
          <p className="text-zinc-400">Loading shows...</p>
        ) : shows.length === 0 ? (
          <p className="text-zinc-500">
            No shows yet. Create your first one above and start casting.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {shows.map((s) => (
              <Link
                key={s.id}
                to={`/app/shows/${s.id}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-violet-400/50"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{s.title}</h3>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-zinc-300">
                    {s.status.replace("_", " ")}
                  </span>
                </div>
                {s.genre && <p className="mt-1 text-sm text-violet-300">{s.genre}</p>}
                {s.logline && <p className="mt-2 text-sm text-zinc-400">{s.logline}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
