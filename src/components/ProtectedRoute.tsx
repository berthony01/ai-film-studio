import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Studio is not connected yet</h1>
        <p className="mt-3 text-zinc-400">
          The backend is not configured. Add your Supabase credentials to <code>.env</code> to
          unlock the studio.
        </p>
      </div>
    );
  }
  if (loading) {
    return <div className="px-4 py-24 text-center text-zinc-400">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
