// `zap archive [--limit=N] [--dry]`: carries out the owner's "archive" decisions in WhatsApp Desktop.
// The owner runs it (or clicks it); it never decides on its own what to archive. One chat every 3–5 s,
// at most `limit` per run, and the next snapshot shows what WhatsApp actually archived.
import * as store from "./store.ts";
import * as wa from "./wa.ts";

const SCRIPT = `${import.meta.dir}/wa-archive.js`;

/** Archive decisions whose chat WhatsApp still shows as not archived. */
export function pending() {
	const chats = new Map(wa.chats().map((c) => [c.pk, c]));
	const seen = new Set<number>();
	const out: { pk: number; name: string }[] = [];
	for (const d of store.decisions().values()) {
		const c = chats.get(d.pk);
		if (d.kind !== "archive" || !c || c.archived || seen.has(d.pk)) continue;
		seen.add(d.pk);
		out.push({ pk: c.pk, name: c.name });
	}
	return out;
}

export async function archive(limit = 50, dry = false, log = console.log) {
	const todo = pending().slice(0, limit);
	const tally: Record<string, number> = {};
	for (const [i, c] of todo.entries()) {
		const r = Bun.spawnSync(
			["osascript", "-l", "JavaScript", SCRIPT, c.name, ...(dry ? ["dry"] : [])],
			{
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const out = (r.stdout.toString() || r.stderr.toString()).trim();
		const kind = out.split(" ")[0] || "ERR";
		tally[kind] = (tally[kind] ?? 0) + 1;
		log(`${i + 1}/${todo.length} pk ${c.pk}: ${out}`);
		// no Accessibility permission, or WhatsApp closed: stop instead of failing every chat
		if (kind === "ERR") break;
		if (i < todo.length - 1) await Bun.sleep(3000 + Math.random() * 2000);
	}
	if (!dry && tally.ARCHIVED) await wa.snapshot();
	return { pending: pending().length, tally };
}
