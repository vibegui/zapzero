import { decoMetaRouteConfig } from "@decocms/tanstack";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/deco/meta")(decoMetaRouteConfig());
