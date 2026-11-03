// bun run setup: checks what zapzero needs on this Mac, builds the panel, and installs a launchd agent
// so the server starts at login. Safe to run again. Pass --no-launchd to skip the agent.
import { existsSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { DATA, OPENROUTER_API_KEY, PORT, TOKEN, WA_DIR } from "../server/env.ts";
import { LLM, llmLabel } from "../server/llm.ts";
import * as wa from "../server/wa.ts";

const LABEL = "dev.zapzero.server";
const PLIST = `${homedir()}/Library/LaunchAgents/${LABEL}.plist`;
const LOG = `${homedir()}/Library/Logs/zapzero.log`;
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

if (LLM === "none")
	fail(
		"no model to read your chats",
		"Install Claude Code (https://claude.com/claude-code) and log in: zapzero uses your Claude subscription.\nOr put OPENROUTER_API_KEY in .env (cp .env.example .env).",
	);
ok(`model: ${llmLabel()}`);
ok(
	OPENROUTER_API_KEY
		? "triage: Jev on OpenRouter (fast, fractions of a cent)"
		: "triage: your Claude, in batches (optional: OPENROUTER_API_KEY in .env unlocks Jev, faster and cheaper)",
);

console.log("\n  building the panel…");
if (run(["bun", "run", "build"]).exitCode !== 0)
	fail("build failed", "Run `bun run build` to see why.");
ok("panel built");

if (!process.argv.includes("--no-launchd")) {
	mkdirSync(`${homedir()}/Library/LaunchAgents`, { recursive: true });
	const bunDir = process.execPath.replace(/\/[^/]+$/, "");
	writeFileSync(
		PLIST,
		`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array><string>${process.execPath}</string><string>server/main.ts</string><string>serve</string></array>
	<key>WorkingDirectory</key><string>${process.cwd()}</string>
	<key>EnvironmentVariables</key>
	<dict><key>PATH</key><string>${bunDir}:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
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
