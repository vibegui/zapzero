import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

export const DATA = process.env.ZAP_DATA ?? `${homedir()}/Library/Application Support/zap`;
export const WA_DIR = `${homedir()}/Library/Group Containers/group.net.whatsapp.WhatsApp.shared`;
export const PORT = Number(process.env.ZAP_PORT ?? 8810);
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
/** Model choice is config: Jev for cheap classification, a small chat model for drafts. */
export const TRIAGE_MODEL = process.env.ZAP_TRIAGE_MODEL ?? "typesafe/jev-1.14";
export const DRAFT_MODEL = process.env.ZAP_DRAFT_MODEL ?? "anthropic/claude-haiku-5.5";
export const REFRESH_MIN = Number(process.env.ZAP_REFRESH_MIN ?? 15);

mkdirSync(DATA, { recursive: true });
chmodSync(DATA, 0o700);

/** Every API call carries this token: the server is reachable from any page open in the owner's browser. */
export const TOKEN = (() => {
	const f = `${DATA}/token`;
	if (!existsSync(f)) {
		writeFileSync(
			f,
			Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url"),
			{
				mode: 0o600,
			},
		);
	}
	return readFileSync(f, "utf8").trim();
})();
