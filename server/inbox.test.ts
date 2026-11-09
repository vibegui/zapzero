import { expect, test } from "bun:test";
import { hasTime } from "../web/slots.ts";
import { buildInbox, findPendingInvite, liveProposals } from "./inbox.ts";
import type { Decision, Proposal, Triage } from "./store.ts";
import type { Chat } from "./wa.ts";

const now = Date.UTC(2026, 10, 2);
const day = 86_400_000;
const chat = (pk: number, o: Partial<Chat> = {}): Chat => ({
	pk,
	group: false,
	jid: `${pk}@s.whatsapp.net`,
	name: `c${pk}`,
	phone: String(pk),
	saved: true,
	unread: 1,
	archived: false,
	pinned: false,
	lastPk: pk * 10,
	lastAt: now - day,
	lastMine: false,
	preview: "oi?",
	lastInAt: now - day,
	firstInAt: now - day,
	mine: 5,
	...o,
});
const tri = (pk: number, o: Partial<Triage> = {}): Triage => ({
	pk,
	last_pk: pk * 10,
	espera: "eles_esperam",
	resposta: "sim",
	p_sim: 0.9,
	categoria: "trabalho",
	urgencia: 3,
	acao: "responder",
	area: "clientes",
	area_ver: 1,
	...o,
});

test("categorizes and ranks", () => {
	const chats = [
		chat(1),
		chat(2, { firstInAt: now - 20 * day, lastInAt: now - 20 * day, lastAt: now - 20 * day }),
		chat(3, { lastMine: true }),
		chat(4, { group: true, unread: 30 }),
		chat(5, { group: true, lastAt: now - 200 * day }),
		chat(6, { archived: true }),
		chat(7), // stale triage
		chat(8),
	];
	const t = new Map([
		[1, tri(1)],
		[2, tri(2, { urgencia: 1 })],
		[3, tri(3, { espera: "dono_espera", resposta: "nao", acao: "revisar" })],
		[7, tri(7, { last_pk: 1 })],
		[8, tri(8, { categoria: "empresa", espera: "ninguem", resposta: "nao", acao: "arquivar" })],
	]);
	const box = buildInbox(chats, t, new Map(), new Map(), now);
	expect(box.urgente.map((i) => i.pk)).toEqual([1]);
	expect(box.antigas.map((i) => i.pk)).toEqual([2]);
	expect(box.acompanhar.map((i) => i.pk)).toEqual([3]);
	expect(box.grupos.map((i) => i.pk)).toEqual([4]);
	expect(box.limpeza.map((i) => i.pk).sort()).toEqual([5, 8]);
	expect(box.semana.map((i) => i.pk)).toEqual([7]);
	expect(box.semana[0]?.reason).toBe("aguardando triagem");

	// a decision on the current last message hides it; a new message brings it back
	const dec = new Map<string, Decision>([
		["1:10", { pk: 1, last_pk: 10, kind: "reply", text: "ok", at: now }],
	]);
	expect(buildInbox(chats, t, new Map(), dec, now).urgente).toHaveLength(0);
	// ignored forever: gone even after a new message
	const ign = new Map<string, Decision>([
		["1:0", { pk: 1, last_pk: 0, kind: "ignore", text: null, at: now }],
	]);
	const later = chats.map((c) => (c.pk === 1 ? { ...c, lastPk: 99 } : c));
	expect(
		Object.values(buildInbox(later, t, new Map(), ign, now))
			.flat()
			.map((i) => i.pk),
	).not.toContain(1);
	const moved = chats.map((c) => (c.pk === 1 ? { ...c, lastPk: 11 } : c));
	expect(buildInbox(moved, t, new Map(), dec, now).semana.map((i) => i.pk)).toContain(1);
});

test("pending invite: e-mail after the owner agreed a time", () => {
	const msgs = [
		{ mine: false, at: 1, text: "Quinta 18h BRT funciona?" },
		{ mine: true, at: 2, text: "Quinta às 18h fica ótimo, marco aqui." },
		{ mine: true, at: 3, text: "qual email?" },
		{ mine: false, at: 4, text: "tudo otimo! Ana@Exemplo.com" },
		{ mine: false, at: 5, text: "tks!" },
	];
	expect(findPendingInvite(msgs, new Set(), hasTime)).toEqual({
		email: "ana@exemplo.com",
		agreed: "Quinta às 18h fica ótimo, marco aqui.",
		agreedAt: 2,
	});
	expect(findPendingInvite(msgs, new Set(["ana@exemplo.com"]), hasTime)).toBeNull();
	expect(findPendingInvite(msgs.slice(2), new Set(), hasTime)).toBeNull(); // no time agreed
});

test("liveProposals: latest per chat wins, a dismissed latest hides older ones, past pending drop out", () => {
	const p = (msg: number, pk: number, at: number, start: string, status = "pending") =>
		({
			msg,
			pk,
			at,
			mine: 0,
			text: "",
			event: 1,
			title: "x",
			start,
			minutes: 60,
			status,
			result: null,
			event_id: null,
			guests: null,
		}) as Proposal;
	const now = new Date("2026-11-04T12:00").getTime();
	const list = [
		p(1, 10, 1, "2026-11-05T10:00"),
		p(2, 10, 2, "2026-11-06T15:00", "dismissed"),
		p(3, 20, 1, "2026-11-04T09:00"), // pending, already past
		p(4, 30, 1, "2026-11-04T09:00", "booked"), // booked stays
		p(5, 40, 2, "2026-11-07T10:00"),
		p(6, 40, 1, "2026-11-05T08:00"),
	];
	expect(liveProposals(list, now).map((x) => x.msg)).toEqual([4, 5]);
});

test("someone who asked again, or a direct question, is important or urgent", () => {
	const chats = [
		chat(1, { firstInAt: now - 5 * day, lastInAt: now - 2 * 3_600_000 }), // asked again
		chat(2, { firstInAt: now - 3 * day, lastInAt: now - 3 * day, lastAt: now - 3 * day }), // 3 days
		chat(3, { firstInAt: now - day }), // a direct question from a work contact
		chat(5, { firstInAt: now - day }), // no question, just something to react to: this week
		chat(4, { saved: false, firstInAt: now - 3 * day, lastInAt: now - 3 * day }), // not a contact
	];
	const t = new Map([1, 2, 3, 4].map((pk) => [pk, tri(pk, { urgencia: 1 })]));
	t.set(5, tri(5, { urgencia: 1, espera: "ninguem", resposta: "talvez" }));
	const box = buildInbox(chats, t, new Map(), new Map(), now);
	expect(box.urgente.map((i) => i.pk).sort()).toEqual([1, 2, 3]);
	expect(box.urgente.find((i) => i.pk === 1)?.reason).toBe("trabalho · perguntou de novo");
	expect(box.semana.map((i) => i.pk).sort()).toEqual([4, 5]);
});
