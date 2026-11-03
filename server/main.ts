// zapzero: one local process. CLI for the pipeline, and `serve` for the API + panel on 127.0.0.1.
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { z } from "zod";
import { hasTime } from "../web/slots.ts";
import * as ai from "./ai.ts";
import { addGuest, bookProposal, CLAUDE, createEvent, scheduleWithGuest } from "./calendar.ts";
import { emailsFor } from "./contacts.ts";
import { PORT, REFRESH_MIN, TOKEN } from "./env.ts";
import { buildInbox, CATEGORIES, findPendingInvite, type PendingInvite } from "./inbox.ts";
import { cohorts, type Who, weekOf } from "./stats.ts";
import * as store from "./store.ts";
import * as wa from "./wa.ts";

// ---- pipeline -------------------------------------------------------------------------------

let running: Promise<void> | null = null;
let last: { at: number; ok: boolean; log: string[] } | null = null;

/** snapshot -> triage -> drafts, one at a time. A failure keeps the previous data and is shown in the panel. */
function refresh(): Promise<void> {
	running ??= (async () => {
		const log: string[] = [];
		const say = (s: string) => {
			log.push(s);
			console.log(s);
		};
		let ok = true;
		try {
			await wa.snapshot();
			say(`snapshot: ${wa.chats().length} chats`);
			// first scan: propose who the owner is and how they write, before triage and drafts use it
			if (store.voice().state === "empty") await ai.suggestVoice(say);
			await ai.triage(say);
			await ai.drafts(say);
			await ai.suggest(say);
			await ai.learn(say);
			await ai.detectProposals(say);
		} catch (e) {
			ok = false;
			say(`erro: ${(e as Error).message}`);
		}
		last = { at: Date.now(), ok, log };
	})().finally(() => {
		running = null;
	});
	return running;
}

// ---- pending invites -----------------------------------------------------------------------

/** DMs active this week where they sent an e-mail for a call the owner agreed: see findPendingInvite. */
let invitesCache: { key: string; map: Map<number, PendingInvite> } | null = null;
function pendingInvites(): Map<number, PendingInvite> {
	// ~80 small queries: once per snapshot and per change in events, not on every 30 s poll
	const key = `${wa.snapshotAt()}:${[...store.events().values()].map((e) => `${e.status}${e.guests}`).join()}`;
	if (invitesCache?.key === key) return invitesCache.map;
	const out = new Map<number, PendingInvite>();
	const week = Date.now() - 7 * 86_400_000;
	for (const c of wa.chats()) {
		if (c.group || c.archived || !c.lastInAt || c.lastInAt < week) continue;
		const inv = findPendingInvite(wa.messages(c.pk, 12), store.invitedIn(c.pk), hasTime);
		if (inv) out.set(c.pk, inv);
	}
	invitesCache = { key, map: out };
	return out;
}

// ---- api ------------------------------------------------------------------------------------

const app = new Hono();

// The panel runs inside a sandboxed iframe (origin "null"), so CORS is open and the token is the gate.
app.use("/api/*", async (c, next) => {
	c.header("access-control-allow-origin", "*");
	c.header("access-control-allow-headers", "content-type, x-zap-token");
	c.header("access-control-allow-methods", "GET, POST, OPTIONS");
	c.header("cache-control", "no-store");
	if (c.req.method === "OPTIONS") return c.body(null, 204);
	const got = Buffer.from(c.req.header("x-zap-token") ?? "");
	const want = Buffer.from(TOKEN);
	if (got.length !== want.length || !timingSafeEqual(got, want))
		return c.json({ error: "token" }, 401);
	await next();
});

app.get("/api/inbox", (c) => {
	const all = wa.chats();
	const names = new Map(all.map((x) => [x.pk, x.name]));
	const box = buildInbox(
		all,
		store.triages(),
		store.drafts(),
		store.decisions(),
		Date.now(),
		pendingInvites(),
	);
	return c.json({
		snapshotAt: wa.snapshotAt(),
		refreshing: running != null,
		last,
		spend24h: store.spendSince(86_400_000),
		voice: store.voice(),
		learned: store.learned(),
		areas: store.areas().map(({ id, label, builtin }) => ({ id, label, builtin: builtin === 1 })),
		suggestions: store.suggestions("pending").map((s) => ({
			...s,
			names: s.pks.map((pk) => names.get(pk) ?? String(pk)),
		})),
		categories: CATEGORIES.map((k) => ({ ...k, items: box[k.id] })),
		calendar: CLAUDE != null,
		proposals: proposalList(),
	});
});

app.get("/api/chat/:pk", (c) => c.json(wa.messages(Number(c.req.param("pk")), 30)));
// opens the chat in WhatsApp Desktop, nothing typed: the owner looks before deciding
app.post("/api/open/:pk", (c) => {
	const chat = wa.chats().find((x) => x.pk === Number(c.req.param("pk")));
	if (!chat) return c.json({ error: "chat" }, 404);
	Bun.spawnSync(
		chat.phone ? ["open", `whatsapp://send?phone=${chat.phone}`] : ["open", "-a", "WhatsApp"],
	);
	return c.json({ via: chat.phone ? "chat" : "app" });
});

// read-only: an image file from WhatsApp's own Message folder, never a path from the request
app.get("/api/media/:pk", (c) => {
	const f = wa.mediaFile(Number(c.req.param("pk")));
	if (!f) return c.json({ error: "media" }, 404);
	return new Response(Bun.file(f), { headers: { "cache-control": "private, max-age=86400" } });
});

/** What the other person wrote in a chat, lowercased: e-mails to invite must appear here. */
/** E-mails we may invite for a chat: the macOS contact's, and any the person wrote in the chat. */
function knownEmails(pk: number, phone: string | null) {
	const said = incoming(pk).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
	return [...new Set([...emailsFor(phone), ...said])];
}

/** Who to invite: e-mails written in the proposal itself first, then the contact's and the chat's. */
const proposalEmails = (p: store.Proposal, phone: string | null) => [
	...new Set([
		...(p.text.toLowerCase().match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []),
		...knownEmails(p.pk, phone),
	]),
];

/** Meetings found in messages: upcoming, one per chat (the latest message wins). */
function proposalList() {
	const byPk = new Map(wa.chats().map((c) => [c.pk, c]));
	const soon = Date.now() - 3_600_000;
	const seen = new Set<string>();
	return store
		.proposals()
		.sort((a, b) => b.at - a.at)
		.filter((p) => {
			const k = String(p.pk); // times get negotiated: the latest proposal in a chat is the live one
			if (seen.has(k) || !p.start) return false;
			seen.add(k);
			return p.status !== "pending" || new Date(p.start).getTime() > soon;
		})
		.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
		.map((p) => {
			const c = byPk.get(p.pk);
			return { ...p, name: c?.name ?? String(p.pk), emails: proposalEmails(p, c?.phone ?? null) };
		});
}

const incoming = (pk: number) =>
	wa
		.messages(pk, 50)
		.filter((m) => !m.mine)
		.map((m) => m.text.toLowerCase())
		.join("\n");

const Decide = z.object({
	pk: z.number().int(),
	lastPk: z.number().int(),
	kind: z.enum(["reply", "done", "skip", "archive", "ignore"]),
	text: z.string().max(4000).optional(),
	/** reply only: also put the time this reply agrees to in the owner's calendar */
	event: z.boolean().optional(),
	/** guests for that event: only addresses that appear in this chat's messages are kept */
	invite: z.array(z.string().email().max(200)).max(5).optional(),
});

app.post("/api/decide", async (c) => {
	const p = Decide.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	const { pk, kind, text } = p.data;
	const lastPk = kind === "ignore" ? 0 : p.data.lastPk;
	const chat = wa.chats().find((x) => x.pk === pk);
	if (!chat) return c.json({ error: "chat" }, 404);
	let via: "whatsapp" | "clipboard" | null = null;
	if (kind === "reply") {
		if (!text?.trim()) return c.json({ error: "text" }, 400);
		// Opens the chat in WhatsApp Desktop with the text typed in. Nothing is sent: the owner presses Enter.
		if (chat.phone) {
			Bun.spawnSync([
				"open",
				`whatsapp://send?phone=${chat.phone}&text=${encodeURIComponent(text)}`,
			]);
			via = "whatsapp";
		} else {
			// no phone number (groups, @lid contacts): copy, and the owner pastes it in the open chat
			Bun.spawnSync(["pbcopy"], { stdin: Buffer.from(text) });
			Bun.spawnSync(["open", "-a", "WhatsApp"]);
			via = "clipboard";
		}
	}
	const draft = kind === "reply" ? (store.drafts().get(pk)?.text ?? null) : null;
	store.decide(pk, lastPk, kind, text ?? null, draft);
	let event = false;
	// a call agreed earlier in the chat, waiting on the invite: independent of what this reply says
	const inv =
		p.data.event && (kind === "reply" || kind === "done")
			? findPendingInvite(wa.messages(pk, 12), store.invitedIn(pk), hasTime)
			: null;
	if (inv) {
		event = true;
		store.eventStart(pk, lastPk, inv.agreed, [inv.email]);
		void scheduleWithGuest(chat.name, inv.agreed, inv.agreedAt, inv.email).then((r) =>
			store.eventDone(pk, lastPk, r.ok ? "ok" : "error", r.result, r.eventId),
		);
	} else if (kind === "reply" && p.data.event && text) {
		// the owner's click is the approval; their Claude creates it in the background (~15 s)
		event = true;
		const said = incoming(pk);
		const invite = (p.data.invite ?? [])
			.map((e) => e.toLowerCase())
			.filter((e) => said.includes(e));
		store.eventStart(pk, lastPk, text, invite);
		void createEvent(chat.name, text, invite).then((r) =>
			store.eventDone(
				pk,
				lastPk,
				r.ok ? "ok" : r.result.startsWith("NAO_CRIADO") ? "skipped" : "error",
				r.result,
				r.eventId,
			),
		);
	}
	return c.json({ ok: true, via, event });
});

// The chat's latest calendar event, so the panel can offer adding the e-mail the person sent afterwards.
app.get("/api/event/:pk", (c) => {
	const e = store.latestEvent(Number(c.req.param("pk")));
	return c.json(
		e && {
			lastPk: e.last_pk,
			when: e.result?.replace(/^CRIADO:\s*/, "") ?? "",
			guests: e.guests?.split(",").filter(Boolean) ?? [],
		},
	);
});

let inviting = false;
// No zapzero event yet (the owner agreed the time in WhatsApp itself): find or create it, with the guest.
app.post("/api/event/schedule", async (c) => {
	const p = z.object({ pk: z.number().int() }).safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	const chat = wa.chats().find((x) => x.pk === p.data.pk);
	const inv =
		chat && findPendingInvite(wa.messages(chat.pk, 12), store.invitedIn(chat.pk), hasTime);
	if (!chat?.lastPk || !inv) return c.json({ error: "invite" }, 404);
	if (inviting) return c.json({ error: "busy" }, 429);
	inviting = true;
	try {
		store.eventStart(chat.pk, chat.lastPk, inv.agreed, [inv.email]);
		const r = await scheduleWithGuest(chat.name, inv.agreed, inv.agreedAt, inv.email);
		store.eventDone(chat.pk, chat.lastPk, r.ok ? "ok" : "error", r.result, r.eventId);
		return c.json(r, r.ok ? 200 : 502);
	} finally {
		inviting = false;
	}
});
app.post("/api/event/invite", async (c) => {
	const p = z
		.object({ pk: z.number().int(), email: z.email().max(200) })
		.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	const email = p.data.email.toLowerCase();
	const e = store.latestEvent(p.data.pk);
	if (!e?.event_id) return c.json({ error: "event" }, 404);
	// only an address the other person actually wrote in this chat
	if (!incoming(p.data.pk).includes(email)) return c.json({ error: "email" }, 400);
	if (inviting) return c.json({ error: "busy" }, 429);
	inviting = true;
	try {
		const r = await addGuest(e.event_id, email);
		if (r.ok) store.eventGuest(e.pk, e.last_pk, email);
		return c.json(r, r.ok ? 200 : 502);
	} finally {
		inviting = false;
	}
});

app.post("/api/undo", async (c) => {
	const p = z
		.object({ pk: z.number().int(), lastPk: z.number().int() })
		.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	store.undecide(p.data.pk, p.data.lastPk);
	return c.json({ ok: true });
});

let drafting = false;
app.post("/api/draft/:pk", async (c) => {
	const chat = wa.chats().find((x) => x.pk === Number(c.req.param("pk")));
	if (!chat?.lastPk) return c.json({ error: "chat" }, 404);
	// {text}: save this draft as is (an agent wrote it, e.g. with times from the owner's calendar). No AI call.
	const body = (await c.req.json().catch(() => ({}))) as { text?: unknown };
	if (typeof body.text === "string") {
		if (!body.text.trim() || body.text.length > 4000) return c.json({ error: "text" }, 400);
		store.saveDraft(chat.pk, chat.lastPk, body.text.trim(), "agent");
		return c.json({ text: body.text.trim() });
	}
	if (drafting) return c.json({ error: "busy" }, 429); // one paid call at a time from the panel
	drafting = true;
	try {
		const r = await ai.draftOne(chat);
		store.spend("drafts", 1, r.cost);
		return c.json({ text: r.text });
	} catch (e) {
		return c.json({ error: (e as Error).message.slice(0, 300) }, 502);
	} finally {
		drafting = false;
	}
});

const Compose = z.object({
	template: z.string().min(1).max(4000),
	picks: z
		.array(z.object({ slot: z.string().max(500), value: z.string().max(500) }))
		.min(1)
		.max(9),
});
// the owner filled the draft's choices: one cheap call rewrites the message around them
app.post("/api/compose/:pk", async (c) => {
	const chat = wa.chats().find((x) => x.pk === Number(c.req.param("pk")));
	if (!chat) return c.json({ error: "chat" }, 404);
	const p = Compose.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	try {
		const r = await ai.compose(chat, p.data.template, p.data.picks);
		store.spend("compose", 1, r.cost);
		return c.json({ text: r.text });
	} catch (e) {
		return c.json({ error: (e as Error).message.slice(0, 300) }, 502);
	}
});

// the owner accepts a meeting found in the messages: their Claude books it (in the background) and invites
// only e-mails we know for that person; or dismisses it
app.post("/api/proposal/:msg", async (c) => {
	const p = store.proposal(Number(c.req.param("msg")));
	if (!p?.start || !p.event) return c.json({ error: "proposal" }, 404);
	const b = z
		.object({
			action: z.enum(["accept", "dismiss"]),
			emails: z.array(z.string()).max(10).default([]),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!b.success) return c.json({ error: "invalid" }, 400);
	if (b.data.action === "dismiss") {
		store.setProposal(p.msg, "dismissed");
		return c.json({ ok: true });
	}
	if (p.status === "booking" || p.status === "booked") return c.json({ ok: true });
	const chat = wa.chats().find((x) => x.pk === p.pk);
	const allowed = proposalEmails(p, chat?.phone ?? null);
	const emails = b.data.emails.filter((e) => allowed.includes(e.toLowerCase()));
	store.setProposal(p.msg, "booking", null, null, emails.join(","));
	void bookProposal(
		chat?.name ?? "",
		p.title ?? "Compromisso",
		p.start,
		p.minutes ?? 60,
		emails,
		p.text,
	)
		.then((r) => store.setProposal(p.msg, r.ok ? "booked" : "error", r.result, r.eventId))
		.catch((e) => store.setProposal(p.msg, "error", String(e).slice(0, 300)));
	return c.json({ ok: true });
});

const Id = z.object({ id: z.string().min(1).max(80) });
app.post("/api/areas/:action", async (c) => {
	const p = Id.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	const action = c.req.param("action");
	if (action === "accept") {
		if (!store.acceptSuggestion(p.data.id)) return c.json({ error: "suggestion" }, 404);
		void refresh(); // re-classify the rest with the new area in the background
	} else if (action === "dismiss") store.dismissSuggestion(p.data.id);
	else if (action === "remove") store.removeArea(p.data.id);
	else return c.json({ error: "action" }, 404);
	return c.json({ ok: true });
});

// Topics left out keep their text, so one topic can be fixed alone. The panel saves everything and accepts;
// an agent fixing one topic for the owner keeps it "suggested" until the owner accepts in the panel.
const VoiceBody = z.object({
	perfil: z.record(z.string(), z.string().max(4000)).default({}),
	voz: z.string().max(8000).optional(),
	state: z.enum(["suggested", "accepted"]).default("accepted"),
});
app.get("/api/voice", (c) => c.json(store.voice()));
app.post("/api/voice", async (c) => {
	const p = VoiceBody.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	const cur = store.voice();
	store.saveVoice(
		{ perfil: { ...cur.perfil, ...p.data.perfil }, voz: p.data.voz ?? cur.voz },
		p.data.state,
	);
	return c.json(store.voice());
});
// the owner keeps some of the learned rules: they go to the end of the voice guide, the rest is dropped
app.post("/api/voice/learned", async (c) => {
	const p = z
		.object({ keep: z.array(z.string().max(300)).max(10) })
		.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	const cur = store.voice();
	if (p.data.keep.length)
		store.saveVoice(
			{
				perfil: cur.perfil,
				voz: [cur.voz, ...p.data.keep.map((r) => `- ${r}`)].filter(Boolean).join("\n"),
			},
			"accepted",
		);
	store.setLearned(null);
	return c.json(store.voice());
});
app.post("/api/voice/learn", async (c) => {
	try {
		await ai.learn(console.log, true);
		return c.json({ learned: store.learned() });
	} catch (e) {
		return c.json({ error: (e as Error).message.slice(0, 300) }, 502);
	}
});
app.post("/api/voice/suggest", async (c) => {
	if (suggesting) return c.json({ error: "busy" }, 429);
	suggesting = true;
	try {
		await ai.suggestVoice();
		return c.json(store.voice());
	} catch (e) {
		return c.json({ error: (e as Error).message.slice(0, 300) }, 502);
	} finally {
		suggesting = false;
	}
});

let suggesting = false;
app.post("/api/suggest", async (c) => {
	if (suggesting) return c.json({ error: "busy" }, 429);
	suggesting = true;
	try {
		await ai.suggest(console.log, true);
		return c.json({ ok: true, count: store.suggestions("pending").length });
	} catch (e) {
		return c.json({ error: (e as Error).message.slice(0, 300) }, 502);
	} finally {
		suggesting = false;
	}
});

app.post("/api/refresh", (c) => {
	void refresh();
	return c.json({ ok: true });
});

app.get("/api/decisions", (c) => {
	const names = new Map(wa.chats().map((x) => [x.pk, x.name]));
	const events = store.events();
	return c.json(
		store.recentDecisions(100).map((d) => {
			const e = events.get(`${d.pk}:${d.last_pk}`);
			return {
				...d,
				name: names.get(d.pk) ?? String(d.pk),
				event: e ? { status: e.status, result: e.result } : null,
			};
		}),
	);
});

let statsCache: { at: number | null; data: ReturnType<typeof stats> } | null = null;
/** Answer performance over the last 13 weeks, plus what was done through zapzero. Cached per snapshot. */
function stats() {
	const who = new Map<number, Who>(
		wa.chats().map((c) => [c.pk, c.group ? "grupo" : c.saved ? "conhecido" : "desconhecido"]),
	);
	const usage: Record<string, Record<string, number>> = {};
	for (const d of store.recentDecisions(100_000)) {
		if (d.kind === "skip") continue;
		const w = weekOf(d.at);
		usage[w] ??= {};
		usage[w][d.kind] = (usage[w][d.kind] ?? 0) + 1;
	}
	return {
		weeks: cohorts(wa.messageLog(91), (pk) => who.get(pk) ?? null),
		usage,
		unread: {
			conhecido: wa
				.chats()
				.filter((c) => !c.group && c.saved)
				.reduce((s, c) => s + c.unread, 0),
			desconhecido: wa
				.chats()
				.filter((c) => !c.group && !c.saved)
				.reduce((s, c) => s + c.unread, 0),
			grupo: wa
				.chats()
				.filter((c) => c.group)
				.reduce((s, c) => s + c.unread, 0),
		},
	};
}
const cachedStats = () => {
	const at = wa.snapshotAt();
	if (statsCache?.at !== at) statsCache = { at, data: stats() };
	return statsCache.data;
};
app.get("/api/stats", (c) => c.json(cachedStats()));

app.all("/api/*", (c) => c.json({ error: "route" }, 404));

// The panel's own files carry no data; inside Studio they load from origin "null" in CORS mode.
app.use("/*", async (c, next) => {
	await next();
	c.header("access-control-allow-origin", "*");
});
app.use("/*", serveStatic({ root: "./dist" }));
app.get("/*", serveStatic({ path: "./dist/index.html" }));

// ---- cli ------------------------------------------------------------------------------------

const cmd = process.argv[2];
if (cmd === "serve") {
	if (!existsSync("dist/index.html"))
		console.warn("dist/ missing: run `bun run build` (or `bun run dev`)");
	Bun.serve({ hostname: "127.0.0.1", port: PORT, fetch: app.fetch, idleTimeout: 60 });
	console.log(`zapzero on http://127.0.0.1:${PORT}  (token in ${"$ZAP_DATA"}/token)`);
	if (REFRESH_MIN > 0) {
		if (wa.snapshotAt() == null || Date.now() - wa.snapshotAt()! > REFRESH_MIN * 60_000)
			void refresh();
		setInterval(() => void refresh(), REFRESH_MIN * 60_000);
	}
} else if (cmd === "snapshot") {
	await wa.snapshot();
	console.log(`${wa.chats().length} chats`);
} else if (cmd === "triage") {
	await ai.triage();
} else if (cmd === "voice") {
	await ai.suggestVoice();
} else if (cmd === "learn") {
	await ai.learn(console.log, true);
} else if (cmd === "suggest") {
	await ai.suggest(console.log, true);
} else if (cmd === "drafts") {
	await ai.drafts();
} else if (cmd === "refresh") {
	await refresh();
} else if (cmd === "api") {
	// `zap api <route> [json]`: the API for agents and scripts. Goes to the running server when there is one
	// (its refresh lock and pipeline), else runs the route in this process. GET without a body, POST with one.
	const [route = "", body] = process.argv.slice(3);
	const init = {
		method: body === undefined ? "GET" : "POST",
		headers: { "x-zap-token": TOKEN, "content-type": "application/json" },
		body,
	};
	const url = `/api/${route.replace(/^\/?(api\/)?/, "")}`;
	const res = await fetch(`http://127.0.0.1:${PORT}${url}`, init).catch(() =>
		app.request(url, init),
	);
	console.log(await res.text());
	process.exit(res.ok ? 0 : 1);
} else if (cmd === "stats") {
	console.log(JSON.stringify(cachedStats(), null, 1));
} else if (cmd === "inbox") {
	const box = buildInbox(
		wa.chats(),
		store.triages(),
		store.drafts(),
		store.decisions(),
		Date.now(),
		pendingInvites(),
	);
	for (const k of CATEGORIES) {
		const items = box[k.id];
		console.log(
			`${k.label}: ${items.length} (${items.filter((i) => i.draft).length} com rascunho)`,
		);
	}
} else {
	console.log(
		"uso: bun server/main.ts serve | snapshot | triage | drafts | suggest | voice | learn | refresh | inbox | stats | api <route> [json]",
	);
	process.exit(1);
}
