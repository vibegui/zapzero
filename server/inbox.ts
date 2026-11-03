// Pure: chats + triage + drafts + decisions -> ranked categories. No I/O, so it is testable.
import type { Decision, Draft, Triage } from "./store.ts";
import type { Chat } from "./wa.ts";

export const CATEGORIES = [
	{ id: "urgente", label: "Importante e urgente" },
	{ id: "semana", label: "Essa semana" },
	{ id: "antigas", label: "Mais de uma semana" },
	{ id: "acompanhar", label: "Você está esperando" },
	{ id: "grupos", label: "Grupos e lazer" },
	{ id: "limpeza", label: "Limpeza" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
/** categories whose items get a drafted reply */
export const REPLY_CATEGORIES: CategoryId[] = ["urgente", "semana", "antigas"];

export type Item = {
	pk: number;
	lastPk: number | null;
	group: boolean;
	name: string;
	phone: string | null;
	saved: boolean;
	category: CategoryId;
	score: number;
	reason: string;
	unread: number;
	lastAt: number | null;
	waitingSince: number | null;
	preview: string;
	draft: string | null;
	triaged: boolean;
};

const DAY = 86_400_000;
const REL: Record<Triage["categoria"], number> = {
	trabalho: 3,
	pessoal: 3,
	servico: 2,
	desconhecido: 1,
	empresa: 0,
	golpe: -2,
};
const CAT_LABEL: Record<Triage["categoria"], string> = {
	trabalho: "trabalho",
	pessoal: "pessoal",
	servico: "serviço",
	desconhecido: "desconhecido",
	empresa: "empresa",
	golpe: "golpe",
};

export function buildInbox(
	chats: Chat[],
	triage: Map<number, Triage>,
	drafts: Map<number, Draft>,
	decided: Map<string, Decision>,
	now = Date.now(),
): Record<CategoryId, Item[]> {
	const out = Object.fromEntries(CATEGORIES.map((c) => [c.id, [] as Item[]])) as Record<
		CategoryId,
		Item[]
	>;
	for (const c of chats) {
		if (c.archived) continue;
		if (decided.has(`${c.pk}:0`)) continue; // ignored forever
		if (c.lastPk != null && decided.has(`${c.pk}:${c.lastPk}`)) continue;
		const age = c.lastAt ? (now - c.lastAt) / DAY : 9999;
		const waitAge = c.lastInAt ? (now - c.lastInAt) / DAY : age;
		const d = drafts.get(c.pk);
		const base = {
			pk: c.pk,
			lastPk: c.lastPk,
			group: c.group,
			name: c.name,
			phone: c.phone,
			saved: c.saved,
			unread: c.unread,
			lastAt: c.lastAt,
			waitingSince: c.lastMine ? null : c.lastInAt,
			preview: c.preview || "(o Mac só sincronizou os últimos ~3 meses: sem texto desta conversa)",
			draft: d && d.last_pk === c.lastPk ? d.text : null,
			triaged: false,
		};
		const put = (category: CategoryId, score: number, reason: string, triaged = false) =>
			out[category].push({ ...base, category, score, reason, triaged });

		if (c.group) {
			if (c.pinned) {
				if (c.unread > 0) put("grupos", 100 + c.unread, "fixado");
			} else if (age >= 30)
				put("limpeza", age, c.mine === 0 ? "grupo parado, você nunca escreveu" : "grupo parado");
			else if (c.unread > 0)
				put(
					"grupos",
					Math.log2(1 + c.unread) + Math.min(Math.log2(1 + c.mine), 4) - age / 7,
					`${c.unread} não lidas`,
				);
			continue;
		}

		if (c.lastPk == null) {
			if (!c.pinned && age >= 90) put("limpeza", age, "sem mensagens sincronizadas há 90+ dias");
			continue;
		}
		const t = triage.get(c.pk);
		if (!t || t.last_pk !== c.lastPk) {
			// not triaged yet for this last message: only surface it if they spoke last
			if (!c.lastMine)
				put(waitAge <= 7 ? "semana" : "antigas", 1 - waitAge / 30, "aguardando triagem");
			continue;
		}
		const rel = REL[t.categoria];
		const score =
			2 * t.urgencia +
			3 * t.p_sim +
			(t.espera === "eles_esperam" ? 2 : 0) +
			rel +
			Math.min(Math.log2(1 + c.mine), 3) +
			(c.saved ? 1 : 0);
		const needsReply =
			!c.lastMine &&
			(t.espera === "eles_esperam" ||
				t.resposta === "sim" ||
				(t.resposta === "talvez" && t.acao === "responder"));
		const label = CAT_LABEL[t.categoria];
		if (needsReply && rel > 0) {
			const urgent = t.urgencia >= 2 && waitAge <= 7;
			put(urgent ? "urgente" : waitAge <= 7 ? "semana" : "antigas", score, label, true);
		} else if (t.espera === "gui_espera" || t.acao === "revisar") {
			put(
				"acompanhar",
				score,
				t.espera === "gui_espera" ? `${label} · você perguntou` : `${label} · revisar`,
				true,
			);
		} else if (t.acao === "arquivar" && !c.pinned && t.espera !== "eles_esperam") {
			const why =
				t.categoria === "empresa" || t.categoria === "golpe"
					? `${label} · nada a fazer`
					: !c.saved && c.mine === 0
						? "fora da agenda, você nunca respondeu"
						: `${label} · conversa encerrada`;
			put("limpeza", age, why, true);
		}
	}
	for (const items of Object.values(out)) items.sort((a, b) => b.score - a.score);
	return out;
}
