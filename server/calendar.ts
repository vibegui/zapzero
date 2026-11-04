// After the owner replies with a time, their own Claude (Claude Code, headless) puts it in their calendar.
// zapzero holds no calendar credentials: the owner's Claude already has a calendar connector.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { DATA } from "./env.ts";

const CANDIDATES = [
	`${homedir()}/.local/bin/claude`,
	"/opt/homebrew/bin/claude",
	"/usr/local/bin/claude",
];
export const CLAUDE = process.env.ZAP_CLAUDE ?? CANDIDATES.find((p) => existsSync(p)) ?? null;
/** The one tool the headless Claude may call. Any other tool (built-in or MCP) is denied. */
export const CALENDAR_TOOL =
	process.env.ZAP_CALENDAR_TOOL ?? "mcp__claude_ai_Google_Calendar__create_event";
/** For adding a guest later: the only tool that second run may call. */
export const CALENDAR_UPDATE_TOOL =
	process.env.ZAP_CALENDAR_UPDATE_TOOL ?? "mcp__claude_ai_Google_Calendar__update_event";
const MODEL = process.env.ZAP_AGENT_MODEL; // unset: the owner's Claude Code default

export function eventPrompt(name: string, reply: string, invite: string[] = [], now = new Date()) {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const today = now.toLocaleString("pt-BR", {
		timeZone: tz,
		dateStyle: "full",
		timeStyle: "short",
	});
	return `Eu (o dono deste WhatsApp) acabei de responder a uma conversa. Crie UM evento no meu calendário para o que eu combinei, usando a ferramenta de criar evento.

Agora: ${today} (fuso ${tz}).
Contato: «${name.replace(/[«»\n]/g, " ").slice(0, 60)}»
Minha resposta: «${reply.replace(/[«»]/g, '"').slice(0, 1000)}»

Regras:
- Data e hora vêm só da minha resposta (hoje, amanhã, dia da semana, horário). Sem dia explícito, é hoje se o horário ainda não passou, senão o próximo dia útil.
- Duração: a que a resposta disser; senão 30 minutos.
- Título: "Call · <contato>" (ou o assunto, se a resposta disser). Descrição: "Combinado pelo WhatsApp (zapzero)".
${
	invite.length
		? `- Convide exatamente estes e-mails, e nenhum outro: ${invite.join(", ")}. Com convidados, inclua um link de videochamada (Google Meet) se a ferramenta permitir.`
		: "- Sem convidados e sem videochamada: o evento é só no meu calendário."
}
- Se a resposta não tiver um horário combinado, não crie nada.
Termine com uma linha só: "CRIADO: <id do evento> | <dia e hora>" ou "NAO_CRIADO: <motivo>".`;
}

export function invitePrompt(eventId: string, email: string) {
	return `No meu calendário, adicione um convidado ao evento ${eventId}, com a ferramenta de editar evento:
- adicione só ${email} como convidado (os convidados que já estão continuam);
- inclua um link de videochamada (Google Meet) se ainda não tiver;
- mande o convite por e-mail a ele;
- não mude data, horário, título nem nada mais.
Termine com uma linha só: "ADICIONADO: ${email}" ou "ERRO: <motivo>".`;
}

/** Runs the owner's Claude with one calendar tool allowed (nothing built-in). Never throws. */
async function run(
	prompt: string,
	tool: string | string[],
): Promise<{ code: number; last: string; all: string }> {
	if (!CLAUDE) return { code: -1, last: "", all: "Claude Code não encontrado (defina ZAP_CLAUDE)" };
	const args = [
		CLAUDE,
		"-p",
		prompt,
		"--tools",
		"",
		"--allowedTools",
		...[tool].flat(),
		"--no-session-persistence",
	];
	if (MODEL) args.push("--model", MODEL);
	const p = Bun.spawn(args, { cwd: DATA, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
	const timer = setTimeout(() => p.kill(), 180_000);
	const [out, err] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
	]);
	clearTimeout(timer);
	await p.exited;
	const all = (p.exitCode === 0 ? out : err || out).trim();
	return { code: p.exitCode ?? -1, last: out.trim().split("\n").at(-1)?.trim() ?? "", all };
}

/** Creates the event the owner's reply agrees to. `eventId` comes back so a guest can be added later. */
export async function createEvent(
	name: string,
	reply: string,
	invite: string[] = [],
): Promise<{ ok: boolean; result: string; eventId: string | null }> {
	const r = await run(eventPrompt(name, reply, invite), CALENDAR_TOOL);
	if (r.code !== 0)
		return { ok: false, result: r.all.slice(0, 300) || `exit ${r.code}`, eventId: null };
	const m = r.last.match(/^CRIADO:\s*([\w-]+)\s*\|\s*(.+)$/);
	if (m) return { ok: true, result: `CRIADO: ${m[2]}`, eventId: m[1]! };
	return {
		ok: r.last.startsWith("CRIADO"),
		result: r.last.slice(0, 300) || r.all.slice(0, 300),
		eventId: null,
	};
}

export async function addGuest(
	eventId: string,
	email: string,
): Promise<{ ok: boolean; result: string }> {
	const r = await run(invitePrompt(eventId, email), CALENDAR_UPDATE_TOOL);
	if (r.code !== 0) return { ok: false, result: r.all.slice(0, 300) || `exit ${r.code}` };
	return {
		ok: r.last.startsWith("ADICIONADO"),
		result: r.last.slice(0, 300) || r.all.slice(0, 300),
	};
}

/** For "schedule with guest": look first (an event may exist already), then create or add the guest. */
const SCHEDULE_TOOLS = [
	process.env.ZAP_CALENDAR_LIST_TOOL ?? "mcp__claude_ai_Google_Calendar__list_events",
	CALENDAR_TOOL,
	CALENDAR_UPDATE_TOOL,
];

export function schedulePrompt(name: string, agreed: string, agreedAt: number, email: string) {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const when = new Date(agreedAt).toLocaleString("pt-BR", {
		timeZone: tz,
		dateStyle: "full",
		timeStyle: "short",
	});
	return `Eu (o dono deste WhatsApp) combinei uma call e a pessoa me mandou o e-mail para o convite. Garanta que ela está convidada.

Contato: «${name.replace(/[«»\n]/g, " ").slice(0, 60)}» · e-mail: ${email}
O que eu escrevi, em ${when} (fuso ${tz}): «${agreed.replace(/[«»]/g, '"').slice(0, 1000)}»

1. Descubra a data e a hora a partir do que eu escrevi, contando a partir do dia em que escrevi (não de hoje). Duração: a que eu disse, senão 30 min.
2. Liste meus eventos nesse dia. Se já houver um evento nesse horário (± 1 h) que seja essa call (título ou convidados com o contato), adicione ${email} como convidado nele, com link do Meet se não tiver.
3. Senão, crie o evento: título "Call · <contato>", descrição "Combinado pelo WhatsApp (zapzero)", convidado ${email}, com Meet.
Convide só ${email}. Não apague nem mude horário de nenhum evento.
Termine com uma linha só: "CRIADO: <id do evento> | <dia e hora>", "ADICIONADO: <id do evento> | <dia e hora>" ou "ERRO: <motivo>".`;
}

export async function scheduleWithGuest(
	name: string,
	agreed: string,
	agreedAt: number,
	email: string,
): Promise<{ ok: boolean; result: string; eventId: string | null }> {
	const r = await run(schedulePrompt(name, agreed, agreedAt, email), SCHEDULE_TOOLS);
	if (r.code !== 0)
		return { ok: false, result: r.all.slice(0, 300) || `exit ${r.code}`, eventId: null };
	const m = r.last.match(/^(CRIADO|ADICIONADO):\s*([\w-]+)\s*\|\s*(.+)$/);
	if (m) return { ok: true, result: `CRIADO: ${m[3]}`, eventId: m[2]! };
	return { ok: false, result: r.last.slice(0, 300) || r.all.slice(0, 300), eventId: null };
}

/** A meeting found in the messages, accepted by the owner: find it in the calendar or create it, invite who's known. */
export function bookPrompt(
	name: string,
	title: string,
	start: string,
	minutes: number,
	emails: string[],
	text: string,
) {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return `Eu (o dono deste WhatsApp) aceitei marcar este compromisso no meu calendário.

Contato: «${name.replace(/[«»\n]/g, " ").slice(0, 60)}»
Mensagem: «${text.replace(/[«»]/g, '"').slice(0, 600)}»
Título: «${title.replace(/[«»\n]/g, " ").slice(0, 80)}»
Início: ${start} (fuso ${tz}) · duração: ${minutes} min

1. Liste meus eventos nesse dia. Se já houver um evento nesse horário (± 1 h) que seja esse compromisso, não crie outro${emails.length ? `: adicione ${emails.join(", ")} como convidado(s) nele se eu for o organizador; se o evento for de outra pessoa (não dá pra convidar), deixe como está` : ""} e responda EXISTE.
2. Senão, crie o evento com esse título e horário, descrição "Combinado pelo WhatsApp (zapzero)"${emails.length ? `, convidados ${emails.join(", ")} e link de videochamada (Google Meet) se for call` : ", sem convidados"}.
${emails.length ? `Convide só ${emails.join(", ")}.` : "Não convide ninguém."} Não apague nem mude nenhum outro evento.
Termine com uma linha só: "CRIADO: <id do evento> | <dia e hora>", "EXISTE: <id do evento> | <dia e hora>" ou "ERRO: <motivo>".`;
}

export async function bookProposal(
	name: string,
	title: string,
	start: string,
	minutes: number,
	emails: string[],
	text: string,
): Promise<{ ok: boolean; result: string; eventId: string | null }> {
	const r = await run(bookPrompt(name, title, start, minutes, emails, text), SCHEDULE_TOOLS);
	if (r.code !== 0)
		return { ok: false, result: r.all.slice(0, 300) || `exit ${r.code}`, eventId: null };
	const m = r.last.match(/^(CRIADO|EXISTE):\s*([\w-]+)\s*\|\s*(.+)$/);
	if (m) return { ok: true, result: `${m[1]}: ${m[3]}`, eventId: m[2]! };
	return { ok: false, result: r.last.slice(0, 300) || r.all.slice(0, 300), eventId: null };
}

/**
 * Meetings found in messages that are already in the calendar: one Claude run, read-only (list events
 * only), over the days of all the proposals. Returns the ids it found, with the event id when it saw one.
 */
export function checkPrompt(items: { id: number; title: string; name: string; start: string }[]) {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return `Confira na minha agenda quais destes compromissos já estão marcados. Use só a ferramenta de listar eventos, nos dias deles (fuso ${tz}). Não crie nem mude nada.
Conta como marcado um evento no mesmo dia, até 2 h antes ou depois, que seja esse compromisso (título, pessoa ou convidado batem).

${items.map((i) => `- id ${i.id}: «${i.title.replace(/[«»\n]/g, " ")}» com «${i.name.replace(/[«»\n]/g, " ").slice(0, 60)}» em ${i.start}`).join("\n")}

Termine com uma linha só, em JSON: {"marcados":[{"id":<id>,"evento":"<id do evento>"}]} (lista vazia se nenhum).`;
}

export async function alreadyBooked(
	items: { id: number; title: string; name: string; start: string }[],
): Promise<Map<number, string> | null> {
	if (!items.length) return new Map();
	const r = await run(checkPrompt(items), SCHEDULE_TOOLS[0]!);
	if (r.code !== 0) return null;
	try {
		const j = JSON.parse(r.last.slice(r.last.indexOf("{"))) as {
			marcados?: { id: number; evento?: string }[];
		};
		return new Map((j.marcados ?? []).map((m) => [Number(m.id), m.evento ?? ""]));
	} catch {
		return null;
	}
}
