import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	// relative assets: served under any path (tailscale serve --set-path=/zap)
	base: "./",
	plugins: [react(), tailwindcss()],
	resolve: { alias: { "@": path.resolve(__dirname, "./web") } },
	server: { port: 5188, proxy: { "/api": "http://127.0.0.1:8810" } },
	build: { outDir: "dist", emptyOutDir: true },
});
