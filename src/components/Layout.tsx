import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            AI Film <span className="text-violet-400">Studio</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/watch" className="text-zinc-400 hover:text-white">
              Watch
            </Link>
            {user ? (
              <>
                <Link to="/app" className="text-zinc-400 hover:text-white">
                  Studio
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-300 hover:border-white/30"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to={isSupabaseConfigured ? "/login" : "/"}
                className="rounded-lg bg-violet-600 px-4 py-1.5 font-medium hover:bg-violet-500"
              >
                Start creating
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-white/10 py-8 text-center text-sm text-zinc-500">
        AI Film Studio. The studio that comes with a stage.
      </footer>
    </div>
  );
}
