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

const deco = createDecoWorkerEntry(createServerEntry({ fetch: handler.fetch }), {
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

// Locales live at /pt and /en. "/" picks one: an explicit choice (cookie, set by ?lang=), else the
// browser's first language (pt-* gets Portuguese, everyone else English). 302 + Vary, never cached as one.
const COOKIE = "zapzero_locale";
type Locale = "pt" | "en";

function redirect(to: URL, setCookie?: Locale) {
	const headers = new Headers({ location: to.pathname + to.search + to.hash, vary: "Accept-Language, Cookie" });
	headers.set("cache-control", "private, no-store");
	if (setCookie) headers.set("set-cookie", `${COOKIE}=${setCookie}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`);
	return new Response(null, { status: 302, headers });
}

export default {
	fetch(request: Request, env: Parameters<typeof deco.fetch>[1], ctx: Parameters<typeof deco.fetch>[2]) {
		const url = new URL(request.url);
		const asked = url.searchParams.get("lang");
		if (asked === "pt" || asked === "en") {
			url.searchParams.delete("lang");
			if (!url.pathname.startsWith(`/${asked}`)) url.pathname = `/${asked}`;
			return redirect(url, asked);
		}
		if (url.pathname === "/") {
			const saved = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(pt|en)\\b`))?.[1];
			const first = request.headers.get("accept-language")?.split(",", 1)[0]?.trim().toLowerCase() ?? "";
			url.pathname = `/${(saved as Locale | undefined) ?? (first.startsWith("pt") ? "pt" : "en")}`;
			return redirect(url);
		}
		return deco.fetch(request, env, ctx);
	},
};
