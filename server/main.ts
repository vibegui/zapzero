// zapzero: one local process. CLI for the pipeline, and `serve` for the API + panel on 127.0.0.1.
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { z } from "zod";
import * as ai from "./ai.ts";
import { PORT, REFRESH_MIN, TOKEN } from "./env.ts";
import { buildInbox, CATEGORIES } from "./inbox.ts";
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
			wa.snapshot();
			say(`snapshot: ${wa.chats().length} chats`);
			// first scan: propose who the owner is and how they write, before triage and drafts use it
			if (store.voice().state === "empty") await ai.suggestVoice(say);
			await ai.triage(say);
			await ai.drafts(say);
			await ai.suggest(say);
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
	const box = buildInbox(all, store.triages(), store.drafts(), store.decisions());
	return c.json({
		snapshotAt: wa.snapshotAt(),
		refreshing: running != null,
		last,
		spend24h: store.spendSince(86_400_000),
		voice: store.voice(),
		areas: store.areas().map(({ id, label, builtin }) => ({ id, label, builtin: builtin === 1 })),
		suggestions: store.suggestions("pending").map((s) => ({
			...s,
			names: s.pks.map((pk) => names.get(pk) ?? String(pk)),
		})),
		categories: CATEGORIES.map((k) => ({ ...k, items: box[k.id] })),
	});
});

app.get("/api/chat/:pk", (c) => c.json(wa.messages(Number(c.req.param("pk")), 30)));

const Decide = z.object({
	pk: z.number().int(),
	lastPk: z.number().int(),
	kind: z.enum(["reply", "done", "skip", "archive", "ignore"]),
	text: z.string().max(4000).optional(),
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
	store.decide(pk, lastPk, kind, text ?? null);
	return c.json({ ok: true, via });
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

const VoiceBody = z.object({ perfil: z.string().max(4000), voz: z.string().max(8000) });
app.post("/api/voice", async (c) => {
	const p = VoiceBody.safeParse(await c.req.json().catch(() => null));
	if (!p.success) return c.json({ error: "invalid" }, 400);
	store.saveVoice(p.data, "accepted");
	return c.json({ ok: true });
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
	return c.json(
		store.recentDecisions(100).map((d) => ({ ...d, name: names.get(d.pk) ?? String(d.pk) })),
	);
});

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
	wa.snapshot();
	console.log(`${wa.chats().length} chats`);
} else if (cmd === "triage") {
	await ai.triage();
} else if (cmd === "voice") {
	await ai.suggestVoice();
} else if (cmd === "suggest") {
	await ai.suggest(console.log, true);
} else if (cmd === "drafts") {
	await ai.drafts();
} else if (cmd === "refresh") {
	await refresh();
} else if (cmd === "inbox") {
	const box = buildInbox(wa.chats(), store.triages(), store.drafts(), store.decisions());
	for (const k of CATEGORIES) {
		const items = box[k.id];
		console.log(
			`${k.label}: ${items.length} (${items.filter((i) => i.draft).length} com rascunho)`,
		);
	}
} else {
	console.log(
		"uso: bun server/main.ts serve | snapshot | triage | drafts | suggest | voice | refresh | inbox",
	);
	process.exit(1);
}
