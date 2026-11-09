// zapzero's own state, next to the snapshot: triage, drafts, decisions, spend. WhatsApp's files are never written.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { DATA } from "./env.ts";
import { PROFILE_TOPICS, type Profile } from "./profile.ts";

export const db = new Database(`${DATA}/zap.sqlite`, { create: true });
db.run("pragma journal_mode = wal");
db.run(`create table if not exists triage (
	pk integer primary key, last_pk integer, at integer,
	espera text, resposta text, p_sim real, categoria text, urgencia real, acao text)`);
db.run(
	`create table if not exists drafts (pk integer primary key, last_pk integer, at integer, model text, text text)`,
);
db.run(`create table if not exists decisions (
	pk integer, last_pk integer, kind text, text text, at integer, primary key (pk, last_pk))`);
db.run(`create table if not exists spend (at integer, what text, n integer, cost real)`);
db.run(`create table if not exists kv (k text primary key, v text)`);
db.run("update triage set espera = 'dono_espera' where espera = 'gui_espera'"); // renamed key
// areas: who/what a chat is about (Clientes, Hiring…). Built-ins plus the ones the owner accepted from suggestions.
db.run(
	`create table if not exists areas (id text primary key, label text, criteria text, builtin integer, at integer)`,
);
db.run(`create table if not exists suggestions (
	id text primary key, label text, criteria text, pks text, reason text, at integer, status text)`);
// calendar events the owner asked for when replying; created by their own Claude, see calendar.ts
db.run(`create table if not exists events (
	pk integer, last_pk integer, at integer, text text, status text, result text, primary key (pk, last_pk))`);
for (const col of ["event_id text", "guests text"]) {
	try {
		db.run(`alter table events add column ${col}`);
	} catch {} // already there
}
try {
	db.run("alter table decisions add column draft text"); // what zapzero suggested, to learn from the edit
	// past replies: the draft is still there when no newer message replaced it
	db.run(`update decisions set draft = (select d.text from drafts d where d.pk = decisions.pk and d.last_pk = decisions.last_pk)
		where kind = 'reply'`);
} catch {} // already there
for (const col of ["area text", "area_ver integer"]) {
	try {
		db.run(`alter table triage add column ${col}`);
	} catch {} // already there
}
const BUILTIN_AREAS: [string, string, string][] = [
	[
		"clientes",
		"Clientes",
		"cliente ou cliente em potencial da empresa do dono: lojas, marcas, contas, negociação, suporte",
	],
	[
		"hiring",
		"Hiring",
		"contratação: candidatos, recrutadores, indicações de pessoas para vagas, entrevistas",
	],
	["time", "Time", "quem trabalha com o dono na empresa dele: sócios, funcionários, colaboradores"],
	["investidores", "Investidores", "investidores, fundos, anjos, conselheiros, captação"],
	[
		"parceiros",
		"Parceiros",
		"parceiros de negócio, agências, fornecedores, eventos, imprensa, comunidade",
	],
	["familia", "Família", "família e parceira"],
	["amigos", "Amigos", "amigos e vida social"],
	[
		"servicos",
		"Casa e serviços",
		"saúde, escola, casa, reparos, prestadores, banco e finanças pessoais",
	],
	[
		"vendendo",
		"Te vendendo algo",
		"alguém tentando vender algo ao dono: marketing, promoção, cold outreach",
	],
	["outros", "Outros", "nenhuma das anteriores"],
];
for (const [id, label, criteria] of BUILTIN_AREAS)
	db.query("insert or ignore into areas values (?, ?, ?, 1, ?)").run(
		id,
		label,
		criteria,
		Date.now(),
	);

export type Triage = {
	pk: number;
	last_pk: number;
	espera: "eles_esperam" | "dono_espera" | "ninguem";
	resposta: "sim" | "talvez" | "nao";
	p_sim: number;
	categoria: "pessoal" | "trabalho" | "servico" | "empresa" | "golpe" | "desconhecido";
	urgencia: number; // 0 nenhuma .. 3 hoje
	acao: "responder" | "revisar" | "arquivar";
	area: string | null;
	area_ver: number | null;
};
export type Draft = { pk: number; last_pk: number; text: string; model: string; at: number };
/** reply = opened in WhatsApp with the text; done = nothing to send; archive = intent, for the executor */
/** ignore = forever, stored with last_pk 0 so no new message brings the chat back */
export type DecisionKind = "reply" | "done" | "skip" | "archive" | "ignore";
export type Decision = {
	pk: number;
	last_pk: number;
	kind: DecisionKind;
	text: string | null;
	at: number;
	draft?: string | null;
};

const byPk = <T extends { pk: number }>(rows: T[]) => new Map(rows.map((r) => [r.pk, r]));

export const triages = () => byPk(db.query<Triage, []>("select * from triage").all());
export const drafts = () => byPk(db.query<Draft, []>("select * from drafts").all());
export const decisions = () =>
	new Map(
		db
			.query<Decision, []>("select * from decisions")
			.all()
			.map((d) => [`${d.pk}:${d.last_pk}`, d]),
	);

export function saveTriage(t: Triage) {
	db.query(
		`insert or replace into triage (pk, last_pk, at, espera, resposta, p_sim, categoria, urgencia, acao, area, area_ver)
		values ($pk, $last_pk, $at, $espera, $resposta, $p_sim, $categoria, $urgencia, $acao, $area, $area_ver)`,
	).run({
		$pk: t.pk,
		$last_pk: t.last_pk,
		$at: Date.now(),
		$espera: t.espera,
		$resposta: t.resposta,
		$p_sim: t.p_sim,
		$categoria: t.categoria,
		$urgencia: t.urgencia,
		$acao: t.acao,
		$area: t.area,
		$area_ver: t.area_ver,
	});
}

export function saveDraft(pk: number, lastPk: number, text: string, model: string) {
	db.query("insert or replace into drafts values (?, ?, ?, ?, ?)").run(
		pk,
		lastPk,
		Date.now(),
		model,
		text,
	);
}

export function decide(
	pk: number,
	lastPk: number,
	kind: DecisionKind,
	text: string | null,
	draft: string | null = null,
) {
	db.query(
		"insert or replace into decisions (pk, last_pk, kind, text, at, draft) values (?, ?, ?, ?, ?, ?)",
	).run(pk, lastPk, kind, text, Date.now(), draft);
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim();

/** Replies the owner sent after changing zapzero's draft, newest first: what it suggested vs what they sent. */
export function editedReplies(limit = 10, since = 0) {
	return db
		.query<{ draft: string; text: string; at: number }, [number]>(
			"select draft, text, at from decisions where kind = 'reply' and draft is not null and text is not null and at > ? order by at desc",
		)
		.all(since)
		.filter((r) => norm(r.draft) !== norm(r.text))
		.slice(0, limit);
}

/** Style rules learned from the owner's edits, waiting for them to accept or drop. */
export type Learned = { rules: string[]; pairs: number; at: number };
export const learned = (): Learned | null => JSON.parse(kvGet("voz_learned") ?? "null");
export const setLearned = (l: Learned | null) => kvSet("voz_learned", JSON.stringify(l));

export function undecide(pk: number, lastPk: number) {
	db.query("delete from decisions where pk = ? and last_pk = ?").run(pk, lastPk);
}

export function recentDecisions(limit = 50) {
	return db
		.query<Decision, [number]>("select * from decisions order by at desc limit ?")
		.all(limit);
}

export function spend(what: string, n: number, cost: number) {
	db.query("insert into spend values (?, ?, ?, ?)").run(Date.now(), what, n, cost);
}

export function spendSince(ms: number) {
	return db
		.query<{ what: string; n: number; cost: number }, [number]>(
			"select what, sum(n) n, sum(cost) cost from spend where at > ? group by what",
		)
		.all(Date.now() - ms);
}

// ---- areas & suggestions ------------------------------------------------------------------

export type Area = { id: string; label: string; criteria: string; builtin: number };
export type Suggestion = {
	id: string;
	label: string;
	criteria: string;
	pks: number[];
	reason: string;
	at: number;
	status: "pending" | "accepted" | "dismissed";
};

export const kvGet = (k: string) =>
	db.query<{ v: string }, [string]>("select v from kv where k = ?").get(k)?.v ?? null;
export const kvSet = (k: string, v: string) =>
	db.query("insert or replace into kv values (?, ?)").run(k, v);

export const areas = () =>
	db
		.query<Area, []>("select id, label, criteria, builtin from areas order by builtin desc, at")
		.all();
/** bumped whenever the set of areas changes: triage rows with an older version get their area redone */
export const areasVer = () => Number(kvGet("areas_ver") ?? 1);

export function setArea(pk: number, area: string, ver: number) {
	db.query("update triage set area = ?, area_ver = ? where pk = ?").run(area, ver, pk);
}

export function suggestions(status?: Suggestion["status"]) {
	const rows = db
		.query<Omit<Suggestion, "pks"> & { pks: string }, []>(
			"select * from suggestions order by at desc",
		)
		.all();
	return rows
		.map((r) => ({ ...r, pks: JSON.parse(r.pks) as number[] }))
		.filter((r) => !status || r.status === status);
}

export function replacePendingSuggestions(list: Omit<Suggestion, "at" | "status">[]) {
	db.transaction(() => {
		db.run("delete from suggestions where status = 'pending'");
		for (const x of list)
			db.query("insert or ignore into suggestions values (?, ?, ?, ?, ?, ?, 'pending')").run(
				x.id,
				x.label,
				x.criteria,
				JSON.stringify(x.pks),
				x.reason,
				Date.now(),
			);
	})();
}

/** Accepting turns a suggestion into an area: its members get it now, everyone else is re-classified. */
export function acceptSuggestion(id: string) {
	const s = suggestions("pending").find((x) => x.id === id);
	if (!s) return false;
	const ver = areasVer() + 1;
	db.transaction(() => {
		db.query("insert or replace into areas values (?, ?, ?, 0, ?)").run(
			s.id,
			s.label,
			s.criteria,
			Date.now(),
		);
		db.query("update suggestions set status = 'accepted' where id = ?").run(id);
		kvSet("areas_ver", String(ver));
		for (const pk of s.pks) setArea(pk, s.id, ver);
	})();
	return true;
}

export function dismissSuggestion(id: string) {
	db.query("update suggestions set status = 'dismissed' where id = ?").run(id);
}

export function removeArea(id: string) {
	db.transaction(() => {
		db.query("delete from areas where id = ? and builtin = 0").run(id);
		kvSet("areas_ver", String(areasVer() + 1));
	})();
}

// ---- the owner: who they are and how they write ---------------------------------------------

export { PROFILE_TOPICS, type Profile, type ProfileTopic } from "./profile.ts";

export type Voice = {
	perfil: Profile;
	voz: string;
	/** suggested = written by the model after the first scan, waiting for the owner; accepted = owner's */
	state: "empty" | "suggested" | "accepted";
	samples: number;
};

const emptyProfile = () => Object.fromEntries(PROFILE_TOPICS.map((t) => [t.id, ""])) as Profile;

export function voice(): Voice {
	const perfil = emptyProfile();
	const raw = kvGet("perfil_v2");
	if (raw) Object.assign(perfil, JSON.parse(raw));
	else {
		// older installs: one free-text profile (kv or perfil.txt) goes into "outros"
		let old = kvGet("perfil") ?? "";
		if (!old) {
			try {
				old = readFileSync(`${DATA}/perfil.txt`, "utf8").trim();
			} catch {}
		}
		perfil.outros = old;
	}
	const filled = Object.values(perfil).some((v) => v.trim());
	return {
		perfil,
		voz: kvGet("voz") ?? "",
		state: (kvGet("voice_state") as Voice["state"]) ?? (filled ? "accepted" : "empty"),
		samples: Number(kvGet("voice_samples") ?? 0),
	};
}

export function saveVoice(
	v: { perfil: Partial<Profile>; voz: string },
	state: "suggested" | "accepted",
	samples?: number,
) {
	const perfil = emptyProfile();
	for (const t of PROFILE_TOPICS) perfil[t.id] = (v.perfil[t.id] ?? "").trim();
	kvSet("perfil_v2", JSON.stringify(perfil));
	kvSet("voz", v.voz.trim());
	kvSet("voice_state", state);
	if (samples != null) kvSet("voice_samples", String(samples));
}

/** Who the owner is, for every prompt: the filled topics as labelled lines. */
export function perfil() {
	const p = voice().perfil;
	const text = PROFILE_TOPICS.filter((t) => p[t.id].trim())
		.map((t) => `${t.label}: ${p[t.id].trim()}`)
		.join("\n");
	return text || "O dono deste WhatsApp.";
}

// ---- proposed meetings found in messages ----------------------------------------------------

db.run(`create table if not exists proposals (
	msg integer primary key, pk integer, at integer, mine integer, text text,
	event integer, title text, start text, minutes integer,
	status text, result text, event_id text, guests text)`);
try {
	db.run("alter table proposals add column checked integer"); // looked up in the calendar already
} catch {}

export type Proposal = {
	msg: number;
	pk: number;
	at: number;
	mine: number;
	text: string;
	/** 1 = a meeting/appointment with a day and time; 0 = looked at, not one */
	event: number;
	title: string | null;
	/** local "YYYY-MM-DDTHH:mm" */
	start: string | null;
	minutes: number | null;
	/** pending (owner hasn't decided), booking, booked, dismissed, error */
	status: string;
	result: string | null;
	event_id: string | null;
	guests: string | null;
};

export const proposalSeen = () =>
	new Set(
		db
			.query<{ msg: number }, []>("select msg from proposals")
			.all()
			.map((r) => r.msg),
	);

export function saveProposal(p: Omit<Proposal, "status" | "result" | "event_id" | "guests">) {
	db.query(
		"insert or ignore into proposals (msg, pk, at, mine, text, event, title, start, minutes, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
	).run(p.msg, p.pk, p.at, p.mine, p.text, p.event, p.title, p.start, p.minutes);
}

/** Meetings found in the last two weeks, dismissed ones too: a dismissed latest one hides older ones in its chat. */
export const proposals = () =>
	db
		.query<Proposal, [number]>("select * from proposals where event = 1 and at > ? order by start")
		.all(Date.now() - 14 * 86_400_000);

/**
 * Meetings to look up in the calendar: new ones, and every 6 h the ones already there, so an event the
 * owner deleted comes back as pending. `checked` is when it was last looked up (1 = before that existed).
 */
export const uncheckedProposals = (now = Date.now()) =>
	db
		.query<Proposal, [number]>(
			`select * from proposals where event = 1 and status in ('pending', 'booked')
			and (checked is null or (status = 'booked' and checked < ?))`,
		)
		.all(now - 6 * 3_600_000);
export const markChecked = (msg: number) =>
	db.query("update proposals set checked = ? where msg = ?").run(Date.now(), msg);

export const proposal = (msg: number) =>
	db.query<Proposal, [number]>("select * from proposals where msg = ?").get(msg);

export function setProposal(
	msg: number,
	status: string,
	result: string | null = null,
	eventId: string | null = null,
	guests: string | null = null,
) {
	db.query(
		"update proposals set status = ?, result = coalesce(?, result), event_id = coalesce(?, event_id), guests = coalesce(?, guests) where msg = ?",
	).run(status, result, eventId, guests, msg);
}

// ---- calendar events ------------------------------------------------------------------------

export type EventRow = {
	pk: number;
	last_pk: number;
	at: number;
	text: string;
	status: "pending" | "ok" | "skipped" | "error";
	result: string | null;
	event_id: string | null;
	/** comma-separated e-mails invited */
	guests: string | null;
};

export function eventStart(pk: number, lastPk: number, text: string, guests: string[]) {
	db.query(
		"insert or replace into events (pk, last_pk, at, text, status, result, guests) values (?, ?, ?, ?, 'pending', null, ?)",
	).run(pk, lastPk, Date.now(), text, guests.join(",") || null);
}

export function eventDone(
	pk: number,
	lastPk: number,
	status: EventRow["status"],
	result: string,
	eventId: string | null = null,
) {
	db.query(
		"update events set status = ?, result = ?, event_id = coalesce(?, event_id) where pk = ? and last_pk = ?",
	).run(status, result, eventId, pk, lastPk);
}

/** The newest event created for a chat in the last two weeks: the one a guest can still be added to. */
export const latestEvent = (pk: number) =>
	db
		.query<EventRow, [number, number]>(
			"select * from events where pk = ? and status = 'ok' and event_id is not null and at > ? order by at desc limit 1",
		)
		.get(pk, Date.now() - 14 * 86_400_000);

export function eventGuest(pk: number, lastPk: number, email: string) {
	db.query(
		"update events set guests = trim(coalesce(guests, '') || ',' || ?, ',') where pk = ? and last_pk = ?",
	).run(email, pk, lastPk);
}

export const events = () =>
	new Map(
		db
			.query<EventRow, []>("select * from events")
			.all()
			.map((e) => [`${e.pk}:${e.last_pk}`, e]),
	);

/** Every e-mail already invited to an event zapzero made for this chat. */
export const invitedIn = (pk: number) =>
	new Set(
		db
			.query<{ guests: string | null }, [number]>(
				"select guests from events where pk = ? and status = 'ok'",
			)
			.all(pk)
			.flatMap((r) => r.guests?.split(",") ?? [])
			.filter(Boolean),
	);

/** Background calendar work dies with the server: on start, let the owner try those again. */
export function resetInterrupted() {
	db.run("update proposals set status = 'pending' where status = 'booking'");
	db.run(
		"update events set status = 'error', result = 'interrompido: o servidor reiniciou' where status = 'pending'",
	);
}

// ---- phone ↔ e-mail base -------------------------------------------------------------------

/** E-mails the owner's Claude found (calendario) or the owner typed (voce). Contacts and chats are read live. */
db.run(`create table if not exists emails (
	phone text, email text, source text, status text, note text, at integer, primary key (phone, email))`);

export type EmailRow = {
	phone: string;
	email: string;
	/** calendario | voce */
	source: string;
	/** sugerido (owner hasn't looked) | ok | nao */
	status: string;
	/** where it came from, e.g. the meeting it was seen in */
	note: string | null;
	at: number;
};

export const emailRows = () => db.query<EmailRow, []>("select * from emails").all();

export function saveEmail(r: Omit<EmailRow, "at">) {
	// a suggestion never overrides what the owner already decided
	db.query(
		`insert into emails (phone, email, source, status, note, at) values (?, ?, ?, ?, ?, ?)
		on conflict (phone, email) do update set status = excluded.status, note = coalesce(excluded.note, note), at = excluded.at
		where excluded.status != 'sugerido' or emails.status = 'sugerido'`,
	).run(r.phone, r.email.toLowerCase(), r.source, r.status, r.note, Date.now());
}

export const emailLookedUp = (phone: string) => kvGet(`emails:looked:${phone}`) != null;
export const markEmailLookedUp = (phone: string) =>
	kvSet(`emails:looked:${phone}`, String(Date.now()));

/** The e-mail the owner picked for invites when a person has several. */
export const primaryEmail = (phone: string | null) =>
	phone ? kvGet(`emails:primary:${phone}`) : null;
export const setPrimaryEmail = (phone: string, email: string) =>
	kvSet(`emails:primary:${phone}`, email);
