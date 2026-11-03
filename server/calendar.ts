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
Termine com uma linha só: "CRIADO: <dia e hora>" ou "NAO_CRIADO: <motivo>".`;
}

/** Runs the owner's Claude with only the calendar tool allowed. Never throws: returns what happened. */
export async function createEvent(
	name: string,
	reply: string,
	invite: string[] = [],
): Promise<{ ok: boolean; result: string }> {
	if (!CLAUDE) return { ok: false, result: "Claude Code não encontrado (defina ZAP_CLAUDE)" };
	const args = [
		CLAUDE,
		"-p",
		eventPrompt(name, reply, invite),
		"--tools",
		"",
		"--allowedTools",
		CALENDAR_TOOL,
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
	const last = out.trim().split("\n").at(-1)?.trim() ?? "";
	if (p.exitCode !== 0)
		return { ok: false, result: (err || out).trim().slice(0, 300) || `exit ${p.exitCode}` };
	return { ok: last.startsWith("CRIADO"), result: last.slice(0, 300) || out.trim().slice(0, 300) };
}
