// Contatos: the phone ↔ e-mail base. Suggestions from the owner's calendar wait for a ✓ before invites use them.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { api, type Person } from "./api.ts";
import { t, tf } from "./i18n.ts";

const SOURCE: Record<string, string> = {
	contatos: "Contatos do Mac",
	conversa: "na conversa",
	calendario: "calendário",
	voce: "você",
};

export function ContactsScreen() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["emails"],
		queryFn: api.emails,
		refetchInterval: (query) => (query.state.data?.running ? 4000 : false),
	});
	const find = useMutation({
		mutationFn: api.findEmails,
		onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
	});
	const set = useMutation({
		mutationFn: api.setEmail,
		onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
	});
	const [filter, setFilter] = useState("");
	const running = q.data?.running || find.isPending;
	const people = (q.data?.people ?? []).filter(
		(p) =>
			!filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.phone.includes(filter),
	);
	const pending = people.filter((p) => p.emails.some((e) => e.status === "sugerido"));
	const rest = people.filter((p) => !pending.includes(p));
	const known = (q.data?.people ?? []).filter((p) =>
		p.emails.some((e) => e.status === "ok"),
	).length;

	return (
		<section className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-8">
			<div className="flex items-start gap-4">
				<div className="flex-1">
					<h1 className="text-[22px] font-semibold tracking-tight">{t("Contatos e e-mails")}</h1>
					<p className="mt-1 text-sm text-muted">
						{t(
							"O e-mail de cada pessoa, pra convidar sem perguntar. Vem dos Contatos do Mac, do que a pessoa escreveu na conversa e dos convidados das suas reuniões, que o seu Claude procura no calendário.",
						)}{" "}
						{tf("{a} de {b} com e-mail.", { a: known, b: q.data?.people.length ?? 0 })}
					</p>
				</div>
				<button
					type="button"
					disabled={running || !q.data?.next}
					onClick={() => find.mutate()}
					title={t(
						"Manda os mais próximos sem e-mail pro seu Claude procurar nos convidados do calendário",
					)}
					className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-muted hover:bg-sunken hover:text-ink disabled:opacity-60"
				>
					{running ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<Search className="size-3.5" />
					)}
					{running
						? t("Procurando no calendário…")
						: q.data?.next
							? tf("Buscar no calendário ({n})", { n: q.data.next })
							: t("Nada a buscar")}
				</button>
			</div>
			{q.data?.last && !running && (
				<p className="mt-3 text-[13px] text-faint">
					{tf("Última busca: {f} e-mails para {a} pessoas.", {
						f: q.data.last.found,
						a: q.data.last.asked,
					})}
				</p>
			)}
			<input
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				placeholder={t("Filtrar por nome ou número")}
				className="mt-5 h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm outline-none focus:border-accent"
			/>
			{pending.length > 0 && (
				<>
					<h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-faint">
						{tf("Sugestões ({n})", { n: pending.length })}
					</h2>
					<ul className="mt-2 grid gap-2">
						{pending.map((p) => (
							<Row key={p.pk} p={p} set={set.mutate} />
						))}
					</ul>
				</>
			)}
			<h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-faint">
				{t("Mais próximos primeiro")}
			</h2>
			<ul className="mt-2 grid gap-2">
				{rest.map((p) => (
					<Row key={p.pk} p={p} set={set.mutate} />
				))}
			</ul>
		</section>
	);
}

function Row({
	p,
	set,
}: {
	p: Person;
	set: (b: { phone: string; email: string; status: "ok" | "nao" }) => void;
}) {
	const [adding, setAdding] = useState(false);
	const [value, setValue] = useState("");
	const shown = p.emails.filter((e) => e.status !== "nao");
	return (
		<li className="rounded-xl border border-line bg-panel px-4 py-3">
			<div className="flex items-baseline gap-2">
				<span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
				<span className="shrink-0 text-[11px] tabular-nums text-faint">+{p.phone}</span>
			</div>
			<div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
				{shown.map((e) => (
					<span
						key={e.email}
						title={e.note ?? undefined}
						className={clsx(
							"inline-flex items-center gap-1 rounded-lg px-2 py-0.5",
							e.status === "sugerido" ? "bg-accent-soft text-ink" : "bg-sunken text-muted",
						)}
					>
						{e.email}
						<span className="text-[11px] text-faint">· {t(SOURCE[e.source] ?? e.source)}</span>
						{e.status === "sugerido" && (
							<>
								<button
									type="button"
									title={t("Confirmar")}
									onClick={() => set({ phone: p.phone, email: e.email, status: "ok" })}
									className="rounded p-0.5 text-accent hover:bg-panel"
								>
									<Check className="size-3.5" />
								</button>
								<button
									type="button"
									title={t("Não é")}
									onClick={() => set({ phone: p.phone, email: e.email, status: "nao" })}
									className="rounded p-0.5 text-faint hover:bg-panel hover:text-ink"
								>
									<X className="size-3.5" />
								</button>
							</>
						)}
					</span>
				))}
				{shown.length === 0 && !adding && (
					<span className="text-faint">
						{p.looked ? t("não achei no calendário") : t("sem e-mail")}
					</span>
				)}
				{adding ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())) {
								set({ phone: p.phone, email: value.trim(), status: "ok" });
								setAdding(false);
								setValue("");
							}
						}}
					>
						<input
							// biome-ignore lint/a11y/noAutofocus: opened by a click on "+ e-mail"
							autoFocus
							type="email"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onBlur={() => !value && setAdding(false)}
							placeholder="nome@empresa.com"
							className="h-7 w-56 rounded-lg border border-line bg-bg px-2 text-[13px] outline-none focus:border-accent"
						/>
					</form>
				) : (
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[12px] text-faint hover:bg-sunken hover:text-ink"
					>
						<Plus className="size-3" /> {t("e-mail")}
					</button>
				)}
			</div>
		</li>
	);
}
