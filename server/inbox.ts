// Pure: chats + triage + drafts + decisions -> ranked categories. No I/O, so it is testable.
import type { Decision, Draft, Proposal, Triage } from "./store.ts";
import type { Chat } from "./wa.ts";

export const CATEGORIES = [
	{ id: "urgente", label: "Importante ou urgente" },
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
	/** area id (clientes, hiring…) from triage; null for groups and untriaged chats */
	area: string | null;
	/** they sent an e-mail for a call the owner agreed to, and no zapzero event invites it yet */
	invite: PendingInvite | null;
};

export type PendingInvite = { email: string; agreed: string; agreedAt: number };

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
	invites: Map<number, PendingInvite> = new Map(),
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
			area: c.group ? null : (triage.get(c.pk)?.area ?? null),
			invite: null as PendingInvite | null,
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
		// a pending invite beats triage: "tks!" after the e-mail reads as closed, but the owner still owes the invite
		const inv = invites.get(c.pk);
		if (inv) {
			out.urgente.push({
				...base,
				invite: inv,
				category: "urgente",
				score: 100,
				reason: `convite pendente: mandou ${inv.email}`,
				triaged: true,
			});
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
			// waiting since their first unanswered message; asking again a day later = they need it
			const waited = c.firstInAt ? (now - c.firstInAt) / DAY : waitAge;
			const askedAgain = rel >= 2 && c.firstInAt != null && c.lastInAt! - c.firstInAt >= 0.8 * DAY;
			const ignoredQuestion = t.resposta === "sim" && rel === 3 && c.saved && waited <= 14;
			const urgent =
				(t.urgencia >= 2 && waitAge <= 7) || (askedAgain && waited <= 21) || ignoredQuestion;
			const why =
				askedAgain && waited <= 21
					? `${label} · perguntou de novo`
					: ignoredQuestion
						? waited >= 2
							? `${label} · esperando há ${Math.floor(waited)} dias`
							: `${label} · pergunta direta`
						: label;
			put(urgent ? "urgente" : waitAge <= 7 ? "semana" : "antigas", score, why, true);
		} else if (t.espera === "dono_espera" || t.acao === "revisar") {
			put(
				"acompanhar",
				score,
				t.espera === "dono_espera" ? `${label} · você perguntou` : `${label} · revisar`,
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

/**
 * They wrote an e-mail after the owner proposed or agreed a time ("Quinta às 18h fica ótimo" … "iago@x.ai"),
 * and that e-mail isn't a guest of an event zapzero made. msgs: the chat's last messages, oldest first.
 */
export function findPendingInvite(
	msgs: { mine: boolean; at: number; text: string }[],
	invited: Set<string>,
	hasTime: (t: string) => boolean,
): PendingInvite | null {
	for (let i = msgs.length - 1; i >= 0; i--) {
		const m = msgs[i]!;
		if (m.mine) continue;
		const email = m.text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0]?.toLowerCase();
		if (!email) continue;
		if (invited.has(email)) return null;
		const agreed = msgs
			.slice(0, i)
			.reverse()
			.find((x) => x.mine && hasTime(x.text));
		return agreed ? { email, agreed: agreed.text, agreedAt: agreed.at } : null;
	}
	return null;
}

/**
 * Meetings to show: the latest proposal per chat only (times get negotiated), hidden once dismissed,
 * and pending ones only while they are still ahead (an hour of slack). Soonest first.
 */
export function liveProposals(list: Proposal[], now: number): Proposal[] {
	const seen = new Set<number>();
	return [...list]
		.sort((a, b) => b.at - a.at)
		.filter((p) => {
			if (seen.has(p.pk)) return false;
			seen.add(p.pk);
			if (!p.start || p.status === "dismissed") return false;
			if (p.status === "pending" && p.mine) return false; // the owner proposed: waiting on them, not on the owner
			return p.status !== "pending" || new Date(p.start).getTime() > now - 3_600_000;
		})
		.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
}
