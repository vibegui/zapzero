// The chat model behind drafts, rewrites, profile and suggestions. By default the owner's own Claude
// subscription through Claude Code (headless `claude -p`, no tools, no MCP, no settings), so nothing
// else is needed; a local model through Ollama (nothing leaves the Mac); or OpenRouter. The owner picks
// in setup (kept in zap.sqlite) or with ZAP_LLM.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { CLAUDE } from "./calendar.ts";
import { DATA, DRAFT_MODEL, OPENROUTER_API_KEY } from "./env.ts";
import { kvGet } from "./store.ts";

export type Engine = "claude" | "ollama" | "openrouter";
export const LLM: Engine | "none" =
	(process.env.ZAP_LLM as Engine | undefined) ??
	(kvGet("llm") as Engine | null) ??
	(CLAUDE ? "claude" : OPENROUTER_API_KEY ? "openrouter" : "none");
export const OLLAMA_URL = process.env.ZAP_OLLAMA_URL ?? "http://127.0.0.1:11434";
/** Unset: the first model installed in Ollama. Model choice stays config, never a constant. */
let ollamaModel = process.env.ZAP_OLLAMA_MODEL ?? kvGet("ollama_model") ?? "";

/** Models installed in Ollama, or null when it isn't running. */
export async function ollamaModels(): Promise<string[] | null> {
	try {
		const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
		const j = (await r.json()) as { models?: { name: string }[] };
		return (j.models ?? []).map((m) => m.name);
	} catch {
		return null;
	}
}
/** Claude Code model alias or id; the subscription pays, so a small fast one is the default. */
const CLAUDE_MODEL = process.env.ZAP_CLAUDE_MODEL ?? "haiku";

export const llmLabel = () =>
	LLM === "claude"
		? `Claude (${CLAUDE_MODEL}, sua assinatura)`
		: LLM === "ollama"
			? `Ollama (${ollamaModel || "primeiro modelo instalado"}, local)`
			: LLM === "openrouter"
				? `OpenRouter (${DRAFT_MODEL})`
				: "nenhum";

export function requireLLM() {
	if (LLM === "claude" && !CLAUDE)
		throw new Error("Claude Code não encontrado: instale ou defina ZAP_CLAUDE");
	if (LLM === "openrouter" && !OPENROUTER_API_KEY)
		throw new Error("OPENROUTER_API_KEY missing: put it in .env");
	if (LLM === "none")
		throw new Error(
			"sem modelo: instale o Claude Code (claude.ai/code) ou ponha OPENROUTER_API_KEY no .env",
		);
}

type Ask = { system: string; prompt: string; maxTokens?: number; temperature?: number };

// at most 4 Claude Code processes at once, whoever asks (drafts in a batch, a rewrite from the panel)
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>) {
	if (running >= 4) await new Promise<void>((r) => waiting.push(r));
	running++;
	try {
		return await fn();
	} finally {
		running--;
		waiting.shift()?.();
	}
}

/** One local chat turn on Ollama (OpenAI-free, plain HTTP). `format` is a JSON schema for structured answers. */
function ollama(system: string, prompt: string, format?: unknown, temperature = 0.4) {
	return slot(async () => {
		if (!ollamaModel) {
			const ms = await ollamaModels();
			if (!ms) throw new Error(`Ollama não respondeu em ${OLLAMA_URL}: abra o app do Ollama`);
			if (!ms.length) throw new Error("Ollama sem modelo: rode `ollama pull <modelo>`");
			ollamaModel = ms[0]!;
		}
		const r = await fetch(`${OLLAMA_URL}/api/chat`, {
			method: "POST",
			signal: AbortSignal.timeout(300_000),
			body: JSON.stringify({
				model: ollamaModel,
				stream: false,
				format,
				options: { temperature },
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: prompt },
				],
			}),
		});
		if (!r.ok) throw new Error(`ollama: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
		const j = (await r.json()) as { message?: { content?: string } };
		return (j.message?.content ?? "").trim();
	});
}

/** One headless Claude Code turn: prompt on stdin, the subscription pays (cost reported as 0). */
function claude(system: string, prompt: string) {
	return slot(async () => {
		const p = Bun.spawn(
			[
				CLAUDE!,
				"-p",
				"--model",
				CLAUDE_MODEL,
				"--tools",
				"",
				"--strict-mcp-config",
				"--setting-sources",
				"",
				"--no-session-persistence",
				"--output-format",
				"json",
				"--system-prompt",
				system,
			],
			{ cwd: DATA, stdin: new Blob([prompt]), stdout: "pipe", stderr: "pipe" },
		);
		const timer = setTimeout(() => p.kill(), 120_000);
		const [out, err] = await Promise.all([
			new Response(p.stdout).text(),
			new Response(p.stderr).text(),
		]);
		clearTimeout(timer);
		await p.exited;
		let r: { subtype?: string; result?: string; is_error?: boolean } | undefined;
		try {
			const j = JSON.parse(out);
			r = Array.isArray(j) ? j.at(-1) : j;
		} catch {}
		if (!r || r.is_error || r.subtype !== "success" || typeof r.result !== "string")
			throw new Error(`claude: ${(r?.result || err || out || `exit ${p.exitCode}`).slice(0, 300)}`);
		return r.result.trim();
	});
}

const openrouter = () =>
	createOpenRouter({ apiKey: OPENROUTER_API_KEY })(DRAFT_MODEL, {
		usage: { include: true },
		// short outputs need no thinking; with reasoning on, it ate the token budget and left empty text
		reasoning: { effort: "none" },
	});
const costOf = (meta: unknown) =>
	(meta as { openrouter?: { usage?: { cost?: number } } } | undefined)?.openrouter?.usage?.cost ??
	0;

export async function text(a: Ask): Promise<{ text: string; cost: number }> {
	requireLLM();
	if (LLM === "claude") return { text: await claude(a.system, a.prompt), cost: 0 };
	if (LLM === "ollama")
		return { text: await ollama(a.system, a.prompt, undefined, a.temperature), cost: 0 };
	const r = await generateText({
		model: openrouter(),
		system: a.system,
		prompt: a.prompt,
		maxOutputTokens: a.maxTokens ?? 1000,
		temperature: a.temperature ?? 0.4,
		maxRetries: 2,
	});
	return { text: r.text.trim(), cost: costOf(r.providerMetadata) };
}

/** The first {...} in a reply, parsed: Claude sometimes wraps JSON in a code fence or a sentence. */
/**
 * The message inside <msg></msg>, or "" when the model answered with commentary instead: the small models
 * sometimes reason out loud ("a última msg é…", "o dono…") and that must never reach the owner as a reply.
 */
export function onlyMessage(raw: string) {
	const m = raw.match(/<msg>([\s\S]*?)<\/msg>/i);
	const text = (m ? m[1]! : "").trim();
	return /\b(o dono|do dono|ao dono|rascunho)\b/i.test(text) ? "" : text;
}

export function parseJson(s: string): unknown {
	const a = s.indexOf("{");
	const b = s.lastIndexOf("}");
	if (a < 0 || b < a) throw new Error(`no JSON in reply: ${s.slice(0, 120)}`);
	return JSON.parse(s.slice(a, b + 1));
}

export async function object<S extends z.ZodType>(
	schema: S,
	a: Ask,
): Promise<{ object: z.infer<S>; cost: number }> {
	requireLLM();
	if (LLM === "openrouter") {
		const r = await generateObject({
			model: openrouter(),
			schema,
			system: a.system,
			prompt: a.prompt,
			maxRetries: 2,
		});
		return { object: r.object as z.infer<S>, cost: costOf(r.providerMetadata) };
	}
	if (LLM === "ollama") {
		const json = z.toJSONSchema(schema);
		let last: unknown;
		for (let i = 0; i < 2; i++) {
			try {
				return {
					object: schema.parse(parseJson(await ollama(a.system, a.prompt, json, 0.2))),
					cost: 0,
				};
			} catch (e) {
				last = e;
			}
		}
		throw last;
	}
	const ask = `${a.prompt}\n\nResponda só com um JSON válido neste JSON Schema, sem nada antes ou depois:\n${JSON.stringify(z.toJSONSchema(schema))}`;
	let last: unknown;
	for (let i = 0; i < 2; i++) {
		try {
			return { object: schema.parse(parseJson(await claude(a.system, ask))), cost: 0 };
		} catch (e) {
			last = e;
		}
	}
	throw last;
}
