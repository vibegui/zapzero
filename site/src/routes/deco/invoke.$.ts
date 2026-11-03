import { decoInvokeRouteConfig } from "@decocms/tanstack";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/deco/invoke/$")(decoInvokeRouteConfig());
