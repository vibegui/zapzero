import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Navigate,
	RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AgendaScreen } from "./agenda.tsx";
import type { CategoryId } from "./api.ts";
import { Category, Done, Shell, VoiceScreen } from "./app.tsx";
import { ContactsScreen } from "./contacts.tsx";
import { DigestScreen } from "./digest.tsx";
import { StatsScreen } from "./stats.tsx";
import "./styles.css";

// On first load the hash history appends the page's own query (?t=…) to the hash's: "535?t=…". Read the number.
const pkSearch = (s: Record<string, unknown>): { pk?: number } => {
	const pk = Number.parseInt(String(s.pk ?? ""), 10);
	return pk > 0 ? { pk } : {};
};

const root = createRootRoute({ component: Shell });
const index = createRoute({
	getParentRoute: () => root,
	path: "/",
	component: () => <Navigate to="/agenda" />,
});
const category = createRoute({
	getParentRoute: () => root,
	path: "/c/$cat",
	validateSearch: pkSearch,
	component: function CategoryRoute() {
		const { cat } = category.useParams();
		const { pk } = category.useSearch();
		return <Category view={{ kind: "cat", id: cat as CategoryId }} pk={pk} />;
	},
});
const area = createRoute({
	getParentRoute: () => root,
	path: "/a/$area",
	validateSearch: pkSearch,
	component: function AreaRoute() {
		const { area: id } = area.useParams();
		const { pk } = area.useSearch();
		return <Category view={{ kind: "area", id }} pk={pk} />;
	},
});
const voz = createRoute({ getParentRoute: () => root, path: "/voz", component: VoiceScreen });
const desempenho = createRoute({
	getParentRoute: () => root,
	path: "/desempenho",
	component: StatsScreen,
});
const agenda = createRoute({
	getParentRoute: () => root,
	path: "/agenda",
	component: AgendaScreen,
});
const grupos = createRoute({
	getParentRoute: () => root,
	path: "/grupos",
	component: DigestScreen,
});
const contatos = createRoute({
	getParentRoute: () => root,
	path: "/contatos",
	component: ContactsScreen,
});
const done = createRoute({ getParentRoute: () => root, path: "/feitas", component: Done });

// hash history: the panel lives inside iframes and under a mount path, the server never sees routes
const router = createRouter({
	routeTree: root.addChildren([
		index,
		category,
		area,
		voz,
		desempenho,
		agenda,
		grupos,
		contatos,
		done,
	]),
	history: createHashHistory(),
});
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const qc = new QueryClient({
	defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 15_000 } },
});

// ⌘R reloads and ⌘+ / ⌘- / ⌘0 zoom: the desktop app's window (a WKWebView) has neither of its own
const ZOOM_KEY = "zap:zoom";
let zoom =
	Number(
		(() => {
			try {
				return localStorage.getItem(ZOOM_KEY);
			} catch {
				return null; // sandboxed iframe: no storage, zoom lasts until reload
			}
		})(),
	) || 1;
const setZoom = (z: number) => {
	zoom = Math.min(2, Math.max(0.6, Math.round(z * 10) / 10));
	document.documentElement.style.zoom = String(zoom);
	try {
		localStorage.setItem(ZOOM_KEY, String(zoom));
	} catch {}
};
setZoom(zoom);
window.addEventListener("keydown", (e) => {
	if (!(e.metaKey || e.ctrlKey)) return;
	const k = e.key.toLowerCase();
	const next = k === "=" || k === "+" ? zoom + 0.1 : k === "-" ? zoom - 0.1 : k === "0" ? 1 : null;
	if (k === "r") {
		e.preventDefault();
		location.reload();
	} else if (next != null) {
		e.preventDefault();
		setZoom(next);
	}
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={qc}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
