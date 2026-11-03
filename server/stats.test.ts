import { expect, test } from "bun:test";
import { cohorts, weekOf } from "./stats.ts";

const H = 3_600_000;
const t0 = new Date(2026, 9, 5, 10).getTime(); // monday 5 Oct 2026, 10:00

test("turns, replies within 24h / 7d, unanswered, median", () => {
	const msgs = [
		// chat 1: asks, owner answers in 2h; asks twice more, owner answers 30h later (one turn)
		{ pk: 1, mine: false, at: t0 },
		{ pk: 1, mine: true, at: t0 + 2 * H },
		{ pk: 1, mine: false, at: t0 + 3 * H },
		{ pk: 1, mine: false, at: t0 + 4 * H },
		{ pk: 1, mine: true, at: t0 + 33 * H },
		// live back-and-forth 10 min later: not a new turn
		{ pk: 1, mine: false, at: t0 + 33 * H + 600_000 },
		// chat 2: stranger, never answered
		{ pk: 2, mine: false, at: t0 + H },
		// chat 3: group, ignored by whoOf → not counted
		{ pk: 3, mine: false, at: t0 },
	];
	const r = cohorts(msgs, (pk) => (pk === 1 ? "conhecido" : pk === 2 ? "desconhecido" : null));
	const k = r.conhecido[0]!;
	expect(k.week).toBe(weekOf(t0));
	expect([k.recebidas, k.enviadas, k.cobrancas, k.resp24h, k.resp7d, k.semResposta]).toEqual([
		4, 2, 2, 1, 2, 0,
	]);
	expect(k.medianaH).toBe(30);
	expect(r.desconhecido[0]!.semResposta).toBe(1);
	expect(r.grupo).toEqual([]);
});
