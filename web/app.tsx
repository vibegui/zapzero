import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import {
	Archive,
	CalendarDays,
	ChartLine,
	Check,
	CheckCheck,
	Clock3,
	EyeOff,
	Flame,
	Hourglass,
	Loader2,
	MessageCircleReply,
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
import { emailsIn, fill, hasTime, slots } from "./slots.ts";

const ICONS: Record<CategoryId, typeof Flame> = {
	urgente: Flame,
	semana: CalendarDays,
	antigas: Clock3,
	acompanhar: Hourglass,
	grupos: Users,
	limpeza: Archive,
};

const useInbox = () =>
	useQuery({ queryKey: ["inbox"], queryFn: api.inbox, refetchInterval: 30_000, enabled: !!TOKEN });

// ---- shell ---------------------------------------------------------------------------------

export function Shell() {
	const inbox = useInbox();
	if (!TOKEN)
		return (
			<Blank title="Falta o token">
				Abra o painel com <code>?t=…</code> (o token está em <code>$ZAP_DATA/token</code>).
			</Blank>
		);
	if (inbox.error)
		return (
			<Blank title="Sem acesso ao Mac">
				{(inbox.error as Error).message === "token"
					? "Token inválido."
					: "O Mac está desligado ou fora do tailnet."}
			</Blank>
		);
	return (
		<div className="flex h-full min-h-0">
			<Sidebar inbox={inbox.data} />
			<main className="flex min-w-0 flex-1 flex-col">
				{inbox.data?.voice.state === "suggested" && <VoiceBanner />}
				<div className="flex min-h-0 min-w-0 flex-1">
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
							<span className="flex-1 truncate">{c.label}</span>
							<span className="text-xs tabular-nums text-faint">{c.items.length || ""}</span>
						</Link>
					);
				})}
				<Areas inbox={inbox} />
				<Link
					to="/desempenho"
					className="mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<ChartLine className="size-4" />
					<span>Desempenho</span>
				</Link>
				<Link
					to="/feitas"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<CheckCheck className="size-4" />
					<span>Feitas</span>
				</Link>
				<Link
					to="/voz"
					className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<UserRound className="size-4" />
					<span className="flex-1">Seu jeito</span>
					{inbox?.voice.state === "suggested" && <span className="size-2 rounded-full bg-accent" />}
				</Link>
			</div>
			<div className="space-y-2 border-t border-line px-5 py-4 text-xs text-faint">
				<div className="flex items-center justify-between">
					<span>
						{inbox?.refreshing
							? "atualizando…"
							: inbox?.snapshotAt
								? `lido há ${ago(inbox.snapshotAt)}`
								: "sem leitura"}
					</span>
					<button
						type="button"
						title="Ler o WhatsApp de novo"
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
				<div>IA nas últimas 24 h: ${cost.toFixed(3)}</div>
			</div>
		</nav>
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
				placeholder="Buscar nome  /"
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
							<span className="shrink-0 text-[11px] text-faint">{i.catLabel}</span>
						</button>
					))}
					{hits.length === 0 && (
						<div className="px-3 py-1.5 text-[12px] text-faint">Nada na caixa com esse nome.</div>
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
				Áreas
			</div>
			{areas.map((a) => (
				<Link
					key={a.id}
					to="/a/$area"
					params={{ area: a.id }}
					className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-panel hover:text-ink"
					activeProps={{ className: "!bg-panel !text-ink shadow-sm" }}
				>
					<Tag className="size-3.5" />
					<span className="flex-1 truncate">{a.label}</span>
					<span className="text-xs tabular-nums text-faint">{counts.get(a.id)}</span>
				</Link>
			))}
			<div className="mt-3 mb-1 flex items-center justify-between px-3 text-[11px] font-medium tracking-wide text-faint uppercase">
				<span>Sugestões</span>
				<button
					type="button"
					title="Sugerir áreas novas agora"
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
							<Check className="size-3" /> Criar área
						</button>
						<button
							type="button"
							onClick={() => act.mutate({ action: "dismiss", id: sg.id })}
							className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-faint hover:text-ink"
						>
							<X className="size-3" /> Não
						</button>
					</div>
				</div>
			))}
			{inbox.suggestions.length === 0 && (
				<div className="px-3 text-[11px] text-faint">Nenhuma agora. ✨ para pedir.</div>
			)}
		</>
	);
}

// ---- category: ranked list + focus -----------------------------------------------------------

type Toast = { text: string; pk: number; lastPk: number } | null;

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
	const areaLabel = (id: string | null) => inbox.data?.areas.find((a) => a.id === id)?.label;
	const idx = Math.max(0, pk ? items.findIndex((i) => i.pk === pk) : 0);
	const item = items[idx];
	const [toast, setToast] = useState<Toast>(null);

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
		},
		onSuccess: (r, b) => {
			const name = items.find((i) => i.pk === b.pk)?.name ?? "";
			const text =
				b.kind === "reply"
					? r.via === "whatsapp"
						? `Aberto no WhatsApp: aperte Enter lá para enviar a ${name}`
						: `Texto copiado: cole na conversa com ${name}`
					: b.kind === "archive"
						? `${name}: marcada para arquivar`
						: b.kind === "ignore"
							? `${name}: ignorada para sempre`
							: b.kind === "done"
								? `${name}: resolvida`
								: `${name}: pulada até chegar mensagem nova`;
			setToast({
				text: r.event ? `${text} · criando o evento no seu calendário` : text,
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
			if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return;
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
				a: () => act("archive"),
				s: () => act("skip"),
				i: () => act("ignore"),
				z: () => toast && undo.mutate({ pk: toast.pk, lastPk: toast.lastPk }),
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

	if (!inbox.data) return <Blank title="Lendo…">Carregando o inbox do Mac.</Blank>;
	return (
		<>
			<section className="hidden w-[360px] shrink-0 flex-col border-r border-line bg-panel lg:flex">
				<header className="flex items-baseline justify-between px-5 pt-5 pb-3">
					<h1 className="text-[15px] font-semibold tracking-tight">{label}</h1>
					<span className="text-xs tabular-nums text-faint">{items.length}</span>
				</header>
				<ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
					{items.map((i) => (
						<li key={i.pk}>
							<button
								type="button"
								onClick={() => select(i.pk)}
								className={clsx(
									"w-full rounded-xl px-3 py-2.5 text-left transition-colors",
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
								<div className="mt-0.5 truncate text-[13px] text-muted">{i.preview}</div>
								<div className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
									{areaLabel(i.area) && (
										<span className="rounded bg-sunken px-1.5 py-px text-muted">
											{areaLabel(i.area)}
										</span>
									)}
									<span className="truncate">{i.reason}</span>
									{i.draft && (
										<span className="inline-flex items-center gap-0.5 text-accent">
											<Sparkles className="size-3" /> rascunho
										</span>
									)}
								</div>
							</button>
						</li>
					))}
					{items.length === 0 && (
						<li className="px-3 py-10 text-center text-sm text-faint">Zerado. 🎉</li>
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
						position={`${idx + 1} de ${items.length}`}
						act={act}
						handle={focusRef}
					/>
				) : (
					<Blank title="Nada aqui">Escolha outra categoria.</Blank>
				)}
				{toast && (
					<div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
						<div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-bg shadow-lg">
							<span>{toast.text}</span>
							<button
								type="button"
								onClick={() => undo.mutate({ pk: toast.pk, lastPk: toast.lastPk })}
								className="inline-flex items-center gap-1 font-medium opacity-80 hover:opacity-100"
							>
								<Undo2 className="size-3.5" /> desfazer <kbd>Z</kbd>
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
	const emails = useMemo(
		() =>
			emailsIn(
				(chat.data ?? [])
					.filter((m) => !m.mine)
					.slice(-15)
					.map((m) => m.text),
			),
		[chat.data],
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the bottom when messages arrive
	useEffect(() => {
		scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
	}, [chat.data]);

	const reply = () => {
		const el = box.current;
		if (!text.trim()) {
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
			setText(fill(text, s, s.options[i]));
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
			const d = new Date(m.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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
						{item.reason}
						{item.waitingSince ? ` · esperando há ${ago(item.waitingSince)}` : ""}
						{item.phone && !item.name.includes(item.phone) ? ` · +${item.phone}` : ""}
					</div>
				</div>
				<span className="text-xs tabular-nums text-faint">{position}</span>
			</header>

			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-sunken px-6 py-4">
				{chat.isLoading && <Loader2 className="mx-auto size-4 animate-spin text-faint" />}
				{chat.data?.length === 0 && (
					<div className="py-10 text-center text-sm text-faint">
						O Mac não tem o texto desta conversa (só sincroniza ~3 meses).
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
								<div className="whitespace-pre-wrap break-words">{m.text}</div>
								<div className="mt-0.5 text-right text-[10px] text-faint">
									{new Date(m.at).toLocaleTimeString("pt-BR", {
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
									<CalendarDays className="size-3.5" /> {ev.data.guests.join(", ")} no convite de{" "}
									{ev.data.when}
								</div>
							)}
						{open.length > 0 && (
							<SlotBar slots={open} onFill={(s, v) => setText(fill(text, s, v))} />
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
											? "Sem rascunho: escreva, ou R para gerar"
											: "Escreva a resposta"
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
							Ao responder ou resolver, garantir a call no calendário com{" "}
							<span className="text-ink">{item.invite.email}</span> <kbd>C</kbd>
							<span className="block line-clamp-1 text-[12px] text-faint">
								você combinou: «{item.invite.agreed}» · seu Claude acha o evento ou cria, e convida
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
						Ao responder, criar o evento no meu calendário <kbd>C</kbd>
						<span className="text-faint">
							· seu Claude cria
							{emails.length && inviteOn ? "" : ", só na sua agenda, sem convidados"}
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
									setText(`${text.trimEnd()} Me passa seu e-mail que te mando o convite?`)
								}
								className="rounded-lg border border-line px-2 py-0.5 text-[12px] text-muted hover:border-accent hover:text-ink"
							>
								+ pedir o e-mail dele pro convite
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
						convidar <span className="text-ink">{emails.join(", ")}</span>
						<span className="text-faint">· recebe o convite do Google por e-mail</span>
					</label>
				)}
				<div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-2">
					{!cleanup && (
						<Btn primary onClick={reply} k="Y">
							<MessageCircleReply className="size-4" /> Responder no WhatsApp
						</Btn>
					)}
					{cleanup && (
						<Btn primary onClick={() => act("archive")} k="A">
							<Archive className="size-4" /> Arquivar
						</Btn>
					)}
					{!cleanup && !item.group && (
						<Btn onClick={() => redraft.mutate()} k="R">
							<Sparkles className="size-3.5" /> Novo rascunho
						</Btn>
					)}
					<div className="flex-1" />
					<Btn onClick={done} k="D">
						<CheckCheck className="size-3.5" /> Resolvida
					</Btn>
					{!cleanup && (
						<Btn onClick={() => act("archive")} k="A">
							<Archive className="size-3.5" /> Arquivar
						</Btn>
					)}
					<Btn onClick={() => act("skip")} k="S">
						<SkipForward className="size-3.5" /> Pular
					</Btn>
					<Btn onClick={() => act("ignore")} k="I">
						<EyeOff className="size-3.5" /> Ignorar sempre
					</Btn>
				</div>
				<div className="mx-auto mt-2 max-w-3xl text-[11px] text-faint">
					{cleanup
						? "Arquivar fica registrado; o executor que arquiva no app ainda não existe."
						: "Responder abre a conversa no WhatsApp com o texto escrito. Só sai quando você aperta Enter lá."}{" "}
					<kbd>E</kbd> edita · <kbd>1</kbd>–<kbd>9</kbd> escolhe o que falta · <kbd>J</kbd>/
					<kbd>K</kbd> navega · <kbd>⌘↵</kbd> responde editando
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
				Falta você decidir {list.length > 1 ? `${list.length} coisas` : "uma coisa"}
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
						placeholder={s.options.length ? "outro…" : "escreva e Enter"}
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
			<h1 className="mb-4 text-[15px] font-semibold tracking-tight">Feitas</h1>
			<ul className="divide-y divide-line rounded-xl border border-line bg-panel">
				{list.data?.map((d) => (
					<li key={`${d.pk}:${d.last_pk}`} className="flex items-start gap-3 px-4 py-3">
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline gap-2">
								<span className="truncate text-sm font-medium">{d.name}</span>
								<span className="text-[11px] text-faint">
									{KIND_LABEL[d.kind]} · {ago(d.at)}
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
										? "criando o evento…"
										: d.event.status === "ok"
											? `no calendário: ${d.event.result?.replace(/^CRIADO:\s*/, "")}`
											: d.event.status === "skipped"
												? `evento não criado: ${d.event.result?.replace(/^NAO_CRIADO:\s*/, "")}`
												: `erro no evento: ${d.event.result}`}
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={() => undo.mutate({ pk: d.pk, lastPk: d.last_pk })}
							className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink"
						>
							<Undo2 className="size-3.5" /> desfazer
						</button>
					</li>
				))}
				{list.data?.length === 0 && (
					<li className="px-4 py-10 text-center text-sm text-faint">Nada ainda.</li>
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
				Li suas mensagens e escrevi como você escreve. Confere antes dos rascunhos seguirem isso?
			</span>
			<span className="font-medium text-accent">Conferir →</span>
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
	if (!v) return <Blank title="Lendo…">Carregando.</Blank>;
	const field =
		"mt-1.5 w-full resize-y rounded-xl border border-line bg-panel px-4 py-2.5 text-[14px] leading-relaxed outline-none [field-sizing:content] focus:border-accent";
	return (
		<section className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-8">
			<h1 className="text-[22px] font-semibold tracking-tight">Seu jeito</h1>
			<p className="mt-1 text-sm text-muted">
				{v.state === "suggested"
					? "A IA leu suas mensagens, suas conversas mais ativas e seus grupos, e escreveu isto. A triagem e os rascunhos seguem esse texto: aceite ou ajuste cada parte."
					: v.state === "accepted"
						? "A triagem e os rascunhos seguem este texto. Mude quando quiser."
						: "Depois do primeiro scan a IA preenche isto a partir das suas conversas."}
			</p>

			<h2 className="mt-8 text-[15px] font-semibold">Quem é você</h2>
			<div className="mt-2 grid gap-5">
				{PROFILE_TOPICS.map((t) => (
					<div key={t.id}>
						<label className="block text-[13px] font-medium" htmlFor={`p-${t.id}`}>
							{t.label}
						</label>
						<p className="text-xs text-faint">{t.hint}</p>
						<textarea
							id={`p-${t.id}`}
							value={perfil[t.id] ?? ""}
							onChange={(e) => setEdits((x) => ({ ...x, [t.id]: e.target.value }))}
							placeholder="—"
							className={clsx(field, "min-h-11")}
						/>
					</div>
				))}
			</div>

			<h2 className="mt-10 text-[15px] font-semibold">Como você escreve</h2>
			<p className="text-xs text-faint">
				Tamanho, tom, pontuação, emoji, expressões suas. Um tópico por linha.
			</p>
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
					{v.state === "suggested" && !dirty ? "Aceitar" : "Salvar"}
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
					Ler minhas conversas de novo
				</button>
				{save.isSuccess && !dirty && <span className="text-xs text-accent">Salvo.</span>}
				{(save.error || regen.error) && (
					<span className="text-xs text-hot">{((save.error || regen.error) as Error).message}</span>
				)}
				<span className="ml-auto text-xs text-faint">
					Ler de novo substitui tudo pelo que a IA sugerir agora.
				</span>
			</div>
		</section>
	);
}
