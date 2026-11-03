import { CmsPage, cmsHomeRouteConfig } from "@decocms/tanstack";
import { createFileRoute } from "@tanstack/react-router";

const config = cmsHomeRouteConfig({ defaultTitle: "zapzero", siteName: "zapzero" });

export const Route = createFileRoute("/")({
	...config,
	component: Home,
});

function Home() {
	const data = Route.useLoaderData() as Record<string, any> | null;
	return (
		<CmsPage
			sections={data?.resolvedSections ?? []}
			deferredSections={data?.deferredSections ?? []}
			pagePath={data?.pagePath}
			pageUrl={data?.pageUrl}
			device={data?.device}
		/>
	);
}
