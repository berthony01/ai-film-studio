import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ShowDetail from "./pages/ShowDetail";
import Watch from "./pages/Watch";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/watch" element={<Watch />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/shows/:id"
          element={
            <ProtectedRoute>
              <ShowDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  );
}
