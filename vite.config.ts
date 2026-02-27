import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      { find: "@/generated", replacement: path.resolve(__dirname, "./solana-space/clients/js/src/generated") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
}));
