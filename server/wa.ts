// Reads the read-only snapshot of WhatsApp Desktop's database. Never touches the app's own files except to copy them.
import { Database } from "bun:sqlite";
import { existsSync, renameSync, rmSync, statSync } from "node:fs";
import { DATA, WA_DIR } from "./env.ts";

const COCOA = 978307200;
const CONTENT = "0,1,2,3,4,5,7,8,15"; // text, image, video, audio, contact, location, link, document, sticker
const KINDS: Record<number, string> = {
	1: "imagem",
	2: "vídeo",
	3: "áudio",
	4: "contato",
	5: "localização",
	7: "link",
	8: "documento",
	15: "sticker",
};

/**
 * Copies ChatStorage + ContactsV2 over a mode=ro connection, then swaps atomically. `VACUUM INTO` reads the
 * whole database in one read transaction: `.backup` restarts every time WhatsApp writes, and on a busy
 * database it never finished (it held the server for 20+ min). Async with a time limit, so it can't block.
 */
export async function snapshot(limitMs = 120_000) {
	for (const [src, dest] of [
		["ChatStorage.sqlite", "chat.sqlite"],
		["ContactsV2.sqlite", "contacts.sqlite"],
	] as const) {
		const tmp = `${DATA}/${dest}.tmp`;
		rmSync(tmp, { force: true }); // VACUUM INTO refuses an existing file
		const p = Bun.spawn(
			[
				"sqlite3",
				"-cmd",
				".timeout 10000",
				`file:${WA_DIR}/${src}?mode=ro`,
				`VACUUM INTO '${tmp}'`,
			],
			{ stdout: "ignore", stderr: "pipe" },
		);
		const timer = setTimeout(() => p.kill(), limitMs);
		const err = await new Response(p.stderr).text();
		clearTimeout(timer);
		if ((await p.exited) !== 0)
			throw new Error(
				`snapshot ${src}: ${p.signalCode ? `no answer in ${limitMs / 1000}s` : err.slice(0, 300)}`,
			);
		renameSync(tmp, `${DATA}/${dest}`);
	}
}

export function snapshotAt(): number | null {
	try {
		return statSync(`${DATA}/chat.sqlite`).mtimeMs;
	} catch {
		return null;
	}
}

function open() {
	const db = new Database(`${DATA}/chat.sqlite`, { readonly: true });
	db.run(`attach database 'file:${DATA}/contacts.sqlite?mode=ro' as c`);
	return db;
}

export type Chat = {
	pk: number;
	group: boolean;
	jid: string;
	name: string;
	phone: string | null;
	saved: boolean;
	unread: number;
	archived: boolean;
	pinned: boolean;
	/** last content message: what decisions and drafts are keyed on */
	lastPk: number | null;
	lastAt: number | null; // ms
	lastMine: boolean;
	preview: string;
	lastInAt: number | null; // ms, last message from them
	mine: number; // messages the owner ever sent here (synced window)
};

type Row = {
	pk: number;
	type: number;
	jid: string;
	name: string | null;
	unread: number;
	archived: number;
	pinned: number;
	sessionAt: number | null;
	lastPk: number | null;
	lastAt: number | null;
	lastMine: number | null;
	lastText: string | null;
	lastKind: number | null;
	lastSender: string | null;
	lastInAt: number | null;
	mine: number;
	push: string | null;
	phoneJid: string | null;
	fullName: string | null;
};

const body = (text: string | null, kind: number | null) =>
	(text ?? "").replace(/\s+/g, " ").trim() ||
	(kind != null && KINDS[kind] ? `[${KINDS[kind]}]` : "");

let cache: { at: number; chats: Chat[] } | null = null;

/** Every live DM and group, with its last content message. Cached per snapshot. */
export function chats(): Chat[] {
	const at = snapshotAt();
	if (at == null) return [];
	if (cache?.at === at) return cache.chats;
	const db = open();
	const rows = db
		.query<Row, []>(
			`select s.Z_PK pk, s.ZSESSIONTYPE type, s.ZCONTACTJID jid, s.ZPARTNERNAME name,
			  coalesce(s.ZUNREADCOUNT,0) unread, coalesce(s.ZARCHIVED,0) archived,
			  s.ZLASTMESSAGEDATE > 4000000000 pinned,
			  case when s.ZLASTMESSAGEDATE < 4000000000 then s.ZLASTMESSAGEDATE + ${COCOA} end sessionAt,
			  m.Z_PK lastPk, m.ZMESSAGEDATE + ${COCOA} lastAt, m.ZISFROMME lastMine, m.ZTEXT lastText, m.ZMESSAGETYPE lastKind,
			  coalesce(gm.ZCONTACTNAME, m.ZPUSHNAME) lastSender,
			  (select max(x.ZMESSAGEDATE) from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZISFROMME = 0 and x.ZMESSAGETYPE in (${CONTENT})) + ${COCOA} lastInAt,
			  (select count(*) from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZISFROMME = 1) mine,
			  (select x.ZPUSHNAME from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZISFROMME = 0 and x.ZPUSHNAME > '' order by x.ZSORT desc limit 1) push,
			  a.ZWHATSAPPID phoneJid, a.ZFULLNAME fullName
			from ZWACHATSESSION s
			left join ZWAMESSAGE m on m.Z_PK = (select x.Z_PK from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZMESSAGETYPE in (${CONTENT}) order by x.ZSORT desc limit 1)
			left join ZWAGROUPMEMBER gm on gm.Z_PK = m.ZGROUPMEMBER
			left join c.ZWAADDRESSBOOKCONTACT a on a.Z_PK = (select a2.Z_PK from c.ZWAADDRESSBOOKCONTACT a2 where a2.ZWHATSAPPID = s.ZCONTACTJID or a2.ZLID = s.ZCONTACTJID limit 1)
			where s.ZSESSIONTYPE in (0,1,4) and coalesce(s.ZREMOVED,0) = 0 and coalesce(s.ZHIDDEN,0) = 0`,
		)
		.all();
	db.close();
	const out = rows.map((r): Chat => {
		const group = r.type !== 0;
		const phoneJid = r.jid.endsWith("@s.whatsapp.net") ? r.jid : r.phoneJid;
		// @lid chats with no address-book match: WhatsApp names them by the number ("+55 21 9…")
		const shown = r.name?.replace(/[^+\d]/g, "") ?? "";
		const phone = group
			? null
			: phoneJid?.endsWith("@s.whatsapp.net")
				? phoneJid.split("@")[0]!
				: /^\+\d{8,15}$/.test(shown)
					? shown.slice(1)
					: null;
		let name = r.fullName || r.name || "";
		if (!group && (!name || name.startsWith("+")) && r.push && !r.push.endsWith("="))
			name = `~${r.push}${phone ? ` · +${phone}` : ""}`;
		const text = body(r.lastText, r.lastKind);
		const who = r.lastMine ? "Você" : group ? (r.lastSender ?? "") : "";
		return {
			pk: r.pk,
			group,
			jid: r.jid,
			name: name || (phone ? `+${phone}` : r.jid.split("@")[0]!),
			phone,
			saved: r.fullName != null,
			unread: Math.max(0, r.unread),
			archived: r.archived === 1,
			pinned: r.pinned === 1,
			lastPk: r.lastPk,
			lastAt: (r.lastAt ?? r.sessionAt) != null ? (r.lastAt ?? r.sessionAt)! * 1000 : null,
			lastMine: r.lastMine === 1,
			preview: r.lastPk == null ? "" : who ? `${who}: ${text}` : text,
			lastInAt: r.lastInAt != null ? r.lastInAt * 1000 : null,
			mine: r.mine,
		};
	});
	cache = { at, chats: out };
	return out;
}

export type Message = {
	pk: number;
	mine: boolean;
	at: number;
	who: string;
	text: string;
	/** an image or sticker the Mac has on disk: GET /api/media/<pk> */
	media?: true;
};

const MEDIA = `${WA_DIR}/Message/`;
const IMAGE = new Set([1, 15]);

/** Where an image or sticker of this message lives on disk (full file, else its thumbnail), inside WhatsApp's Message folder only. */
export function mediaFile(msgPk: number): string | null {
	if (snapshotAt() == null) return null;
	const db = open();
	const r = db
		.query<{ kind: number; file: string | null; thumb: string | null }, [number]>(
			`select m.ZMESSAGETYPE kind, i.ZMEDIALOCALPATH file, i.ZXMPPTHUMBPATH thumb
			from ZWAMESSAGE m join ZWAMEDIAITEM i on i.Z_PK = m.ZMEDIAITEM where m.Z_PK = ?`,
		)
		.get(msgPk);
	db.close();
	if (!r || !IMAGE.has(r.kind)) return null;
	for (const rel of [r.file, r.thumb]) {
		if (!rel || rel.includes("..")) continue;
		const f = MEDIA + rel;
		if (existsSync(f)) return f;
	}
	return null;
}

/** Last n content messages of a chat, oldest first. */
export function messages(pk: number, n = 20): Message[] {
	if (snapshotAt() == null) return [];
	const db = open();
	const rows = db
		.query<
			{
				pk: number;
				mine: number;
				at: number;
				who: string | null;
				text: string | null;
				kind: number;
				path: string | null;
			},
			[number, number]
		>(
			`select m.Z_PK pk, m.ZISFROMME mine, m.ZMESSAGEDATE + ${COCOA} at, coalesce(g.ZCONTACTNAME, m.ZPUSHNAME) who,
			  m.ZTEXT text, m.ZMESSAGETYPE kind, coalesce(i.ZMEDIALOCALPATH, i.ZXMPPTHUMBPATH) path
			from ZWAMESSAGE m left join ZWAGROUPMEMBER g on g.Z_PK = m.ZGROUPMEMBER
			left join ZWAMEDIAITEM i on i.Z_PK = m.ZMEDIAITEM
			where m.ZCHATSESSION = ? and m.ZMESSAGETYPE in (${CONTENT}) order by m.ZSORT desc limit ?`,
		)
		.all(pk, n);
	db.close();
	return rows.reverse().map((r) => ({
		pk: r.pk,
		mine: r.mine === 1,
		at: r.at * 1000,
		who: r.mine ? "Você" : (r.who ?? ""),
		text: body(r.text, r.kind).slice(0, 2000),
		...(IMAGE.has(r.kind) && r.path ? { media: true as const } : {}),
	}));
}

/** The owner's own recent DM messages, as writing-style samples for drafts. */
export function ownSamples(n = 25): string[] {
	if (snapshotAt() == null) return [];
	const db = open();
	const rows = db
		.query<{ text: string }, [number]>(
			`select m.ZTEXT text from ZWAMESSAGE m join ZWACHATSESSION s on s.Z_PK = m.ZCHATSESSION
			where m.ZISFROMME = 1 and s.ZSESSIONTYPE = 0 and m.ZMESSAGETYPE = 0 and length(m.ZTEXT) between 8 and 280
			order by m.ZMESSAGEDATE desc limit ?`,
		)
		.all(n);
	db.close();
	return rows.map((r) => r.text.replace(/\s+/g, " "));
}

/** The chats with the most messages in the last `days`, busiest first: context for who the owner is. */
export function activeChats(
	days: number,
	n: number,
): { pk: number; count: number; mine: number }[] {
	if (snapshotAt() == null) return [];
	const db = open();
	const since = Date.now() / 1000 - COCOA - days * 86400;
	const rows = db
		.query<{ pk: number; count: number; mine: number }, [number, number]>(
			`select ZCHATSESSION pk, count(*) count, sum(ZISFROMME) mine from ZWAMESSAGE
			where ZMESSAGEDATE > ? and ZMESSAGETYPE in (${CONTENT}) group by ZCHATSESSION order by count desc limit ?`,
		)
		.all(since, n);
	db.close();
	return rows;
}

/** Text messages in DMs from the last `days`, both directions, for finding proposed meetings. */
export function recentTexts(days: number) {
	if (snapshotAt() == null) return [];
	const db = open();
	const since = Date.now() / 1000 - COCOA - days * 86400;
	const rows = db
		.query<{ msg: number; pk: number; mine: number; at: number; text: string }, [number]>(
			`select m.Z_PK msg, m.ZCHATSESSION pk, m.ZISFROMME mine, m.ZMESSAGEDATE + ${COCOA} at, m.ZTEXT text
			from ZWAMESSAGE m join ZWACHATSESSION s on s.Z_PK = m.ZCHATSESSION
			where m.ZMESSAGEDATE > ? and m.ZMESSAGETYPE = 0 and s.ZSESSIONTYPE = 0 and length(m.ZTEXT) between 6 and 600
			order by m.ZMESSAGEDATE`,
		)
		.all(since);
	db.close();
	return rows.map((r) => ({ ...r, mine: r.mine === 1, at: r.at * 1000 }));
}

/** Every content message of the last `days` in DMs and groups, oldest first: the raw input for stats. */
export function messageLog(days: number): { pk: number; mine: boolean; at: number }[] {
	if (snapshotAt() == null) return [];
	const db = open();
	const since = Date.now() / 1000 - COCOA - days * 86400;
	const rows = db
		.query<{ pk: number; mine: number; at: number }, [number]>(
			`select m.ZCHATSESSION pk, m.ZISFROMME mine, m.ZMESSAGEDATE + ${COCOA} at from ZWAMESSAGE m
			where m.ZMESSAGEDATE > ? and m.ZMESSAGETYPE in (${CONTENT}) order by m.ZMESSAGEDATE`,
		)
		.all(since);
	db.close();
	return rows.map((r) => ({ pk: r.pk, mine: r.mine === 1, at: r.at * 1000 }));
}
