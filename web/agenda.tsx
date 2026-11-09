// Pendências: meetings the owner or the other person proposed in a message (a day and a time).
// Accept and the owner's Claude books it in their calendar, inviting the e-mails ticked here; or dismiss.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { CalendarDays, Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Inbox } from "./api.ts";
import { useInbox } from "./app.tsx";
import { locale, t, tf } from "./i18n.ts";

type P = Inbox["proposals"][number];

const when = (start: string) =>
	new Date(start).toLocaleString(locale(), {
		weekday: "long",
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});

export function AgendaScreen() {
	const inbox = useInbox();
	const list = inbox.data?.proposals ?? [];
	const pending = list.filter((p) => p.status === "pending");
	const rest = list.filter((p) => p.status !== "pending");
	const qc = useQueryClient();
	const booking = list.some((p) => p.status === "booking");
	// the owner's Claude takes a few seconds: follow it until it answers
	useEffect(() => {
		if (!booking) return;
		const t = setInterval(() => qc.invalidateQueries({ queryKey: ["inbox"] }), 3000);
		return () => clearInterval(t);
	}, [booking, qc]);
	return (
		<section className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-8">
			<h1 className="text-[22px] font-semibold tracking-tight">{t("Pendências")}</h1>
			<p className="mt-1 text-sm text-muted">
				{t(
					"Compromissos com dia e hora que apareceram nas conversas e não estão na sua agenda. Diga o que falta, aceite, e o seu Claude marca no calendário e convida quem você marcar.",
				)}
			</p>
			{!inbox.data?.calendar && (
				<p className="mt-4 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-hot">
					{t("Precisa do Claude Code instalado, com um conector de calendário.")}
				</p>
			)}
			<div className="mt-6 grid gap-3">
				{pending.length === 0 && (
					<div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
						{t("Nada proposto agora.")}
					</div>
				)}
				{pending.map((p) => (
					<Card key={p.msg} p={p} />
				))}
			</div>
			{rest.length > 0 && (
				<>
					<h2 className="mt-10 text-[13px] font-medium tracking-wide text-faint uppercase">
						{t("Marcados")}
					</h2>
					<div className="mt-2 grid gap-2">
						{rest.map((p) => (
							<Card key={p.msg} p={p} />
						))}
					</div>
				</>
			)}
		</section>
	);
}

/** No e-mail for this person: ask in WhatsApp (the owner presses Enter) or type it here, saved in the base. */
function Missing({ p, add }: { p: P; add: (email: string) => void }) {
	const qc = useQueryClient();
	const [value, setValue] = useState("");
	const [asked, setAsked] = useState<string | null>(null);
	const save = useMutation({
		mutationFn: (email: string) =>
			p.phone
				? api.setEmail({ phone: p.phone, email, status: "ok" })
				: Promise.resolve({ ok: true }),
		onSuccess: (_r, email) => {
			add(email);
			setValue("");
			qc.invalidateQueries({ queryKey: ["emails"] });
			qc.invalidateQueries({ queryKey: ["inbox"] });
		},
	});
	const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
	return (
		<div className="mt-2 rounded-lg bg-sunken px-3 py-2 text-[12px]">
			<div className="text-muted">
				{tf("Falta o e-mail de {name} pro convite.", { name: p.name })}
			</div>
			<div className="mt-1.5 flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() =>
						api
							.askEmail(p.pk, t("Me passa seu e-mail pra eu mandar o convite?"))
							.then((r) =>
								setAsked(
									r.via === "whatsapp"
										? t("Aberto no WhatsApp: aperte Enter lá")
										: t("Texto copiado: cole na conversa"),
								),
							)
					}
					className="rounded-md border border-line bg-panel px-2 py-1 text-muted hover:text-ink"
				>
					{t("Pedir no WhatsApp")}
				</button>
				<span className="text-faint">{t("ou")}</span>
				<form
					className="flex items-center gap-1"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid) save.mutate(value.trim().toLowerCase());
					}}
				>
					<input
						type="email"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						placeholder="nome@empresa.com"
						className="h-7 w-52 rounded-md border border-line bg-panel px-2 outline-none focus:border-accent"
					/>
					<button
						type="submit"
						disabled={!valid || save.isPending}
						className="rounded-md px-2 py-1 font-medium text-accent disabled:opacity-40"
					>
						{t("Usar")}
					</button>
				</form>
			</div>
			{asked && <div className="mt-1 text-accent">{asked}</div>}
		</div>
	);
}

function Card({ p }: { p: P }) {
	const qc = useQueryClient();
	const [emails, setEmails] = useState(() => new Set(p.emails));
	const act = useMutation({
		mutationFn: (action: "accept" | "dismiss") =>
			api.proposal(p.msg, { action, emails: [...emails] }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
	});
	const done = p.status !== "pending";
	return (
		<article className={clsx("rounded-xl border border-line bg-panel p-4", done && "opacity-80")}>
			<div className="flex items-start gap-3">
				<CalendarDays className="mt-0.5 size-5 shrink-0 text-accent" />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline gap-x-2">
						<span className="text-[15px] font-semibold">{p.title}</span>
						<span className="text-sm text-muted">{p.start ? when(p.start) : ""}</span>
						<span className="text-xs text-faint">· {p.minutes} min</span>
					</div>
					{!done && p.result === "saiu da agenda" && (
						<div className="mt-1 text-[12px] font-medium text-hot">
							{t("Estava na sua agenda e saiu: marcar de novo?")}
						</div>
					)}
					<div className="mt-1 text-[13px] text-muted">
						{p.mine ? `${t("Você para")} ` : ""}
						<span className="font-medium text-ink">{p.name}</span>:{" "}
						<span className="italic">«{p.text}»</span>
					</div>
					{!done && p.emails.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-3">
							{p.emails.map((e) => (
								<label key={e} className="flex items-center gap-1.5 text-[12px] text-muted">
									<input
										type="checkbox"
										className="accent-[var(--accent)]"
										checked={emails.has(e)}
										onChange={() =>
											setEmails((s) => {
												const n = new Set(s);
												n.has(e) ? n.delete(e) : n.add(e);
												return n;
											})
										}
									/>
									{t("convidar")} {e}
								</label>
							))}
						</div>
					)}
					{!done && p.emails.length === 0 && (
						<Missing p={p} add={(e) => setEmails((s) => new Set(s).add(e))} />
					)}
					{!done && [...emails].filter((e) => !p.emails.includes(e)).length > 0 && (
						<div className="mt-2 text-[12px] text-muted">
							{tf("convidar {e}", { e: [...emails].join(", ") })}
						</div>
					)}
					{done && (
						<div
							className={clsx(
								"mt-2 flex items-center gap-1.5 text-[12px]",
								p.status === "error" ? "text-hot" : "text-accent",
							)}
						>
							{p.status === "booking" && <Loader2 className="size-3.5 animate-spin" />}
							{p.status === "booking"
								? t("seu Claude está marcando…")
								: p.status === "booked"
									? `${p.result ?? t("marcado")}${p.guests ? tf(" · convidou {g}", { g: p.guests.replaceAll(",", ", ") }) : ""}`
									: tf("não deu: {r}", { r: p.result ?? "" })}
						</div>
					)}
				</div>
				{!done && (
					<div className="flex shrink-0 gap-1.5">
						<button
							type="button"
							disabled={act.isPending}
							onClick={() => act.mutate("accept")}
							className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-[12px] font-medium text-accent-ink hover:brightness-110 disabled:opacity-50"
						>
							<Check className="size-3.5" /> {t("Marcar")}
						</button>
						<button
							type="button"
							disabled={act.isPending}
							onClick={() => act.mutate("dismiss")}
							className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-muted hover:text-ink"
						>
							<X className="size-3.5" /> {t("Não")}
						</button>
					</div>
				)}
			</div>
		</article>
	);
}
