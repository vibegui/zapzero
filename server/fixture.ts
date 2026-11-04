// A synthetic WhatsApp Desktop database for the self-check: only the tables and columns wa.ts reads,
// filled with made-up people. Never point this at the real WhatsApp folder.
import { Database } from "bun:sqlite";

const COCOA = 978307200;
const HOUR = 3600;
/** Cocoa seconds, `h` hours ago */
const ago = (h: number) => Date.now() / 1000 - COCOA - h * HOUR;

/** the chats the fixture creates, by Z_PK */
export const FAKE = {
	waiting: 1, // DM, they asked a question, owner hasn't answered
	answered: 2, // DM, owner spoke last
	group: 3,
	lid: 4, // @lid chat, no contact: phone comes from ZPARTNERNAME
	image: 5, // last message is a photo
	pinned: 6, // @lid chat matched to a contact through ZLID
} as const;

export function makeFakeWhatsApp(dir: string) {
	const chat = new Database(`${dir}/ChatStorage.sqlite`, { create: true });
	chat.run(`create table ZWACHATSESSION (Z_PK integer primary key, ZSESSIONTYPE integer, ZCONTACTJID text,
		ZPARTNERNAME text, ZUNREADCOUNT integer, ZARCHIVED integer, ZLASTMESSAGEDATE real, ZREMOVED integer, ZHIDDEN integer)`);
	chat.run(`create table ZWAMESSAGE (Z_PK integer primary key, ZCHATSESSION integer, ZISFROMME integer,
		ZMESSAGEDATE real, ZTEXT text, ZMESSAGETYPE integer, ZGROUPMEMBER integer, ZPUSHNAME text, ZSORT integer, ZMEDIAITEM integer)`);
	chat.run("create table ZWAGROUPMEMBER (Z_PK integer primary key, ZCONTACTNAME text)");
	chat.run(
		"create table ZWAMEDIAITEM (Z_PK integer primary key, ZMEDIALOCALPATH text, ZXMPPTHUMBPATH text)",
	);

	const session = chat.prepare(
		"insert into ZWACHATSESSION values (?, ?, ?, ?, ?, 0, ?, 0, 0)", // pk, type, jid, name, unread, lastDate
	);
	session.run(FAKE.waiting, 0, "5511900000001@s.whatsapp.net", "Ana Souza", 1, ago(2));
	session.run(FAKE.answered, 0, "5511900000002@s.whatsapp.net", "Bruno Lima", 0, ago(5));
	session.run(FAKE.group, 1, "120363000000000001@g.us", "Família Teste", 2, ago(1));
	session.run(FAKE.lid, 0, "100000000000004@lid", "+55 11 90000-0004", 1, ago(3));
	session.run(FAKE.image, 0, "5511900000005@s.whatsapp.net", "Elisa Rocha", 1, ago(4));
	session.run(FAKE.pinned, 0, "100000000000006@lid", "Fábio Melo", 0, 4_100_000_000); // pinned: far future

	chat.run("insert into ZWAGROUPMEMBER values (1, 'Carla Dias')");
	chat.run("insert into ZWAMEDIAITEM values (1, 'Media/fake/photo.jpg', null)");

	let sort = 0;
	const msg = chat.prepare("insert into ZWAMESSAGE values (null, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
	const add = (
		pk: number,
		mine: boolean,
		h: number,
		text: string | null,
		o: { type?: number; member?: number; push?: string; media?: number } = {},
	) =>
		msg.run(
			pk,
			mine ? 1 : 0,
			ago(h),
			text,
			o.type ?? 0,
			o.member ?? null,
			o.push ?? null,
			++sort,
			o.media ?? null,
		);

	add(FAKE.waiting, true, 30, "Oi Ana, tudo bem?");
	add(FAKE.waiting, false, 2, "Você consegue revisar a proposta até sexta?");
	add(FAKE.answered, false, 6, "Mandei o contrato por e-mail");
	add(FAKE.answered, true, 5, "Recebi, obrigado!");
	add(FAKE.group, false, 3, "Quem leva o bolo no domingo?", { member: 1 });
	add(FAKE.group, false, 2, null, { type: 6 }); // system message: not content, must be skipped
	add(FAKE.group, false, 1, "Eu levo!", { member: 1 });
	add(FAKE.lid, false, 3, "Oi, é sobre o anúncio do apartamento", { push: "Diego" });
	add(FAKE.image, false, 4, null, { type: 1, media: 1 });
	add(FAKE.pinned, false, 50, "Bom dia!");
	add(FAKE.pinned, true, 48, "Bom dia, Fábio");
	chat.close();

	const contacts = new Database(`${dir}/ContactsV2.sqlite`, { create: true });
	contacts.run(
		"create table ZWAADDRESSBOOKCONTACT (Z_PK integer primary key, ZWHATSAPPID text, ZLID text, ZFULLNAME text)",
	);
	const contact = contacts.prepare("insert into ZWAADDRESSBOOKCONTACT values (null, ?, ?, ?)");
	contact.run("5511900000001@s.whatsapp.net", null, "Ana Souza");
	contact.run("5511900000002@s.whatsapp.net", null, "Bruno Lima");
	contact.run("5511900000006@s.whatsapp.net", "100000000000006@lid", "Fábio Melo");
	contacts.close();
}
