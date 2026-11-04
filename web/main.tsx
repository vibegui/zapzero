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
	component: () => <Navigate to="/c/$cat" params={{ cat: "urgente" }} />,
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
const done = createRoute({ getParentRoute: () => root, path: "/feitas", component: Done });

// hash history: the panel lives inside iframes and under a mount path, the server never sees routes
const router = createRouter({
	routeTree: root.addChildren([index, category, area, voz, desempenho, agenda, grupos, done]),
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

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={qc}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
