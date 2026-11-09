// bun scripts/selfcheck.ts: runs the whole read pipeline (snapshot → chats → messages → inbox → stats)
// against a made-up WhatsApp database in a temp folder. No AI calls, never touches the real WhatsApp or data.
// Its own process on purpose: env.ts reads ZAP_WA_DIR / ZAP_DATA once, at first import.
import { deepStrictEqual as eq, ok } from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { FAKE, makeFakeWhatsApp } from "../server/fixture.ts";

const root = mkdtempSync(`${tmpdir()}/zapzero-selfcheck-`);
try {
	const waDir = `${root}/wa`;
	const data = `${root}/data`;
	mkdirSync(waDir);
	makeFakeWhatsApp(waDir);
	process.env.ZAP_WA_DIR = waDir;
	process.env.ZAP_DATA = data;

	const env = await import("../server/env.ts");
	// env.ts was loaded before the override: a snapshot now would overwrite the real copy
	if (env.WA_DIR !== waDir || env.DATA !== data)
		throw new Error("env.ts loaded before the override");
	const wa = await import("../server/wa.ts");
	const { buildInbox, REPLY_CATEGORIES } = await import("../server/inbox.ts");
	const { cohorts } = await import("../server/stats.ts");

	const hash = () =>
		["ChatStorage.sqlite", "ContactsV2.sqlite"].map((f) =>
			new Bun.CryptoHasher("sha256").update(readFileSync(`${waDir}/${f}`)).digest("hex"),
		);
	const before = hash();
	await wa.snapshot();
	eq(hash(), before, "snapshot modified the WhatsApp files");

	const chats = wa.chats();
	const by = (pk: number) => chats.find((c) => c.pk === pk)!;
	eq(chats.length, 6, "chat count");
	eq(
		chats.map((c) => [c.pk, c.name, c.phone, c.group, c.pinned, c.saved]).sort(),
		[
			[FAKE.waiting, "Ana Souza", "5511900000001", false, false, true],
			[FAKE.answered, "Bruno Lima", "5511900000002", false, false, true],
			[FAKE.group, "Família Teste", null, true, false, false],
			[FAKE.lid, "~Diego · +5511900000004", "5511900000004", false, false, false],
			[FAKE.image, "Elisa Rocha", "5511900000005", false, false, false],
			[FAKE.pinned, "Fábio Melo", "5511900000006", false, true, true],
		].sort(),
		"chats: name, phone, group, pinned, saved",
	);
	ok(!by(FAKE.waiting).lastMine && by(FAKE.answered).lastMine, "who spoke last");
	eq(by(FAKE.group).preview, "Carla Dias: Eu levo!", "group preview skips system messages");
	eq(by(FAKE.image).preview, "[imagem]", "image preview");

	eq(
		wa.messages(FAKE.waiting).map((m) => [m.mine, m.who, m.text]),
		[
			[true, "Você", "Oi Ana, tudo bem?"],
			[false, "", "Você consegue revisar a proposta até sexta?"],
		],
		"messages oldest first",
	);
	eq(wa.messages(FAKE.group).length, 2, "system message skipped");
	eq(wa.messages(FAKE.image)[0]?.media, true, "image message has media");

	const inbox = buildInbox(chats, new Map(), new Map(), new Map());
	const where = (pk: number) =>
		Object.entries(inbox).find(([, items]) => items.some((i) => i.pk === pk))?.[0];
	ok(
		REPLY_CATEGORIES.includes(where(FAKE.waiting) as never),
		`waiting DM in a reply category (got ${where(FAKE.waiting)})`,
	);
	ok(
		!REPLY_CATEGORIES.includes(where(FAKE.answered) as never),
		"DM the owner answered isn't asking for a reply",
	);

	const who = new Map(
		chats.map((c) => [
			c.pk,
			c.group ? ("grupo" as const) : c.saved ? ("conhecido" as const) : ("desconhecido" as const),
		]),
	);
	const weeks = cohorts(wa.messageLog(91), (pk) => who.get(pk) ?? null);
	const sum = (k: "recebidas" | "enviadas") =>
		Object.values(weeks)
			.flat()
			.reduce((n, w) => n + w[k], 0);
	eq([sum("recebidas"), sum("enviadas")], [7, 3], "stats: messages in and out");

	// e-mail base: a suggestion never overrides the owner's "nao", and only "ok" ones go to invites
	const store = await import("../server/store.ts");
	const emails = await import("../server/emails.ts");
	const ana = by(FAKE.waiting).phone!;
	store.saveEmail({
		phone: ana,
		email: "ana@x.co",
		source: "calendario",
		status: "sugerido",
		note: null,
	});
	eq(emails.acceptedFor(ana), [], "a suggestion isn't used yet");
	store.saveEmail({
		phone: ana,
		email: "ana@x.co",
		source: "calendario",
		status: "nao",
		note: null,
	});
	store.saveEmail({
		phone: ana,
		email: "ana@x.co",
		source: "calendario",
		status: "sugerido",
		note: null,
	});
	eq(store.emailRows()[0]?.status, "nao", "a new suggestion doesn't undo the owner's no");
	store.saveEmail({
		phone: ana,
		email: "ana@x.co",
		source: "calendario",
		status: "ok",
		note: null,
	});
	eq(emails.acceptedFor(ana), ["ana@x.co"], "accepted e-mail is used");
	ok(
		emails
			.base()
			.find((p) => p.phone === ana)
			?.emails.some((e) => e.email === "ana@x.co"),
		"base lists it",
	);

	console.log(`selfcheck ok: ${chats.length} fake chats read, inbox and stats built`);
} finally {
	rmSync(root, { recursive: true, force: true });
}
