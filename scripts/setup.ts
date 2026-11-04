// bun run setup: checks what zapzero needs on this Mac, builds the panel, and installs a launchd agent
// so the server starts at login. Safe to run again. Pass --no-launchd to skip the agent.
import { existsSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { CLAUDE } from "../server/calendar.ts";
import { DATA, OPENROUTER_API_KEY, PORT, TOKEN, WA_DIR } from "../server/env.ts";
import { type Engine, ollamaModels } from "../server/llm.ts";
import { kvGet, kvSet } from "../server/store.ts";
import * as wa from "../server/wa.ts";

const LABEL = "dev.zapzero.server";
const PLIST = `${homedir()}/Library/LaunchAgents/${LABEL}.plist`;
const LOG = `${homedir()}/Library/Logs/zapzero.log`;
const SERVER = `${DATA}/bin/zapzero`;
const ok = (s: string) => console.log(`  ✓ ${s}`);
const fail = (s: string, fix: string) => {
	console.log(`  ✗ ${s}\n    ${fix.replaceAll("\n", "\n    ")}`);
	process.exit(1);
};
const run = (cmd: string[]) => Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });

console.log("zapzero setup\n");

if (platform() !== "darwin")
	fail("macOS required", "zapzero reads the WhatsApp Desktop app's database on a Mac.");
ok("macOS");

if (run(["which", "sqlite3"]).exitCode !== 0)
	fail("sqlite3 not found", "It ships with macOS: check your PATH.");
ok("sqlite3");

const check = run(["bun", `${import.meta.dir}/selfcheck.ts`]);
if (check.exitCode !== 0)
	fail(
		"self-check failed: zapzero can't read a sample WhatsApp database on this machine",
		`Nothing was read from your WhatsApp. Run \`bun run selfcheck\` to see why.\n${check.stderr.toString().trim().split("\n").slice(-3).join("\n")}`,
	);
ok("self-check on a sample database");

if (!existsSync(WA_DIR))
	fail(
		"WhatsApp Desktop data not found",
		"Install WhatsApp from the Mac App Store or whatsapp.com, link it to your phone, and let it sync.",
	);
try {
	await wa.snapshot();
} catch (e) {
	fail(
		"can't read WhatsApp's database",
		`macOS blocks it until you allow it. System Settings → Privacy & Security → Full Disk Access:
add your terminal app, and also ${process.execPath}
(the second one lets the background agent read it too). Then run setup again.
Detail: ${(e as Error).message.slice(0, 200)}`,
	);
}
ok(`read-only snapshot: ${wa.chats().length} chats`);

// Two choices, asked once and kept in zap.sqlite: panel language and which AI reads the chats.
// Flags skip the questions (--lang=en, --llm=ollama); without a terminal, the saved or default answer stays.
const flag = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const ask = (q: string, def: string) =>
	process.stdin.isTTY ? prompt(`  ${q} [${def}]`)?.trim() || def : def;

const sysLang = (process.env.LANG ?? "").startsWith("pt") ? "pt" : "en";
const lang =
	flag("lang") ?? ask("Panel language / idioma do painel (pt, en)", kvGet("lang") ?? sysLang);
if (lang !== "pt" && lang !== "en") fail(`unknown language "${lang}"`, "Use pt or en.");
kvSet("lang", lang);
ok(`panel language: ${lang}`);

const local = await ollamaModels();
const engines: { id: Engine; label: string }[] = [];
if (CLAUDE)
	engines.push({ id: "claude", label: "Claude, on your Claude subscription (Claude Code)" });
if (local?.length)
	engines.push({
		id: "ollama",
		label: `local model with Ollama (${local.join(", ")}): nothing leaves your Mac`,
	});
if (OPENROUTER_API_KEY)
	engines.push({ id: "openrouter", label: "OpenRouter, with your key (pay per use)" });
if (!engines.length)
	fail(
		"no model to read your chats",
		"Install Claude Code (https://claude.com/claude-code) and log in, or Ollama (https://ollama.com) with a model,\nor put OPENROUTER_API_KEY in .env (cp .env.example .env).",
	);
const saved = kvGet("llm");
let engine =
	(flag("llm") as Engine | undefined) ?? engines.find((e) => e.id === saved)?.id ?? engines[0]!.id;
if (!flag("llm") && engines.length > 1 && process.stdin.isTTY) {
	console.log("  Which AI reads your chats?");
	for (const [i, e] of engines.entries()) console.log(`    ${i + 1}. ${e.label}`);
	const n = Number(ask("Pick a number", String(engines.findIndex((e) => e.id === engine) + 1)));
	engine = engines[n - 1]?.id ?? engine;
}
if (!engines.some((e) => e.id === engine))
	fail(`"${engine}" isn't available here`, engines.map((e) => e.id).join(", "));
kvSet("llm", engine);
if (engine === "ollama" && local?.length) {
	const m =
		local.length > 1 && process.stdin.isTTY
			? ask(`Ollama model (${local.join(", ")})`, kvGet("ollama_model") || local[0]!)
			: kvGet("ollama_model") || local[0]!;
	kvSet("ollama_model", m);
	ok(`AI: Ollama, ${m} (local)`);
} else ok(`AI: ${engines.find((e) => e.id === engine)!.label}`);
ok(
	OPENROUTER_API_KEY
		? "triage: Jev on OpenRouter (fast, fractions of a cent)"
		: "triage: the AI above, in batches (optional: OPENROUTER_API_KEY in .env unlocks Jev, faster and cheaper)",
);

console.log("\n  building the panel…");
if (run(["bun", "run", "build"]).exitCode !== 0)
	fail("build failed", "Run `bun run build` to see why.");
ok("panel built");

if (!process.argv.includes("--no-launchd")) {
	// The background server is its own small binary, so Full Disk Access (or the "access data from other
	// apps" answer) goes to zapzero alone, not to bun, which runs every other script on the machine.
	// Built once: the same file keeps its permission; updates only change the code it runs.
	mkdirSync(`${DATA}/bin`, { recursive: true });
	if (!existsSync(SERVER)) {
		if (
			run(["bun", "build", "scripts/launcher.ts", "--compile", "--outfile", SERVER]).exitCode !== 0
		)
			fail("server build failed", "Run `bun build scripts/launcher.ts --compile` to see why.");
		run(["codesign", "-s", "-", "-f", "-i", LABEL, SERVER]);
	}
	ok(`server program: ${SERVER}`);
	mkdirSync(`${homedir()}/Library/LaunchAgents`, { recursive: true });
	writeFileSync(
		PLIST,
		`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array><string>${SERVER}</string><string>server/main.ts</string><string>serve</string></array>
	<key>WorkingDirectory</key><string>${process.cwd()}</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
		<key>BUN_BE_BUN</key><string>1</string>
	</dict>
	<key>RunAtLoad</key><true/>
	<key>KeepAlive</key><true/>
	<key>ThrottleInterval</key><integer>30</integer>
	<key>StandardOutPath</key><string>${LOG}</string>
	<key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
`,
	);
	const uid = process.getuid?.() ?? 501;
	run(["launchctl", "bootout", `gui/${uid}/${LABEL}`]); // reload if it was already there
	// bootout finishes asynchronously: bootstrap fails with "5: Input/output error" until it has
	let r = run(["launchctl", "bootstrap", `gui/${uid}`, PLIST]);
	for (let i = 0; i < 10 && r.exitCode !== 0; i++) {
		Bun.sleepSync(500);
		r = run(["launchctl", "bootstrap", `gui/${uid}`, PLIST]);
	}
	if (r.exitCode !== 0) fail("launchd agent failed to load", r.stderr.toString().slice(0, 300));
	ok(`runs at login (launchd ${LABEL}, log ${LOG})`);
	console.log(`  macOS asks before the server reads WhatsApp's folder. So it stops asking, give Full Disk Access
  to the server binary only (not bun): System Settings → Privacy & Security → Full Disk Access → +
  → ${SERVER}
  Done once: updates don't touch that file, so the permission stays.`);
} else {
	console.log("  – skipped launchd: start it with `bun run start`");
}

// Claude Code skill: lets Claude call zapzero from any session (`zap api …`). A link, so it follows the repo.
if (existsSync(`${homedir()}/.claude`)) {
	const dest = `${homedir()}/.claude/skills/zapzero`;
	mkdirSync(`${homedir()}/.claude/skills`, { recursive: true });
	let there = false;
	try {
		there = lstatSync(dest) != null;
	} catch {}
	if (!there) symlinkSync(`${process.cwd()}/skills/zapzero`, dest);
	ok(there ? `Claude skill already at ${dest}` : `Claude skill linked: ${dest}`);
}

console.log(`
Open the panel:  http://127.0.0.1:${PORT}/?t=${TOKEN}
Data lives in:   ${DATA}

The first scan triages your chats and reads how you write. Check "Seu jeito" in the
sidebar: accept or edit it, and the drafts follow it.`);
