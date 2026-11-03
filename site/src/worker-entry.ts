/** Cloudflare Worker entry: the deco/TanStack pages plus the Studio admin endpoints. Nothing else. */
import "./setup";
import "./server/admin-setup";
import {
	corsHeaders,
	handleDecofileRead,
	handleDecofileReload,
	handleMeta,
	handleRender,
} from "@decocms/blocks-admin";
import { createDecoWorkerEntry } from "@decocms/tanstack";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createDecoWorkerEntry(createServerEntry({ fetch: handler.fetch }), {
	admin: { handleMeta, handleDecofileRead, handleDecofileReload, handleRender, corsHeaders },
	securityHeaders: {
		"Content-Security-Policy": [
			"default-src 'self' https: data: blob:",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
			"img-src 'self' https: data: blob:",
			"style-src 'self' 'unsafe-inline'",
			"font-src 'self' data:",
			"object-src 'none'",
			"base-uri 'self'",
		].join("; "),
	},
});
