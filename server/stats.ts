// How the owner answers: weekly cohorts by when a conversation was started with them. Free: snapshot only, no AI.
export type Who = "conhecido" | "desconhecido" | "grupo";
export const WHO: Who[] = ["conhecido", "desconhecido", "grupo"];

export type Week = {
	week: string; // monday, YYYY-MM-DD local
	recebidas: number;
	enviadas: number;
	/** someone spoke after the owner's last message and after a silence: a turn that asks for an answer */
	cobrancas: number;
	resp24h: number;
	resp7d: number;
	semResposta: number;
	medianaH: number | null;
};

export const weekOf = (ms: number) => {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * msgs oldest first. A turn starts at an incoming message that follows one of the owner's (or opens the chat)
 * after `gap` of silence: a live back-and-forth is one conversation, not a turn per message. Answered = owner
 * writes later.
 */
export function cohorts(
	msgs: { pk: number; mine: boolean; at: number }[],
	whoOf: (pk: number) => Who | null,
	gap = 3_600_000,
): Record<Who, Week[]> {
	const byChat = new Map<number, { mine: boolean; at: number }[]>();
	for (const m of msgs) {
		if (!whoOf(m.pk)) continue;
		const l = byChat.get(m.pk) ?? [];
		if (!l.length) byChat.set(m.pk, l);
		l.push(m);
	}
	const acc = new Map<string, Week & { lags: number[] }>();
	const get = (who: Who, week: string) => {
		const k = `${who}|${week}`;
		const w = acc.get(k) ?? {
			week,
			recebidas: 0,
			enviadas: 0,
			cobrancas: 0,
			resp24h: 0,
			resp7d: 0,
			semResposta: 0,
			medianaH: null,
			lags: [],
		};
		acc.set(k, w);
		return w;
	};
	for (const [pk, ms] of byChat) {
		const who = whoOf(pk)!;
		// next owner message at or after each index, from the end: one pass instead of a scan per turn
		const nextMine: (number | null)[] = new Array(ms.length);
		let nxt: number | null = null;
		for (let i = ms.length - 1; i >= 0; i--) {
			if (ms[i]!.mine) nxt = ms[i]!.at;
			nextMine[i] = nxt;
		}
		let prevMine = true;
		ms.forEach((m, i) => {
			const silent = i === 0 || m.at - ms[i - 1]!.at >= gap;
			const w = get(who, weekOf(m.at));
			if (m.mine) {
				w.enviadas++;
				prevMine = true;
				return;
			}
			w.recebidas++;
			if (!prevMine || !silent) return;
			prevMine = false;
			w.cobrancas++;
			const reply = nextMine[i];
			if (reply == null) w.semResposta++;
			else {
				const h = (reply - m.at) / 3_600_000;
				w.lags.push(h);
				if (h <= 24) w.resp24h++;
				if (h <= 168) w.resp7d++;
			}
		});
	}
	const out = { conhecido: [], desconhecido: [], grupo: [] } as Record<Who, Week[]>;
	for (const [k, { lags, ...w }] of acc) {
		lags.sort((a, b) => a - b);
		out[k.split("|")[0] as Who].push({
			...w,
			medianaH: lags.length ? lags[lags.length >> 1]! : null,
		});
	}
	for (const who of WHO) out[who].sort((a, b) => a.week.localeCompare(b.week));
	return out;
}
