import { cloudflare } from "@cloudflare/vite-plugin";
import { decoVitePlugin } from "@decocms/tanstack/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// Same plugin order as shop/ (and deco-sites/demo-storefront); plain CSS, no Tailwind.
export default defineConfig({
	server: {
		// Studio sandboxes preview on Freestyle (.style.dev) or under decocms.com.
		allowedHosts: [
			".decocdn.com",
			".trycloudflare.com",
			".preview-studio.decocms.com",
			".decocms.com",
			".style.dev",
		],
	},
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart({ server: { entry: "server" } }),
		react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "19" }]] } }),
		decoVitePlugin(),
		{
			// meta.gen.json is admin-only schema; keep it out of the client bundle.
			name: "deco-stub-meta-gen",
			enforce: "pre" as const,
			resolveId(id, importer, options) {
				if (!options?.ssr && importer && id.includes("meta.gen")) return "\0stub:meta-gen";
			},
			load(id) {
				if (id === "\0stub:meta-gen") return "export default {};";
			},
		},
	],
	define: { "process.env.DECO_SITE_NAME": JSON.stringify("zapzero") },
	resolve: {
		dedupe: [
			"@tanstack/react-start",
			"@tanstack/react-router",
			"@tanstack/react-start-server",
			"@tanstack/start-server-core",
			"@tanstack/start-client-core",
			"@tanstack/start-plugin-core",
			"@tanstack/start-storage-context",
			"react",
			"react-dom",
		],
		alias: { "~": path.resolve(__dirname, "src") },
	},
});
