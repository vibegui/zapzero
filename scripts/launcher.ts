// The background server's own program: a Bun runtime under zapzero's name. launchd runs it with
// BUN_BE_BUN=1, so it runs the current server/main.ts from the repo like `bun` would. It is built once and
// never rebuilt, so macOS keeps its Full Disk Access across updates, and that access belongs to zapzero,
// not to the `bun` every other script uses.
console.error("zapzero: run with BUN_BE_BUN=1 and `server/main.ts serve` (launchd does).");
process.exit(1);
