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
import type { CategoryId } from "./api.ts";
import { Category, Done, Shell, VoiceScreen } from "./app.tsx";
import { StatsScreen } from "./stats.tsx";
import "./styles.css";

const root = createRootRoute({ component: Shell });
const index = createRoute({
	getParentRoute: () => root,
	path: "/",
	component: () => <Navigate to="/c/$cat" params={{ cat: "urgente" }} />,
});
const category = createRoute({
	getParentRoute: () => root,
	path: "/c/$cat",
	validateSearch: (s: Record<string, unknown>): { pk?: number } =>
		s.pk ? { pk: Number(s.pk) } : {},
	component: function CategoryRoute() {
		const { cat } = category.useParams();
		const { pk } = category.useSearch();
		return <Category view={{ kind: "cat", id: cat as CategoryId }} pk={pk} />;
	},
});
const area = createRoute({
	getParentRoute: () => root,
	path: "/a/$area",
	validateSearch: (s: Record<string, unknown>): { pk?: number } =>
		s.pk ? { pk: Number(s.pk) } : {},
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
const done = createRoute({ getParentRoute: () => root, path: "/feitas", component: Done });

// hash history: the panel lives inside iframes and under a mount path, the server never sees routes
const router = createRouter({
	routeTree: root.addChildren([index, category, area, voz, desempenho, done]),
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
