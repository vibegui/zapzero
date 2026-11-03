/** Site setup: sections + CMS blocks. The Studio admin half is server-only (server/admin-setup.ts). */
import { applySectionConventions } from "@decocms/blocks/cms";
import { createSiteSetup } from "@decocms/blocks/setup";
import { blocks as generatedBlocks } from "../.deco/blocks.gen";
import { loadingFallbacks, sectionMeta, syncComponents } from "../.deco/sections.gen";

const sectionGlob = import.meta.glob("./sections/**/*.tsx") as Record<string, () => Promise<any>>;

createSiteSetup({
	sections: sectionGlob,
	blocks: generatedBlocks,
	// Placeholder until a domain is picked.
	productionOrigins: ["https://zapzero.dev"],
	onResolveError: (error, resolveType, context) =>
		console.error(`[cms] ${context} "${resolveType}" failed:`, error),
});

applySectionConventions({ meta: sectionMeta, syncComponents, loadingFallbacks, sectionGlob });
