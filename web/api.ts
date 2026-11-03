import type { CategoryId, Item } from "../server/inbox.ts";
import type { Decision, DecisionKind } from "../server/store.ts";
import type { Message } from "../server/wa.ts";

export type { CategoryId, DecisionKind, Item, Message };
export type Inbox = {
	snapshotAt: number | null;
	refreshing: boolean;
	last: { at: number; ok: boolean; log: string[] } | null;
	spend24h: { what: string; n: number; cost: number }[];
	categories: { id: CategoryId; label: string; items: Item[] }[];
};
export type DecisionRow = Decision & { name: string };

/** The token arrives in the iframe URL (?t=). Kept in memory only: storage throws in a sandboxed frame. */
export const TOKEN = new URLSearchParams(location.search).get("t") ?? "";

async function call<T>(path: string, body?: unknown): Promise<T> {
	// relative: works under any mount path (tailscale serve --set-path=/zap)
	const res = await fetch(`api/${path}`, {
		method: body === undefined ? "GET" : "POST",
		headers: {
			"x-zap-token": TOKEN,
			...(body === undefined ? {} : { "content-type": "application/json" }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
	return json as T;
}

export const api = {
	inbox: () => call<Inbox>("inbox"),
	chat: (pk: number) => call<Message[]>(`chat/${pk}`),
	decisions: () => call<DecisionRow[]>("decisions"),
	decide: (b: { pk: number; lastPk: number; kind: DecisionKind; text?: string }) =>
		call<{ ok: true; via: "whatsapp" | "clipboard" | null }>("decide", b),
	undo: (b: { pk: number; lastPk: number }) => call<{ ok: true }>("undo", b),
	draft: (pk: number) => call<{ text: string }>(`draft/${pk}`, {}),
	refresh: () => call<{ ok: true }>("refresh", {}),
};

export function ago(ms: number | null) {
	if (!ms) return "";
	const m = Math.round((Date.now() - ms) / 60_000);
	if (m < 1) return "agora";
	if (m < 60) return `${m} min`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h} h`;
	const d = Math.round(h / 24);
	if (d < 60) return `${d} d`;
	return `${Math.round(d / 30)} meses`;
}
