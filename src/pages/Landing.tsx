import { useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

const FEATURES = [
  {
    title: "Lock your cast",
    body: "Define each character once with a reference image. Every scene, every episode, the same face, the same outfit, the same presence. No more morphing strangers.",
  },
  {
    title: "Build the series bible",
    body: "Characters, worlds, and visual style live in one persistent bible your whole show references. Continuity stops being luck and starts being infrastructure.",
  },
  {
    title: "Generate episode by episode",
    body: "Write scenes in plain language, attach your locked characters, and generate. Review, regenerate, and assemble episodes without leaving the studio.",
  },
  {
    title: "Publish to a paying stage",
    body: "Your finished episodes go straight to the theater, where watch time earns you money. The studio comes with the stage built in.",
  },
];

const STEPS = [
  { n: "01", title: "Create your show", body: "Name it, set the genre, write the logline." },
  { n: "02", title: "Cast it", body: "Upload reference images and lock every character's look." },
  { n: "03", title: "Write scenes", body: "Describe each shot. Your bible keeps everyone consistent." },
  { n: "04", title: "Generate and publish", body: "Render episodes, then ship them to the theater." },
];

export default function Landing() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("creator");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const joinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    if (!isSupabaseConfigured) {
      setStatus("error");
      setMessage("The waitlist opens soon. Check back shortly.");
      return;
    }
    setStatus("sending");
    try {
      const { error } = await getSupabase()
        .from("waitlist")
        .insert({ email: email.trim().toLowerCase(), name: name.trim() || null, role });
      if (error) throw error;
      setStatus("done");
      setMessage("You're on the list. We'll reach out when your studio is ready.");
      setEmail("");
      setName("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setStatus("error");
      setMessage(
        msg.includes("duplicate") || msg.includes("unique")
          ? "That email is already on the list."
          : msg
      );
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">
          For AI filmmakers
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight">
          Direct your own AI series. Keep every character consistent.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          AI Film Studio is the production workflow serialized storytelling has been missing:
          a persistent series bible, locked characters, episode-by-episode generation, and a
          theater where your watch time earns you money.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            to={isSupabaseConfigured ? "/login" : "#waitlist"}
            className="rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500"
          >
            Start creating
          </Link>
          <Link
            to="/watch"
            className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-zinc-200 hover:border-white/40"
          >
            Watch shows
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Why shows made here look like shows</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-xl font-semibold text-violet-300">{f.title}</h3>
              <p className="mt-2 text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">From idea to episode in four steps</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-sm font-bold text-violet-400">{s.n}</p>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto max-w-2xl px-4 py-20">
        <div className="rounded-3xl border border-violet-500/30 bg-violet-950/20 p-8 text-center">
          <h2 className="text-3xl font-bold">Get early access</h2>
          <p className="mt-2 text-zinc-400">
            We are onboarding creators in waves. Join the waitlist and claim your studio.
          </p>
          {status === "done" ? (
            <p className="mt-6 rounded-xl bg-emerald-900/40 px-4 py-3 text-emerald-300">{message}</p>
          ) : (
            <form onSubmit={joinWaitlist} className="mt-6 space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
              />
              <div className="flex gap-3 text-sm">
                {(["creator", "viewer"] as const).map((r) => (
                  <label
                    key={r}
                    className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 capitalize ${
                      role === r
                        ? "border-violet-400 bg-violet-900/40"
                        : "border-white/15 text-zinc-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="mr-2"
                    />
                    I want to {r === "creator" ? "create shows" : "watch shows"}
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
              >
                {status === "sending" ? "Joining..." : "Join the waitlist"}
              </button>
              {status === "error" && <p className="text-sm text-red-400">{message}</p>}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
