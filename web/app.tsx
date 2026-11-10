import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import {
	Archive,
	BookUser,
	CalendarDays,
	ChartLine,
	Check,
	CheckCheck,
	Clock3,
	ExternalLink,
	EyeOff,
	Flame,
	Hourglass,
	Loader2,
	MessageCircleReply,
	Newspaper,
	Plug,
	RefreshCw,
	SkipForward,
	Sparkles,
	Tag,
	Undo2,
	UserRound,
	Users,
	X,
} from "lucide-react";
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { PROFILE_TOPICS, type Profile } from "../server/profile.ts";
import {
	ago,
	api,
	type CategoryId,
	type DecisionKind,
	type Inbox,
	type Item,
	TOKEN,
} from "./api.ts";
import { lang, locale, setLang, t, tf, tReason } from "./i18n.ts";
import { emailsIn, fill, hasTime, type Slot, slots } from "./slots.ts";

const ICONS: Record<CategoryId, typeof Flame> = {
	urgente: Flame,
	semana: CalendarDays,
	antigas: Clock3,
	acompanhar: Hourglass,
	grupos: Users,
	limpeza: Archive,
};

export const useInbox = () =>
	useQuery({ queryKey: ["inbox"], queryFn: api.inbox, refetchInterval: 30_000, enabled: !!TOKEN });

// ---- shell ---------------------------------------------------------------------------------

export function Shell() {
	const inbox = useInbox();
	// before any child renders, so the first paint is already in the right language
	setLang(inbox.data?.lang ?? "pt");
	document.documentElement.lang = lang() === "en" ? "en" : "pt-BR";
	if (!TOKEN)
		return (
			<Blank title={t("Falta o token")}>
				{t("Abra o painel com")} <code>?t=…</code> {t("(o token está em")}{" "}
				<code>$ZAP_DATA/token</code>).
			</Blank>
		);
	if (inbox.error)
		return (
			<Blank title={t("Sem acesso ao Mac")}>
				{(inbox.error as Error).message === "token"
					? t("Token inválido.")
					: t("O Mac está desligado ou fora do tailnet.")}
			</Blank>
		);
	return (
		<div className="flex h-full min-h-0">
			<Sidebar inbox={inbox.data} />
			<main className="flex min-w-0 flex-1 flex-col">
				{inbox.data?.voice.state === "suggested" && <VoiceBanner />}
				<div key={lang()} className="flex min-h-0 min-w-0 flex-1">
					<Outlet />
				</div>
			</main>
		</div>
	);
}

function Blank({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="grid h-full place-items-center p-6 text-center">
			<div>
				<div className="text-lg font-semibold">{title}</div>
				<div className="mt-1 text-sm text-muted">{children}</div>
			</div>
		</div>
	);
}

function Sidebar({ inbox }: { inbox?: Inbox }) {
	const qc = useQueryClient();
	const refresh = useMutation({
		mutationFn: api.refresh,
		onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["inbox"] }), 1500),
	});
	const cost = inbox?.spend24h.reduce((s, x) => s + x.cost, 0) ?? 0;
	return (
		<nav className="hidden w-60 shrink-0 flex-col border-r border-line bg-sunken md:flex">
			<div className="flex items-center gap-2 px-5 pt-5 pb-4">
				<div className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
					<MessageCircleReply className="size-4" />
				</div>
				<div className="font-semibold tracking-tight">zapzero</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
				<Search inbox={inbox} />
				<Link
					to="/agenda"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<CalendarDays className="size-4" />
					<span className="flex-1 truncate">{t("Pendências")}</span>
					<span className="text-xs tabular-nums text-faint">
						{inbox?.proposals.filter((p) => p.status === "pending").length || ""}
					</span>
				</Link>
				{inbox?.categories.map((c) => {
					const Icon = ICONS[c.id];
					return (
						<Link
							key={c.id}
							to="/c/$cat"
							params={{ cat: c.id }}
							className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
							activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
						>
							<Icon
								className={clsx("size-4", c.id === "urgente" && c.items.length > 0 && "text-hot")}
							/>
							<span className="flex-1 truncate">{t(c.label)}</span>
							<span className="text-xs tabular-nums text-faint">{c.items.length || ""}</span>
						</Link>
					);
				})}
				<Link
					to="/grupos"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<Newspaper className="size-4" />
					<span className="flex-1 truncate">{t("Resumo dos grupos")}</span>
				</Link>
				<Link
					to="/contatos"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<BookUser className="size-4" />
					<span className="flex-1 truncate">{t("Contatos e e-mails")}</span>
				</Link>
				<Areas inbox={inbox} />
				<Link
					to="/desempenho"
					className="mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<ChartLine className="size-4" />
					<span>{t("Desempenho")}</span>
				</Link>
				<Link
					to="/feitas"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<CheckCheck className="size-4" />
					<span>{t("Feitas")}</span>
				</Link>
				<Link
					to="/voz"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<UserRound className="size-4" />
					<span className="flex-1">{t("Seu jeito")}</span>
					{(inbox?.voice.state === "suggested" || inbox?.learned) && (
						<span className="size-2 rounded-full bg-accent" />
					)}
				</Link>
			</div>
			<div className="space-y-2 border-t border-line px-5 py-4 text-xs text-faint">
				<ConnectClaude />
				<div className="flex items-center justify-between">
					<span>
						{inbox?.refreshing
							? t("atualizando…")
							: inbox?.snapshotAt
								? tf("lido há {t}", { t: ago(inbox.snapshotAt) })
								: t("sem leitura")}
					</span>
					<button
						type="button"
						title={t("Ler o WhatsApp de novo")}
						onClick={() => refresh.mutate()}
						className="rounded p-1 hover:bg-panel hover:text-ink"
					>
						<RefreshCw
							className={clsx(
								"size-3.5",
								(inbox?.refreshing || refresh.isPending) && "animate-spin",
							)}
						/>
					</button>
				</div>
				{inbox?.last && !inbox.last.ok && <div className="text-hot">{inbox.last.log.at(-1)}</div>}
				<div>
					{t("IA nas últimas 24 h:")} ${cost.toFixed(3)}
				</div>
			</div>
		</nav>
	);
}

/** Copies the command that adds zapzero's local MCP to Claude Code (token included: it stays on this Mac). */
function ConnectClaude() {
	const [done, setDone] = useState(false);
	const port = location.hostname === "127.0.0.1" ? location.port : "8810";
	const cmd = `claude mcp add --scope user --transport http zapzero http://127.0.0.1:${port}/mcp --header "Authorization: Bearer ${TOKEN}"`;
	return (
		<button
			type="button"
			title={t("Copia o comando que adiciona o zapzero ao Claude Code. Cole no terminal.")}
			onClick={() =>
				navigator.clipboard.writeText(cmd).then(() => {
					setDone(true);
					setTimeout(() => setDone(false), 2500);
				})
			}
			className="-mx-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-panel hover:text-ink"
		>
			<Plug className="size-3.5" />
			{done ? t("Comando copiado: cole no terminal") : t("Conectar ao Claude")}
		</button>
	);
}

const fold = (s: string) =>
	s
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

/** Find a chat in the inbox by name; `/` focuses it. Click opens it in its category. */
function Search({ inbox }: { inbox?: Inbox }) {
	const [q, setQ] = useState("");
	const navigate = useNavigate();
	const hits = useMemo(() => {
		const f = fold(q.trim());
		if (!f || !inbox) return [];
		const seen = new Set<number>();
		return inbox.categories
			.flatMap((c) => c.items.map((i) => ({ ...i, catLabel: c.label })))
			.filter((i) => fold(i.name).includes(f) && !seen.has(i.pk) && seen.add(i.pk))
			.slice(0, 20);
	}, [q, inbox]);
	return (
		<div className="mb-2 px-1">
			<input
				data-search
				value={q}
				onChange={(e) => setQ(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						setQ("");
						e.currentTarget.blur();
					}
					if (e.key === "Enter" && hits[0]) {
						navigate({
							to: "/c/$cat",
							params: { cat: hits[0].category },
							search: { pk: hits[0].pk },
						});
						setQ("");
						e.currentTarget.blur();
					}
				}}
				placeholder={t("Buscar nome  /")}
				className="w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-accent"
			/>
			{q.trim() && (
				<div className="mt-1 space-y-0.5">
					{hits.map((i) => (
						<button
							key={i.pk}
							type="button"
							onClick={() => {
								navigate({ to: "/c/$cat", params: { cat: i.category }, search: { pk: i.pk } });
								setQ("");
							}}
							className="flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-panel"
						>
							<span className="flex-1 truncate">{i.name}</span>
							<span className="shrink-0 text-[11px] text-faint">{t(i.catLabel)}</span>
						</button>
					))}
					{hits.length === 0 && (
						<div className="px-3 py-1.5 text-[12px] text-faint">
							{t("Nada na caixa com esse nome.")}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function Areas({ inbox }: { inbox?: Inbox }) {
	const qc = useQueryClient();
	const after = { onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }) };
	const act = useMutation({
		mutationFn: (b: { action: "accept" | "dismiss"; id: string }) => api.area(b.action, b.id),
		...after,
	});
	const suggest = useMutation({ mutationFn: api.suggest, ...after });
	if (!inbox) return null;
	const counts = new Map<string, number>();
	for (const c of inbox.categories)
		if (AREA_SOURCES.includes(c.id))
			for (const i of c.items) if (i.area) counts.set(i.area, (counts.get(i.area) ?? 0) + 1);
	const areas = inbox.areas.filter((a) => counts.get(a.id));
	return (
		<>
			<div className="mt-4 mb-1 px-3 text-[11px] font-medium tracking-wide text-faint uppercase">
				{t("Tags")}
			</div>
			{areas.map((a) => (
				<Link
					key={a.id}
					to="/a/$area"
					params={{ area: a.id }}
					className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<Tag className="tag-dot size-3.5" style={tagStyle(inbox.areas, a.id)} />
					<span className="flex-1 truncate">{t(a.label)}</span>
					<span className="text-xs tabular-nums text-faint">{counts.get(a.id)}</span>
				</Link>
			))}
			<div className="mt-3 mb-1 flex items-center justify-between px-3 text-[11px] font-medium tracking-wide text-faint uppercase">
				<span>{t("Sugestões")}</span>
				<button
					type="button"
					title={t("Sugerir tags novas agora")}
					onClick={() => suggest.mutate()}
					className="rounded p-0.5 hover:bg-panel hover:text-ink"
				>
					{suggest.isPending ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<Sparkles className="size-3.5" />
					)}
				</button>
			</div>
			{inbox.suggestions.map((sg) => (
				<div
					key={sg.id}
					className="mx-1 mb-1.5 rounded-lg border border-dashed border-line px-3 py-2"
				>
					<div className="flex items-center gap-1.5 text-sm text-ink">
						<Sparkles className="size-3.5 shrink-0 text-accent" />
						<span className="flex-1 truncate">{sg.label}</span>
						<span className="text-xs tabular-nums text-faint">{sg.pks.length}</span>
					</div>
					<div className="mt-1 text-[11px] leading-snug text-muted" title={sg.names.join(", ")}>
						{sg.reason}
					</div>
					<div className="mt-1.5 flex gap-1.5">
						<button
							type="button"
							onClick={() => act.mutate({ action: "accept", id: sg.id })}
							className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-ink"
						>
							<Check className="size-3" /> {t("Criar tag")}
						</button>
						<button
							type="button"
							onClick={() => act.mutate({ action: "dismiss", id: sg.id })}
							className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-faint hover:text-ink"
						>
							<X className="size-3" /> {t("Não")}
						</button>
					</div>
				</div>
			))}
			{inbox.suggestions.length === 0 && (
				<div className="px-3 text-[11px] text-faint">{t("Nenhuma agora. ✨ para pedir.")}</div>
			)}
		</>
	);
}

// ---- category: ranked list + focus -----------------------------------------------------------

type Pick = { pk: number; lastPk: number };
type Toast = { text: string; pk: number; lastPk: number; many?: Pick[] } | null;

type View = { kind: "cat"; id: CategoryId } | { kind: "area"; id: string };
/** where an area's items come from: everything that still needs the owner */
const AREA_SOURCES: CategoryId[] = ["urgente", "semana", "antigas", "acompanhar"];

function viewItems(inbox: Inbox | undefined, view: View): { label: string; items: Item[] } {
	if (!inbox) return { label: "", items: [] };
	if (view.kind === "cat") {
		const c = inbox.categories.find((x) => x.id === view.id);
		return { label: c?.label ?? "", items: c?.items ?? [] };
	}
	// urgent first, then the rest by score
	const items = AREA_SOURCES.flatMap((k) =>
		(inbox.categories.find((c) => c.id === k)?.items ?? []).filter((i) => i.area === view.id),
	);
	return { label: inbox.areas.find((a) => a.id === view.id)?.label ?? view.id, items };
}

export function Category({ view, pk }: { view: View; pk?: number }) {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const inbox = useInbox();
	const { label, items } = viewItems(inbox.data, view);
	const areaLabel = (id: string | null) => {
		const l = inbox.data?.areas.find((a) => a.id === id)?.label;
		return l && t(l);
	};
	const idx = Math.max(0, pk ? items.findIndex((i) => i.pk === pk) : 0);
	const item = items[idx];
	const [toast, setToast] = useState<Toast>(null);
	// Limpeza: tick several, A clears them all (only zapzero's list; lastPk 0 = a chat with no synced message)
	const bulk = view.kind === "cat" && view.id === "limpeza";
	const [picked, setPicked] = useState<Set<number>>(new Set());
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new view starts with nothing ticked
	useEffect(() => setPicked(new Set()), [view.id]);
	const toggle = (p: number) =>
		setPicked((s) => {
			const n = new Set(s);
			n.has(p) ? n.delete(p) : n.add(p);
			return n;
		});
	const many = useMutation({
		mutationFn: (kind: "archive" | "done") =>
			api.decideMany({
				kind,
				items: items
					.filter((i) => picked.has(i.pk))
					.map((i) => ({ pk: i.pk, lastPk: i.lastPk ?? 0 })),
			}),
		onSuccess: (r, kind) => {
			const done = items
				.filter((i) => picked.has(i.pk))
				.map((i) => ({ pk: i.pk, lastPk: i.lastPk ?? 0 }));
			setPicked(new Set());
			setToast({
				text: tf(kind === "archive" ? "{n} marcadas para arquivar" : "{n} resolvidas", { n: r.n }),
				pk: 0,
				lastPk: 0,
				many: done,
			});
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
	});
	const undoToast = () => {
		if (!toast) return;
		if (toast.many)
			api.undoMany({ items: toast.many }).then(() => {
				setToast(null);
				qc.invalidateQueries({ queryKey: ["inbox"] });
			});
		else undo.mutate({ pk: toast.pk, lastPk: toast.lastPk });
	};

	const select = useCallback(
		(p: number | undefined) =>
			view.kind === "cat"
				? navigate({
						to: "/c/$cat",
						params: { cat: view.id },
						search: p ? { pk: p } : {},
						replace: true,
					})
				: navigate({
						to: "/a/$area",
						params: { area: view.id },
						search: p ? { pk: p } : {},
						replace: true,
					}),
		[view.kind, view.id, navigate],
	);
	const move = (d: number) => {
		const n = items[Math.min(items.length - 1, Math.max(0, idx + d))];
		if (n) select(n.pk);
	};

	const decide = useMutation({
		mutationFn: api.decide,
		onMutate: (b) => {
			// optimistic: drop it from the list and move to the next one
			const next = items[idx + 1] ?? items[idx - 1];
			qc.setQueryData<Inbox>(
				["inbox"],
				(old) =>
					old && {
						...old,
						categories: old.categories.map((c) => ({
							...c,
							items: c.items.filter((i) => i.pk !== b.pk),
						})),
					},
			);
			select(next?.pk);
			// the name, read before the item leaves the list
			return { name: items.find((i) => i.pk === b.pk)?.name ?? "" };
		},
		onSuccess: (r, b, ctx) => {
			const name = ctx?.name ?? "";
			const text =
				b.kind === "reply"
					? r.via === "whatsapp"
						? tf("Aberto no WhatsApp: aperte Enter lá para enviar a {name}", { name })
						: tf("Texto copiado: cole na conversa com {name}", { name })
					: b.kind === "archive"
						? tf("{name}: marcada para arquivar", { name })
						: b.kind === "ignore"
							? tf("{name}: ignorada para sempre", { name })
							: b.kind === "done"
								? tf("{name}: resolvida", { name })
								: tf("{name}: pulada até chegar mensagem nova", { name });
			setToast({
				text: r.event ? `${text} · ${t("criando o evento no seu calendário")}` : text,
				pk: b.pk,
				lastPk: b.kind === "ignore" ? 0 : b.lastPk,
			});
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
	});
	const undo = useMutation({
		mutationFn: api.undo,
		onSuccess: (_r, b) => {
			setToast(null);
			qc.invalidateQueries({ queryKey: ["inbox"] }).then(() => select(b.pk));
		},
	});

	const act = (kind: DecisionKind, text?: string, event?: boolean, invite?: string[]) => {
		if (!item?.lastPk) return;
		decide.mutate({ pk: item.pk, lastPk: item.lastPk, kind, text, event, invite });
	};

	useEffect(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(null), 8000);
		return () => clearTimeout(t);
	}, [toast]);

	// keyboard: the whole point is YES YES YES
	const focusRef = useRef<FocusHandle>(null);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const el = e.target as HTMLElement;
			if (
				el.tagName === "TEXTAREA" ||
				(el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox")
			)
				return;
			const k = e.key.toLowerCase();
			const run: Record<string, () => void> = {
				j: () => move(1),
				arrowdown: () => move(1),
				k: () => move(-1),
				arrowup: () => move(-1),
				y: () => focusRef.current?.reply(),
				enter: () => focusRef.current?.reply(),
				e: () => focusRef.current?.edit(),
				c: () => focusRef.current?.toggleEvent(),
				"/": () => document.querySelector<HTMLInputElement>("[data-search]")?.focus(),
				r: () => focusRef.current?.redraft(),
				d: () => (focusRef.current ? focusRef.current.done() : act("done")),
				a: () => (picked.size ? many.mutate("archive") : act("archive")),
				x: () => bulk && item && toggle(item.pk),
				s: () => act("skip"),
				i: () => act("ignore"),
				o: () => item && api.open(item.pk),
				z: undoToast,
			};
			// 1–9: pick that choice in the draft's first open [slot]
			if (/^[1-9]$/.test(k) && focusRef.current?.pick(Number(k) - 1)) {
				e.preventDefault();
				return;
			}
			if (run[k]) {
				e.preventDefault();
				run[k]();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (!inbox.data) return <Blank title={t("Lendo…")}>{t("Carregando o inbox do Mac.")}</Blank>;
	return (
		<>
			<section className="hidden w-[360px] shrink-0 flex-col border-r border-line bg-panel lg:flex">
				<header className="flex items-baseline justify-between px-5 pt-5 pb-3">
					<h1 className="text-[15px] font-semibold tracking-tight">{t(label)}</h1>
					<span className="text-xs tabular-nums text-faint">{items.length}</span>
				</header>
				{bulk && items.length > 0 && (
					<div className="flex items-center gap-2 px-5 pb-3 text-xs">
						<button
							type="button"
							className="text-muted hover:text-ink"
							onClick={() =>
								setPicked(
									picked.size === items.length ? new Set() : new Set(items.map((i) => i.pk)),
								)
							}
						>
							{picked.size === items.length ? t("Desmarcar todas") : t("Marcar todas")}
						</button>
						<span className="flex-1 text-faint">
							<kbd>X</kbd> {t("marca")}
						</span>
						{picked.size > 0 && (
							<button
								type="button"
								disabled={many.isPending}
								onClick={() => many.mutate("archive")}
								className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 font-medium text-accent-ink"
							>
								<Archive className="size-3.5" /> {tf("Arquivar {n}", { n: picked.size })}{" "}
								<kbd>A</kbd>
							</button>
						)}
					</div>
				)}
				<ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
					{items.map((i) => (
						<li key={i.pk} className="flex items-start gap-1">
							{bulk && (
								<input
									type="checkbox"
									aria-label={tf("Marcar {name}", { name: i.name })}
									checked={picked.has(i.pk)}
									onChange={() => toggle(i.pk)}
									className="mt-3.5 ml-2 size-3.5 shrink-0 accent-[var(--accent)]"
								/>
							)}
							<button
								type="button"
								onClick={() => select(i.pk)}
								className={clsx(
									"min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition-colors",
									i.pk === item?.pk ? "bg-accent-soft" : "hover:bg-sunken",
								)}
							>
								<div className="flex items-center gap-2">
									<span className="flex-1 truncate text-sm font-medium">{i.name}</span>
									{i.unread > 0 && (
										<span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-ink tabular-nums">
											{i.unread}
										</span>
									)}
									<span className="text-[11px] tabular-nums text-faint">
										{ago(i.waitingSince ?? i.lastAt)}
									</span>
								</div>
								<div className="mt-0.5 truncate text-[13px] text-muted">{t(i.preview)}</div>
								<div className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
									{areaLabel(i.area) && (
										<span
											className="tag rounded px-1.5 py-px"
											style={tagStyle(inbox.data?.areas, i.area)}
										>
											{areaLabel(i.area)}
										</span>
									)}
									<span className="truncate">{tReason(i.reason)}</span>
									{i.draft && (
										<span className="inline-flex items-center gap-0.5 text-accent">
											<Sparkles className="size-3" /> {t("rascunho")}
										</span>
									)}
								</div>
							</button>
						</li>
					))}
					{items.length === 0 && (
						<li className="px-3 py-10 text-center text-sm text-faint">{t("Zerado. 🎉")}</li>
					)}
				</ul>
			</section>
			<section className="relative flex min-w-0 flex-1 flex-col">
				{item ? (
					<Focus
						// a new draft (R, or an agent writing one) resets the editor
						key={`${item.pk}:${item.lastPk}:${item.draft ?? ""}`}
						item={item}
						areaLabel={areaLabel(item.area)}
						position={tf("{a} de {b}", { a: idx + 1, b: items.length })}
						act={act}
						handle={focusRef}
					/>
				) : (
					<Blank title={t("Nada aqui")}>{t("Escolha outra categoria.")}</Blank>
				)}
				{toast && (
					<div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
						<div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-bg shadow-lg">
							<span>{toast.text}</span>
							<button
								type="button"
								onClick={undoToast}
								className="inline-flex items-center gap-1 font-medium opacity-80 hover:opacity-100"
							>
								<Undo2 className="size-3.5" /> {t("desfazer")} <kbd>Z</kbd>
							</button>
						</div>
					</div>
				)}
			</section>
		</>
	);
}

function Focus({
	item,
	areaLabel,
	position,
	act,
	handle,
}: {
	item: Item;
	areaLabel?: string;
	position: string;
	act: (kind: DecisionKind, text?: string, event?: boolean, invite?: string[]) => void;
	handle: RefObject<FocusHandle | null>;
}) {
	const chat = useQuery({
		queryKey: ["chat", item.pk, item.lastPk],
		queryFn: () => api.chat(item.pk),
	});
	const [text, setText] = useState(item.draft ?? "");
	const calendar = useInbox().data?.calendar ?? false;
	const [eventOn, setEventOn] = useState(true);
	// a call agreed earlier in the chat (pending invite) is offered whatever the reply says
	const pendingCall = calendar && item.invite != null;
	const offersEvent = pendingCall || (calendar && !item.group && hasTime(text));
	// the other person shared an e-mail for the call: invite it (they see it before Y, and can untick)
	// …or the base already knows it (Contacts, the e-mail screen, an earlier chat)
	const known = useQuery({
		queryKey: ["emails", item.pk],
		queryFn: () => api.emailsOf(item.pk),
		enabled: calendar && !item.group,
	});
	const emails = useMemo(
		() => [
			...new Set([
				...emailsIn(
					(chat.data ?? [])
						.filter((m) => !m.mine)
						.slice(-15)
						.map((m) => m.text),
				),
				...(known.data ?? []),
			]),
		],
		[chat.data, known.data],
	);
	const [inviteOn, setInviteOn] = useState(true);
	// an event already created for this chat: when the person sends their e-mail afterwards, offer the invite
	const ev = useQuery({
		queryKey: ["event", item.pk],
		queryFn: () => api.event(item.pk),
		enabled: calendar && !item.group,
	});
	const newGuests = emails.filter((e) => ev.data && !ev.data.guests.includes(e));
	const asksEmail = /e-?mail/i.test(text);
	const box = useRef<HTMLTextAreaElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const redraft = useMutation({
		mutationFn: () => api.draft(item.pk),
		onSuccess: (r) => setText(r.text),
	});
	const cleanup = item.category === "limpeza";
	// the draft's [choices] as a form: when the last one is answered, the message is rewritten around them
	const form = useRef<{ template: string; picks: { slot: string; value: string }[] } | null>(null);
	const compose = useMutation({
		mutationFn: (f: NonNullable<typeof form.current>) => api.compose(item.pk, f),
		onSuccess: (r) => {
			form.current = null;
			setText(r.text);
		},
	});
	const fillSlot = (s: Slot, value: string) => {
		form.current ??= { template: text, picks: [] };
		form.current.picks.push({ slot: text.slice(s.start + 1, s.end - 1), value });
		const next = fill(text, s, value);
		setText(next);
		if (slots(next).length === 0) compose.mutate(form.current);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the bottom when messages arrive
	useEffect(() => {
		scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
	}, [chat.data]);

	const reply = () => {
		const el = box.current;
		if (!text.trim() || compose.isPending) {
			el?.focus();
			return;
		}
		// a [slot] is a decision the draft left to the owner: go fill it instead of sending it
		if (open.length) {
			document.querySelector<HTMLInputElement>("[data-slot-input]")?.focus();
			return;
		}
		act(
			"reply",
			text.trim(),
			offersEvent && eventOn,
			offersEvent && eventOn && inviteOn ? emails : [],
		);
	};
	const open = slots(text);
	const done = () => act("done", undefined, pendingCall && eventOn);
	handle.current = {
		reply,
		toggleEvent: () => offersEvent && setEventOn((v) => !v),
		done,
		pick: (i) => {
			const s = open[0];
			if (!s?.options[i]) return false;
			fillSlot(s, s.options[i]);
			return true;
		},
		edit: () => {
			const el = box.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		},
		redraft: () => redraft.mutate(),
	};

	const days = useMemo(() => {
		let lastDay = "";
		return (chat.data ?? []).map((m) => {
			const d = new Date(m.at).toLocaleDateString(locale(), { day: "2-digit", month: "short" });
			const show = d !== lastDay;
			lastDay = d;
			return { m, day: show ? d : null };
		});
	}, [chat.data]);

	return (
		<>
			<header className="flex items-center gap-3 border-b border-line px-6 py-4">
				<div className="min-w-0 flex-1">
					<div className="truncate text-[15px] font-semibold tracking-tight">{item.name}</div>
					<div className="truncate text-xs text-muted">
						{areaLabel ? `${areaLabel} · ` : ""}
						{tReason(item.reason)}
						{item.waitingSince ? ` · ${tf("esperando há {t}", { t: ago(item.waitingSince) })}` : ""}
						{item.phone && !item.name.includes(item.phone) ? ` · +${item.phone}` : ""}
					</div>
				</div>
				<Btn onClick={() => api.open(item.pk)} k="O">
					<ExternalLink className="size-4" /> {t("Ir para conversa")}
				</Btn>
				<span className="text-xs tabular-nums text-faint">{position}</span>
			</header>

			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-sunken px-6 py-4">
				{chat.isLoading && <Loader2 className="mx-auto size-4 animate-spin text-faint" />}
				{chat.data?.length === 0 && (
					<div className="py-10 text-center text-sm text-faint">
						{t("O Mac não tem o texto desta conversa (só sincroniza ~3 meses).")}
					</div>
				)}
				<div className="mx-auto flex max-w-2xl flex-col gap-1.5">
					{days.map(({ m, day }) => (
						<div key={m.pk} className="contents">
							{day && <div className="my-2 text-center text-[11px] text-faint">{day}</div>}
							<div
								className={clsx(
									"max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug shadow-[0_1px_0_rgba(0,0,0,.04)]",
									m.mine
										? "self-end rounded-br-md bg-bubble-me"
										: "self-start rounded-bl-md bg-bubble-them",
								)}
							>
								{item.group && !m.mine && (
									<div className="mb-0.5 text-[11px] font-medium text-accent">{m.who}</div>
								)}
								{m.media && <Media pk={m.pk} />}
								{!(m.media && /^\[(imagem|sticker)\]$/.test(m.text)) && (
									<div className="whitespace-pre-wrap break-words">{linkify(m.text)}</div>
								)}
								<div className="mt-0.5 text-right text-[10px] text-faint">
									{new Date(m.at).toLocaleTimeString(locale(), {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<footer className="border-t border-line bg-panel px-6 py-4">
				{!cleanup && (
					<div className="mx-auto max-w-3xl">
						{ev.data &&
							ev.data.guests.length > 0 &&
							newGuests.length === 0 &&
							emails.length > 0 && (
								<div className="mb-2 flex items-center gap-1.5 text-[12px] text-accent">
									<CalendarDays className="size-3.5" /> {ev.data.guests.join(", ")}{" "}
									{t("no convite de")} {ev.data.when}
								</div>
							)}
						{open.length > 0 && <SlotBar slots={open} onFill={fillSlot} />}
						{compose.isPending && (
							<div className="mb-2 flex items-center gap-1.5 text-[12px] text-accent">
								<Loader2 className="size-3.5 animate-spin" />{" "}
								{t("reescrevendo com o que você escolheu, no seu tom…")}
							</div>
						)}
						{compose.isError && (
							<div className="mb-2 text-[12px] text-hot">
								{tf("Não deu pra reescrever ({e}); o texto ficou com as escolhas coladas.", {
									e: (compose.error as Error).message,
								})}
							</div>
						)}
						<div className="relative">
							<textarea
								ref={box}
								value={text}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") e.currentTarget.blur();
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										e.preventDefault();
										reply();
									}
								}}
								placeholder={
									item.draft
										? ""
										: item.triaged
											? t("Sem rascunho: escreva, ou R para gerar")
											: t("Escreva a resposta")
								}
								className="max-h-72 min-h-24 w-full resize-none rounded-xl [field-sizing:content] border border-line bg-bg px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-accent"
							/>
							{redraft.isPending && (
								<Loader2 className="absolute top-3 right-3 size-4 animate-spin text-faint" />
							)}
						</div>
						{redraft.error && (
							<div className="mt-1 text-xs text-hot">{(redraft.error as Error).message}</div>
						)}
					</div>
				)}
				{!cleanup && pendingCall && item.invite && (
					<label className="mx-auto mt-2 flex max-w-3xl cursor-pointer items-start gap-2 text-[13px] text-muted">
						<input
							type="checkbox"
							checked={eventOn}
							onChange={(e) => setEventOn(e.target.checked)}
							className="mt-0.5 accent-accent"
						/>
						<CalendarDays className="mt-0.5 size-3.5 shrink-0" />
						<span>
							{t("Ao responder ou resolver, garantir a call no calendário com")}{" "}
							<span className="text-ink">{item.invite.email}</span> <kbd>C</kbd>
							<span className="block line-clamp-1 text-[12px] text-faint">
								{tf("você combinou: «{agreed}» · seu Claude acha o evento ou cria, e convida", {
									agreed: item.invite.agreed,
								})}
							</span>
						</span>
					</label>
				)}
				{!cleanup && offersEvent && !pendingCall && (
					<label className="mx-auto mt-2 flex max-w-3xl cursor-pointer items-center gap-2 text-[13px] text-muted">
						<input
							type="checkbox"
							checked={eventOn}
							onChange={(e) => setEventOn(e.target.checked)}
							className="accent-accent"
						/>
						<CalendarDays className="size-3.5" />
						{t("Ao responder, criar o evento no meu calendário")} <kbd>C</kbd>
						<span className="text-faint">
							{t("· seu Claude cria")}
							{emails.length && inviteOn ? "" : t(", só na sua agenda, sem convidados")}
						</span>
					</label>
				)}
				{!cleanup &&
					offersEvent &&
					!pendingCall &&
					eventOn &&
					emails.length === 0 &&
					!asksEmail && (
						<div className="mx-auto mt-1 max-w-3xl pl-6">
							<button
								type="button"
								onClick={() =>
									setText(`${text.trimEnd()} ${t("Me passa seu e-mail que te mando o convite?")}`)
								}
								className="rounded-lg border border-line px-2 py-0.5 text-[12px] text-muted hover:border-accent hover:text-ink"
							>
								{t("+ pedir o e-mail dele pro convite")}
							</button>
						</div>
					)}
				{!cleanup && offersEvent && !pendingCall && eventOn && emails.length > 0 && (
					<label className="mx-auto mt-1 flex max-w-3xl cursor-pointer items-center gap-2 pl-6 text-[13px] text-muted">
						<input
							type="checkbox"
							checked={inviteOn}
							onChange={(e) => setInviteOn(e.target.checked)}
							className="accent-accent"
						/>
						{t("convidar")} <span className="text-ink">{emails.join(", ")}</span>
						<span className="text-faint">{t("· recebe o convite do Google por e-mail")}</span>
					</label>
				)}
				<div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-2">
					{!cleanup && (
						<Btn primary onClick={reply} k="Y">
							<MessageCircleReply className="size-4" /> {t("Responder no WhatsApp")}
						</Btn>
					)}
					{cleanup && (
						<Btn primary onClick={() => act("archive")} k="A">
							<Archive className="size-4" /> {t("Arquivar")}
						</Btn>
					)}
					{!cleanup && !item.group && (
						<Btn onClick={() => redraft.mutate()} k="R">
							<Sparkles className="size-3.5" /> {t("Novo rascunho")}
						</Btn>
					)}
					<div className="flex-1" />
					<Btn onClick={done} k="D">
						<CheckCheck className="size-3.5" /> {t("Resolvida")}
					</Btn>
					{!cleanup && (
						<Btn onClick={() => act("archive")} k="A">
							<Archive className="size-3.5" /> {t("Arquivar")}
						</Btn>
					)}
					<Btn onClick={() => act("skip")} k="S">
						<SkipForward className="size-3.5" /> {t("Pular")}
					</Btn>
					<Btn onClick={() => act("ignore")} k="I">
						<EyeOff className="size-3.5" /> {t("Ignorar sempre")}
					</Btn>
				</div>
				<div className="mx-auto mt-2 max-w-3xl text-[11px] text-faint">
					{cleanup
						? t("Arquivar tira daqui; no WhatsApp, arquive você mesmo.")
						: t(
								"Responder abre a conversa no WhatsApp com o texto escrito. Só sai quando você aperta Enter lá.",
							)}{" "}
					<kbd>E</kbd> {t("edita")} · <kbd>1</kbd>–<kbd>9</kbd> {t("escolhe o que falta")} ·{" "}
					<kbd>J</kbd>/<kbd>K</kbd> {t("navega")} · <kbd>O</kbd> {t("abre a conversa")} ·{" "}
					<kbd>⌘↵</kbd> {t("responde editando")}
				</div>
			</footer>
		</>
	);
}

type FocusHandle = {
	reply: () => void;
	edit: () => void;
	redraft: () => void;
	toggleEvent: () => void;
	/** resolve; also schedules a pending call when its toggle is on */
	done: () => void;
	/** fill the first open slot with its i-th choice; false when there is none */
	pick: (i: number) => boolean;
};

/** What the draft left for the owner to decide, one row per [slot]: click a choice or type one. */
function SlotBar({
	slots: list,
	onFill,
}: {
	slots: ReturnType<typeof slots>;
	onFill: (s: ReturnType<typeof slots>[number], v: string) => void;
}) {
	return (
		<div className="mb-2 space-y-2 rounded-xl border border-warn/40 bg-warn/5 p-3">
			<div className="text-[11px] font-medium text-warn">
				{list.length > 1
					? tf("Falta você decidir {n} coisas", { n: list.length })
					: t("Falta você decidir uma coisa")}
			</div>
			{list.map((s, i) => (
				<div key={s.start} className="flex flex-wrap items-center gap-1.5">
					{s.hint && <span className="text-[13px] text-muted">{s.hint}</span>}
					{s.options.map((o, j) => (
						<button
							key={o}
							type="button"
							onClick={() => onFill(s, o)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1 text-[13px] hover:border-accent hover:text-ink"
						>
							{i === 0 && j < 9 && <kbd>{j + 1}</kbd>}
							{o}
						</button>
					))}
					<input
						data-slot-input={i === 0 ? "" : undefined}
						placeholder={s.options.length ? t("outro…") : t("escreva e Enter")}
						onKeyDown={(e) => {
							const v = e.currentTarget.value.trim();
							if (e.key === "Enter" && v) {
								e.preventDefault();
								onFill(s, v);
							}
							if (e.key === "Escape") e.currentTarget.blur();
						}}
						className="min-w-28 flex-1 rounded-lg border border-line bg-bg px-2.5 py-1 text-[13px] outline-none focus:border-accent"
					/>
				</div>
			))}
		</div>
	);
}

function Btn({
	children,
	onClick,
	k,
	primary,
}: {
	children: ReactNode;
	onClick: () => void;
	k: string;
	primary?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				"inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
				primary
					? "bg-accent px-4 text-accent-ink hover:brightness-110"
					: "border border-line text-muted hover:bg-sunken hover:text-ink",
			)}
		>
			{children}
			<kbd className="ml-1">{k}</kbd>
		</button>
	);
}

// ---- done ----------------------------------------------------------------------------------

const KIND_LABEL: Record<DecisionKind, string> = {
	reply: "respondida",
	done: "resolvida",
	skip: "pulada",
	archive: "arquivar",
	ignore: "ignorada sempre",
};

export function Done() {
	const qc = useQueryClient();
	const list = useQuery({
		queryKey: ["decisions"],
		queryFn: api.decisions,
		// poll while a calendar event is being created
		refetchInterval: (q) =>
			q.state.data?.some((d) => d.event?.status === "pending") ? 3000 : false,
	});
	const undo = useMutation({
		mutationFn: api.undo,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["decisions"] });
			qc.invalidateQueries({ queryKey: ["inbox"] });
		},
	});
	return (
		<section className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-6">
			<h1 className="mb-4 text-[15px] font-semibold tracking-tight">{t("Feitas")}</h1>
			<ul className="divide-y divide-line rounded-xl border border-line bg-panel">
				{list.data?.map((d) => (
					<li key={`${d.pk}:${d.last_pk}`} className="flex items-start gap-3 px-4 py-3">
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline gap-2">
								<span className="truncate text-sm font-medium">{d.name}</span>
								<span className="text-[11px] text-faint">
									{t(KIND_LABEL[d.kind])} · {ago(d.at)}
								</span>
							</div>
							{d.text && <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">{d.text}</div>}
							{d.event && (
								<div
									className={clsx(
										"mt-1 inline-flex items-center gap-1 text-[12px]",
										d.event.status === "ok"
											? "text-accent"
											: d.event.status === "error"
												? "text-hot"
												: "text-faint",
									)}
								>
									<CalendarDays className="size-3.5" />
									{d.event.status === "pending"
										? t("criando o evento…")
										: d.event.status === "ok"
											? `${t("no calendário:")} ${d.event.result?.replace(/^CRIADO:\s*/, "")}`
											: d.event.status === "skipped"
												? `${t("evento não criado:")} ${d.event.result?.replace(/^NAO_CRIADO:\s*/, "")}`
												: `${t("erro no evento:")} ${d.event.result}`}
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={() => undo.mutate({ pk: d.pk, lastPk: d.last_pk })}
							className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink"
						>
							<Undo2 className="size-3.5" /> {t("desfazer")}
						</button>
					</li>
				))}
				{list.data?.length === 0 && (
					<li className="px-4 py-10 text-center text-sm text-faint">{t("Nada ainda.")}</li>
				)}
			</ul>
		</section>
	);
}

// ---- seu jeito: who the owner is and how they write ---------------------------------------

function VoiceBanner() {
	const navigate = useNavigate();
	return (
		<button
			type="button"
			onClick={() => navigate({ to: "/voz" })}
			className="flex items-center gap-2 border-b border-line bg-accent-soft px-5 py-2 text-left text-[13px] text-ink"
		>
			<Sparkles className="size-3.5 text-accent" />
			<span className="flex-1">
				{t(
					"Li suas mensagens e escrevi como você escreve. Confere antes dos rascunhos seguirem isso?",
				)}
			</span>
			<span className="font-medium text-accent">{t("Conferir →")}</span>
		</button>
	);
}

export function VoiceScreen() {
	const qc = useQueryClient();
	const inbox = useInbox();
	const v = inbox.data?.voice;
	// local edits only; null = show what the server has
	const [edits, setEdits] = useState<Partial<Profile>>({});
	const [voz, setVoz] = useState<string | null>(null);
	const perfil = { ...(v?.perfil ?? ({} as Profile)), ...edits };
	const z = voz ?? v?.voz ?? "";
	const reset = () => {
		setEdits({});
		setVoz(null);
		qc.invalidateQueries({ queryKey: ["inbox"] });
	};
	const save = useMutation({
		mutationFn: () => api.saveVoice({ perfil, voz: z }),
		onSuccess: reset,
	});
	const regen = useMutation({ mutationFn: api.suggestVoice, onSuccess: reset });
	const dirty = Object.keys(edits).length > 0 || voz != null;
	if (!v) return <Blank title={t("Lendo…")}>{t("Carregando.")}</Blank>;
	const field =
		"mt-1.5 w-full resize-y rounded-xl border border-line bg-panel px-4 py-2.5 text-[14px] leading-relaxed outline-none [field-sizing:content] focus:border-accent";
	return (
		<section className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-8">
			<h1 className="text-[22px] font-semibold tracking-tight">{t("Seu jeito")}</h1>
			<p className="mt-1 text-sm text-muted">
				{v.state === "suggested"
					? t(
							"A IA leu suas mensagens, suas conversas mais ativas e seus grupos, e escreveu isto. A triagem e os rascunhos seguem esse texto: aceite ou ajuste cada parte.",
						)
					: v.state === "accepted"
						? t("A triagem e os rascunhos seguem este texto. Mude quando quiser.")
						: t("Depois do primeiro scan a IA preenche isto a partir das suas conversas.")}
			</p>

			<h2 className="mt-8 text-[15px] font-semibold">{t("Quem é você")}</h2>
			<div className="mt-2 grid gap-5">
				{PROFILE_TOPICS.map((topic) => (
					<div key={topic.id}>
						<label className="block text-[13px] font-medium" htmlFor={`p-${topic.id}`}>
							{t(topic.label)}
						</label>
						<p className="text-xs text-faint">{t(topic.hint)}</p>
						<textarea
							id={`p-${topic.id}`}
							value={perfil[topic.id] ?? ""}
							onChange={(e) => setEdits((x) => ({ ...x, [topic.id]: e.target.value }))}
							placeholder="—"
							className={clsx(field, "min-h-11")}
						/>
					</div>
				))}
			</div>

			<h2 className="mt-10 text-[15px] font-semibold">{t("Como você escreve")}</h2>
			<p className="text-xs text-faint">
				{t("Tamanho, tom, pontuação, emoji, expressões suas. Um tópico por linha.")}
			</p>
			{inbox.data?.learned && <Learned l={inbox.data.learned} onDone={reset} />}
			<textarea
				value={z}
				onChange={(e) => setVoz(e.target.value)}
				className={clsx(field, "min-h-56 font-mono text-[13px]")}
			/>

			<div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-2 border-t border-line bg-bg py-4">
				<button
					type="button"
					disabled={save.isPending}
					onClick={() => save.mutate()}
					className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink hover:brightness-110 disabled:opacity-50"
				>
					<Check className="size-4" />
					{v.state === "suggested" && !dirty ? t("Aceitar") : t("Salvar")}
				</button>
				<button
					type="button"
					disabled={regen.isPending}
					onClick={() => regen.mutate()}
					className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-muted hover:bg-sunken hover:text-ink"
				>
					{regen.isPending ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<Sparkles className="size-3.5" />
					)}
					{t("Ler minhas conversas de novo")}
				</button>
				{save.isSuccess && !dirty && <span className="text-xs text-accent">{t("Salvo.")}</span>}
				{(save.error || regen.error) && (
					<span className="text-xs text-hot">{((save.error || regen.error) as Error).message}</span>
				)}
				<span className="ml-auto text-xs text-faint">
					{t("Ler de novo substitui tudo pelo que a IA sugerir agora.")}
				</span>
			</div>
		</section>
	);
}

function Media({ pk }: { pk: number }) {
	const q = useQuery({
		queryKey: ["media", pk],
		queryFn: () => api.media(pk),
		staleTime: Infinity,
	});
	if (q.isError) return null;
	if (!q.data) return <div className="h-40 w-56 animate-pulse rounded-lg bg-sunken" />;
	return (
		<a href={q.data} target="_blank" rel="noreferrer">
			<img src={q.data} alt="" className="mb-1 max-h-72 max-w-full rounded-lg object-contain" />
		</a>
	);
}

/** URLs in a message become links; the rest stays text (never HTML). */
function linkify(text: string) {
	let at = 0;
	return text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, n) => {
		at += part.length;
		return n % 2 ? (
			<a
				key={at}
				href={part}
				target="_blank"
				rel="noreferrer"
				className="break-all text-accent underline"
			>
				{part}
			</a>
		) : (
			part
		);
	});
}

/** Each tag gets its own hue, spaced by the golden angle in creation order so neighbours never look alike. */
function tagStyle(areas: { id: string }[] | undefined, id: string | null) {
	const n = areas?.findIndex((a) => a.id === id) ?? -1;
	return { "--h": `${(n * 137.5 + 250) % 360}` } as CSSProperties;
}

/** Rules learned from the owner's edits: each one is kept only if they tick it. */
function Learned({ l, onDone }: { l: NonNullable<Inbox["learned"]>; onDone: () => void }) {
	const [keep, setKeep] = useState(() => new Set(l.rules));
	const save = useMutation({ mutationFn: (k: string[]) => api.keepLearned(k), onSuccess: onDone });
	return (
		<div className="mt-3 rounded-xl border border-dashed border-accent/50 bg-accent-soft/40 p-4">
			<div className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
				<Sparkles className="size-3.5" />{" "}
				{tf("Aprendido com {n} respostas que você mudou", { n: l.pairs })}
			</div>
			<div className="mt-2 grid gap-1.5">
				{l.rules.map((r) => (
					<label key={r} className="flex items-start gap-2 text-[13px]">
						<input
							type="checkbox"
							className="mt-0.5 accent-[var(--accent)]"
							checked={keep.has(r)}
							onChange={() =>
								setKeep((s) => {
									const n = new Set(s);
									n.has(r) ? n.delete(r) : n.add(r);
									return n;
								})
							}
						/>
						{r}
					</label>
				))}
			</div>
			<div className="mt-3 flex gap-2">
				<button
					type="button"
					disabled={save.isPending || keep.size === 0}
					onClick={() => save.mutate([...keep])}
					className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-accent-ink hover:brightness-110 disabled:opacity-50"
				>
					<Check className="size-3.5" /> {t("Adicionar ao meu jeito")}
				</button>
				<button
					type="button"
					disabled={save.isPending}
					onClick={() => save.mutate([])}
					className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-muted hover:text-ink"
				>
					<X className="size-3.5" /> {t("Descartar")}
				</button>
			</div>
		</div>
	);
}
