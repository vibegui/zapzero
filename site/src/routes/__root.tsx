import { DecoRootLayout } from "@decocms/tanstack";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
// Inlined: no render-blocking stylesheet request.
import appCss from "../styles/app.css?inline";

// Self-hosted Archivo (OFL, variable weight + width), kept out of app.css: Vite rewrites url() inside
// ?inline CSS and the SSR build chokes on a public-dir path there (same as circulei).
const FONT =
	'@font-face{font-family:Archivo;font-style:normal;font-weight:300 900;font-stretch:62% 125%;font-display:swap;src:url(/fonts/archivo-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}';

const TITLE = "zapzero · Inbox zero pro WhatsApp";
const DESCRIPTION =
	"Zere o WhatsApp. A IA tria cada conversa e rascunha a resposta no seu jeito de escrever. Sem bot, sem risco, sem sair do seu Mac.";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
			{ title: TITLE },
			{ name: "description", content: DESCRIPTION },
			// iOS paints its bars from this and from html/body (see app.css).
			{ name: "theme-color", content: "#f6f5f1", media: "(prefers-color-scheme: light)" },
			{ name: "theme-color", content: "#0b0d0c", media: "(prefers-color-scheme: dark)" },
			{ property: "og:title", content: TITLE },
			{ property: "og:description", content: DESCRIPTION },
		],
		links: [
			{
				rel: "preload",
				href: "/fonts/archivo-latin.woff2",
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{
				rel: "icon",
				href: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#128c5e"/><circle cx="16" cy="16" r="7" fill="none" stroke="#fff" stroke-width="3"/></svg>')}`,
			},
		],
		styles: [{ children: FONT + appCss }],
	}),
	component: Root,
});

function Root() {
	const path = useRouterState({ select: (s) => s.location.pathname });
	return <DecoRootLayout siteName="zapzero" lang={path.startsWith("/en") ? "en" : "pt-BR"} />;
}
