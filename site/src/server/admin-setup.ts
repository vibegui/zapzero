/** Studio admin protocol (schema, preview shell). Server-only, imported by worker-entry (same split as circulei). */
import { createAdminSetup } from "@decocms/blocks-admin/setup";
import { PreviewProviders } from "@decocms/tanstack";
import appCss from "../styles/app.css?inline";

createAdminSetup({
	meta: () => import("../../.deco/meta.gen.json").then((m) => m.default),
	css: `data:text/css,${encodeURIComponent(appCss)}`,
	fonts: [],
	previewWrapper: PreviewProviders,
});
