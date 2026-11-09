// Phone → e-mail from the macOS Contacts database (read-only), so an invite needs no "what's your e-mail?".
// Needs the same Full Disk Access the server already has for WhatsApp's folder.
import { Database } from "bun:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";

const AB = `${homedir()}/Library/Application Support/AddressBook`;

/** Digits only; Brazilian mobiles also by DDD + last 8, since contacts may lack the extra 9. */
export function phoneKeys(phone: string): string[] {
	const d = phone.replace(/\D/g, "");
	const keys = [d];
	if (d.startsWith("55") && d.length >= 12) keys.push(`55${d.slice(2, 4)}${d.slice(-8)}`);
	return keys;
}

let cache: { at: number; map: Map<string, string[]> } | null = null;

export function emailsByPhone(): Map<string, string[]> {
	// a minute: an e-mail the owner just added in Contacts shows up on the next reply
	if (cache && Date.now() - cache.at < 60_000) return cache.map;
	const map = new Map<string, string[]>();
	const files = [`${AB}/AddressBook-v22.abcddb`];
	try {
		for (const s of readdirSync(`${AB}/Sources`))
			files.push(`${AB}/Sources/${s}/AddressBook-v22.abcddb`);
	} catch {}
	for (const f of files.filter((x) => existsSync(x))) {
		try {
			const db = new Database(`file:${f}?mode=ro`, { readonly: true });
			const rows = db
				.query<{ phone: string; email: string }, []>(
					`select p.ZFULLNUMBER phone, lower(e.ZADDRESS) email from ZABCDPHONENUMBER p
					join ZABCDEMAILADDRESS e on e.ZOWNER = p.ZOWNER where p.ZFULLNUMBER is not null and e.ZADDRESS like '%@%'`,
				)
				.all();
			db.close();
			for (const r of rows)
				for (const k of phoneKeys(r.phone)) {
					const list = map.get(k) ?? [];
					if (!list.includes(r.email)) list.push(r.email);
					map.set(k, list);
				}
		} catch {} // no access or another schema: no e-mails, nothing else breaks
	}
	cache = { at: Date.now(), map };
	return map;
}

export function emailsFor(phone: string | null): string[] {
	if (!phone) return [];
	const map = emailsByPhone();
	for (const k of phoneKeys(phone)) {
		const hit = map.get(k);
		if (hit) return hit;
	}
	return [];
}
