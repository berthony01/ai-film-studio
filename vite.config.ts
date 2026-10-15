import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @vitejs/plugin-react is a standard Vite dependency for React projects.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
