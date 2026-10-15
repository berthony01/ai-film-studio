import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Sign-in is not connected yet</h1>
        <p className="mt-3 text-zinc-400">
          Add your Supabase credentials to <code>.env</code> to enable sign-in.
        </p>
        <Link to="/" className="mt-6 inline-block text-violet-400 hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!loading && user) {
    navigate("/app", { replace: true });
    return null;
  }

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the sign-in link.");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-center text-3xl font-bold">Enter your studio</h1>
      <p className="mt-2 text-center text-zinc-400">
        Passwordless sign-in. We email you a magic link.
      </p>
      {sent ? (
        <p className="mt-8 rounded-xl bg-emerald-900/40 px-4 py-3 text-center text-emerald-300">
          Check your inbox for the sign-in link.
        </p>
      ) : (
        <form onSubmit={sendLink} className="mt-8 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500"
          >
            Email me a sign-in link
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
