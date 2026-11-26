import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    // Forward /api calls to the Go container (service name "backend" in docker-compose)
    proxy: {
      "/api": "http://backend:8080",
    },
  },
});
