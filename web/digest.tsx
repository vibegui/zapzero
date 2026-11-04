// Resumo dos grupos: once a week, what happened in the ~30 busiest groups and what involves the owner.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { api } from "./api.ts";
import { locale, t, tf } from "./i18n.ts";

const LEVEL = ["ruído", "leve", "vale ler", "precisa de você"];

export function DigestScreen() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["digest"],
		queryFn: api.digest,
		refetchInterval: (query) => (query.state.data?.running ? 4000 : false),
	});
	const make = useMutation({
		mutationFn: api.makeDigest,
		onSuccess: () => qc.invalidateQueries({ queryKey: ["digest"] }),
	});
	const d = q.data?.digest;
	const running = q.data?.running || make.isPending;
	return (
		<section className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-8">
			<div className="flex items-start gap-4">
				<div className="flex-1">
					<h1 className="text-[22px] font-semibold tracking-tight">{t("Resumo dos grupos")}</h1>
					<p className="mt-1 text-sm text-muted">
						{t(
							"Uma vez por semana o seu Claude lê os grupos mais movimentados e resume o que rolou e o que envolve você.",
						)}
						{d
							? tf(" Últimos 7 dias, gerado {when}.", {
									when: new Date(d.at).toLocaleString(locale(), {
										weekday: "long",
										hour: "2-digit",
										minute: "2-digit",
									}),
								})
							: ""}
					</p>
				</div>
				<button
					type="button"
					disabled={running}
					onClick={() => make.mutate()}
					className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-muted hover:bg-sunken hover:text-ink disabled:opacity-60"
				>
					{running ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<RefreshCw className="size-3.5" />
					)}
					{running ? t("Lendo os grupos…") : t("Gerar agora")}
				</button>
			</div>
			{!d && !running && (
				<div className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
					{t("Ainda não tem resumo. Ele sai sozinho na próxima leitura, ou clique em Gerar agora.")}
				</div>
			)}
			<div className="mt-6 grid gap-3">
				{d?.groups.map((g) => (
					<article
						key={g.pk}
						className={clsx(
							"rounded-xl border bg-panel p-4",
							g.relevancia >= 3 ? "border-accent/60" : "border-line",
							g.relevancia < 1 && "opacity-70",
						)}
					>
						<header className="flex items-baseline gap-2">
							<h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{g.name}</h2>
							<span
								className={clsx(
									"shrink-0 text-[11px]",
									g.relevancia >= 3 ? "text-accent" : "text-faint",
								)}
							>
								{t(LEVEL[Math.round(g.relevancia)] ?? "")} · {g.count} msgs
								{g.mine ? ` · ${tf("{n} suas", { n: g.mine })}` : ""}
							</span>
							<button
								type="button"
								onClick={() => api.open(g.pk)}
								title={t("Ir para conversa")}
								className="shrink-0 text-faint hover:text-ink"
							>
								<ExternalLink className="size-3.5" />
							</button>
						</header>
						<p className="mt-1.5 text-[14px] leading-relaxed text-muted">{g.resumo}</p>
						{g.voce && (
							<p className="mt-2 rounded-lg bg-accent-soft/60 px-3 py-2 text-[13px] text-ink">
								<b className="font-medium text-accent">{t("Você:")} </b>
								{g.voce}
							</p>
						)}
					</article>
				))}
			</div>
		</section>
	);
}
