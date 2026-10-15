import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import type { Episode } from "../lib/types";

interface PublishedEpisode extends Episode {
  shows: { title: string; genre: string | null };
}

export default function Watch() {
  const [episodes, setEpisodes] = useState<PublishedEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getSupabase()
          .from("episodes")
          .select("*, shows!inner(title, genre)")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(50);
        if (data) setEpisodes(data as PublishedEpisode[]);
      } catch {
        // Backend not configured yet; show the empty state.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">The theater</h1>
      <p className="mt-1 text-zinc-400">
        Finished episodes from creators on the platform. Watch time earns creators money.
      </p>
      <div className="mt-10">
        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : episodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
            <p className="text-lg font-semibold">The marquee is still being painted</p>
            <p className="mt-2 text-zinc-400">
              No episodes are published yet.{" "}
              <Link to="/#waitlist" className="text-violet-400 hover:underline">
                Join the waitlist
              </Link>{" "}
              to be first on stage.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                {ep.thumbnail_url ? (
                  <img src={ep.thumbnail_url} alt={ep.title} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-violet-900/60 to-black text-4xl">
                    🎬
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wider text-violet-300">
                    {ep.shows.title}
                    {ep.shows.genre ? ` · ${ep.shows.genre}` : ""}
                  </p>
                  <h3 className="mt-1 font-semibold">
                    E{ep.episode_number}: {ep.title}
                  </h3>
                  {ep.video_url && (
                    <video src={ep.video_url} controls className="mt-3 w-full rounded-xl" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
