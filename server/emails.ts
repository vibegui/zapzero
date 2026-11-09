// Phone ↔ e-mail base, so a meeting invite needs no "what's your e-mail?". Sources: the Mac's Contacts,
// e-mails people wrote in the chat, the owner's meeting guests (found by their own Claude), and the owner.
import { lookupEmails } from "./calendar.ts";
import { emailsFor } from "./contacts.ts";
import * as store from "./store.ts";
import * as wa from "./wa.ts";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** People per run of the owner's Claude: each one costs a few calendar searches. */
export const BATCH = 15;

export type Person = {
	pk: number;
	name: string;
	phone: string;
	/** messages the owner sent: how close this person is */
	mine: number;
	emails: { email: string; source: string; status: string; note: string | null }[];
	looked: boolean;
};

/** The owner's direct chats with a number, closest first, with every e-mail known for each. */
export function base(limit = 300): Person[] {
	const rows = store.emailRows();
	const byPhone = Map.groupBy(rows, (r) => r.phone);
	return wa
		.chats()
		.filter((c) => !c.group && c.phone)
		.sort((a, b) => b.mine - a.mine)
		.slice(0, limit)
		.map((c) => {
			const phone = c.phone!;
			const out = new Map<string, Person["emails"][number]>();
			const add = (email: string, source: string, status: string, note: string | null = null) => {
				const e = email.toLowerCase();
				if (!out.has(e)) out.set(e, { email: e, source, status, note });
			};
			// the owner's own decisions first: a "nao" hides the same address from the other sources
			for (const r of byPhone.get(phone) ?? []) add(r.email, r.source, r.status, r.note);
			for (const e of emailsFor(phone)) add(e, "contatos", "ok");
			for (const m of wa.messages(c.pk, 50))
				if (!m.mine) for (const e of m.text.match(EMAIL) ?? []) add(e, "conversa", "ok");
			return {
				pk: c.pk,
				name: c.name,
				phone,
				mine: c.mine,
				emails: [...out.values()],
				looked: store.emailLookedUp(phone),
			};
		});
}

/** E-mails to use for this phone: the owner's and accepted ones, never one marked "nao". */
export function acceptedFor(phone: string | null): string[] {
	if (!phone) return [];
	return store
		.emailRows()
		.filter((r) => r.phone === phone && r.status === "ok")
		.map((r) => r.email);
}

/** Next people worth looking up: close, with no e-mail yet, not looked up before. */
export function toLookUp(n = BATCH) {
	return base()
		.filter((p) => p.mine > 0 && !p.looked && !p.emails.some((e) => e.status !== "nao"))
		.slice(0, n);
}

/** One batch through the owner's Claude; what it finds is saved as a suggestion for the owner to accept. */
export async function findBatch(): Promise<{ asked: number; found: number } | null> {
	const people = toLookUp();
	const found = await lookupEmails(people.map((p) => ({ id: p.pk, name: p.name })));
	if (!found) return null; // failed: nobody is marked as looked up, the next click retries
	const byPk = new Map(people.map((p) => [p.pk, p]));
	for (const f of found) {
		const p = byPk.get(Number(f.id));
		if (p)
			store.saveEmail({
				phone: p.phone,
				email: f.email,
				source: "calendario",
				status: "sugerido",
				note: f.evento?.slice(0, 120) ?? null,
			});
	}
	for (const p of people) store.markEmailLookedUp(p.phone);
	return { asked: people.length, found: found.length };
}
