// zapzero's own state, next to the snapshot: triage, drafts, decisions, spend. WhatsApp's files are never written.
import { Database } from "bun:sqlite";
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

export type Triage = {
	pk: number;
	last_pk: number;
	espera: "eles_esperam" | "gui_espera" | "ninguem";
	resposta: "sim" | "talvez" | "nao";
	p_sim: number;
	categoria: "pessoal" | "trabalho" | "servico" | "empresa" | "golpe" | "desconhecido";
	urgencia: number; // 0 nenhuma .. 3 hoje
	acao: "responder" | "revisar" | "arquivar";
};
export type Draft = { pk: number; last_pk: number; text: string; model: string; at: number };
/** reply = opened in WhatsApp with the text; done = nothing to send; archive = intent, for the executor */
export type DecisionKind = "reply" | "done" | "skip" | "archive";
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
		`insert or replace into triage values ($pk, $last_pk, $at, $espera, $resposta, $p_sim, $categoria, $urgencia, $acao)`,
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
