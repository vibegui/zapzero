import { expect, test } from "bun:test";

// The pipeline runs in its own process: bun test shares modules across files, and env.ts may already be
// loaded with the real paths by another test.
test("read pipeline on a fake WhatsApp database", () => {
	const r = Bun.spawnSync(["bun", `${import.meta.dir}/../scripts/selfcheck.ts`], {
		stdout: "pipe",
		stderr: "pipe",
	});
	expect(r.stderr.toString() + r.stdout.toString()).toContain("selfcheck ok");
	expect(r.exitCode).toBe(0);
}, 60_000);
