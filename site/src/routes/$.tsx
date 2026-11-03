import { CmsPage, cmsRouteConfig } from "@decocms/tanstack";
import { createFileRoute, notFound } from "@tanstack/react-router";

const config = cmsRouteConfig({ siteName: "zapzero", defaultTitle: "zapzero" });

export const Route = createFileRoute("/$")({
	...config,
	// A thrown notFound() gives a real 404 status instead of a 200 "not found" page.
	loader: async (ctx: Parameters<typeof config.loader>[0]) => {
		const page = await config.loader(ctx);
		if (!page) throw notFound();
		return page;
	},
	component: Page,
	notFoundComponent: () => (
		<main className="wrap nf">
			<h1 className="display">Zerado demais.</h1>
			<p className="lede">Essa página não existe.</p>
			<a className="btn" href="/">
				Voltar pro início
			</a>
		</main>
	),
});

function Page() {
	const data = Route.useLoaderData() as Record<string, any>;
	return (
		<CmsPage
			sections={data.resolvedSections ?? []}
			deferredSections={data.deferredSections ?? []}
			pagePath={data.pagePath}
			pageUrl={data.pageUrl}
			device={data.device}
		/>
	);
}
