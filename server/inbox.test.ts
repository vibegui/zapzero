import { expect, test } from "bun:test";
import { buildInbox } from "./inbox.ts";
import type { Decision, Triage } from "./store.ts";
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
	...o,
});

test("categorizes and ranks", () => {
	const chats = [
		chat(1),
		chat(2, { lastInAt: now - 20 * day, lastAt: now - 20 * day }),
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
		[3, tri(3, { espera: "gui_espera", resposta: "nao", acao: "revisar" })],
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
