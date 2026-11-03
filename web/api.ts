import type { CategoryId, Item } from "../server/inbox.ts";
import type { Week, Who } from "../server/stats.ts";
import type { Decision, DecisionKind, Voice } from "../server/store.ts";
import type { Message } from "../server/wa.ts";

export type { CategoryId, DecisionKind, Item, Message, Voice };
export type Inbox = {
	snapshotAt: number | null;
	refreshing: boolean;
	last: { at: number; ok: boolean; log: string[] } | null;
	spend24h: { what: string; n: number; cost: number }[];
	categories: { id: CategoryId; label: string; items: Item[] }[];
	voice: Voice;
	/** Claude Code found: replies with a time can create a calendar event */
	calendar: boolean;
	areas: { id: string; label: string; builtin: boolean }[];
	suggestions: {
		id: string;
		label: string;
		criteria: string;
		reason: string;
		pks: number[];
		names: string[];
	}[];
};
export type Stats = {
	weeks: Record<Who, Week[]>;
	usage: Record<string, Partial<Record<DecisionKind, number>>>;
	unread: Record<Who, number>;
};
export type DecisionRow = Decision & {
	name: string;
	event: { status: "pending" | "ok" | "skipped" | "error"; result: string | null } | null;
};

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
	stats: () => call<Stats>("stats"),
	decisions: () => call<DecisionRow[]>("decisions"),
	decide: (b: {
		pk: number;
		lastPk: number;
		kind: DecisionKind;
		text?: string;
		event?: boolean;
		invite?: string[];
	}) => call<{ ok: true; via: "whatsapp" | "clipboard" | null; event: boolean }>("decide", b),
	undo: (b: { pk: number; lastPk: number }) => call<{ ok: true }>("undo", b),
	draft: (pk: number) => call<{ text: string }>(`draft/${pk}`, {}),
	refresh: () => call<{ ok: true }>("refresh", {}),
	area: (action: "accept" | "dismiss" | "remove", id: string) =>
		call<{ ok: true }>(`areas/${action}`, { id }),
	suggest: () => call<{ ok: true; count: number }>("suggest", {}),
	saveVoice: (b: { perfil: Record<string, string>; voz: string }) => call<{ ok: true }>("voice", b),
	suggestVoice: () => call<Voice>("voice/suggest", {}),
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
