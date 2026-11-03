// zapzero's own state, next to the snapshot: triage, drafts, decisions, spend. WhatsApp's files are never written.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { DATA } from "./env.ts";

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

export function decide(pk: number, lastPk: number, kind: DecisionKind, text: string | null) {
	db.query("insert or replace into decisions values (?, ?, ?, ?, ?)").run(
		pk,
		lastPk,
		kind,
		text,
		Date.now(),
	);
}

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

export type Voice = {
	perfil: string;
	voz: string;
	/** suggested = written by the model after the first scan, waiting for the owner; accepted = owner's */
	state: "empty" | "suggested" | "accepted";
	samples: number;
};

export function voice(): Voice {
	let perfil = kvGet("perfil") ?? "";
	if (!perfil) {
		try {
			perfil = readFileSync(`${DATA}/perfil.txt`, "utf8").trim(); // older installs
		} catch {}
	}
	return {
		perfil,
		voz: kvGet("voz") ?? "",
		state: (kvGet("voice_state") as Voice["state"]) ?? (perfil ? "accepted" : "empty"),
		samples: Number(kvGet("voice_samples") ?? 0),
	};
}

export function saveVoice(
	v: { perfil: string; voz: string },
	state: "suggested" | "accepted",
	samples?: number,
) {
	kvSet("perfil", v.perfil.trim());
	kvSet("voz", v.voz.trim());
	kvSet("voice_state", state);
	if (samples != null) kvSet("voice_samples", String(samples));
}

/** Who the owner is, for every prompt. */
export const perfil = () => voice().perfil || "O dono deste WhatsApp.";
