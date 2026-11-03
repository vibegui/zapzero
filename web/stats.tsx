// Desempenho: how fast and how often the owner answers, week by week. Same numbers as `bun server/main.ts stats`.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Week, Who } from "../server/stats.ts";
import { api, type Stats } from "./api.ts";

const SERIES: { who: Who; label: string; color: string }[] = [
	{ who: "conhecido", label: "Contatos salvos", color: "var(--s1)" },
	{ who: "desconhecido", label: "Desconhecidos", color: "var(--s2)" },
	{ who: "grupo", label: "Grupos", color: "var(--s3)" },
];
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dm = (w: string) => `${w.slice(8, 10)}/${w.slice(5, 7)}`;
const hours = (h: number | null) =>
	h == null
		? "—"
		: h === 0
			? "0"
			: h < 1
				? `${Math.max(1, Math.round(h * 60))} min`
				: h < 48
					? `${h.toFixed(1).replace(".", ",")} h`
					: `${Math.round(h / 24)} d`;
const pct = (num: number, den: number) => (den ? (100 * num) / den : null);

export function StatsScreen() {
	const q = useQuery({ queryKey: ["stats"], queryFn: api.stats, staleTime: 60_000 });
	if (!q.data)
		return <div className="p-6 text-sm text-faint">{q.error ? String(q.error) : "lendo…"}</div>;
	return <Body s={q.data} />;
}

function Body({ s }: { s: Stats }) {
	// 13 whole weeks: the oldest one in the 91-day window starts mid-week
	const weeks = [...new Set(Object.values(s.weeks).flatMap((l) => l.map((w) => w.week)))]
		.sort()
		.slice(-13);
	const at = (who: Who, week: string): Week | undefined =>
		s.weeks[who].find((w) => w.week === week);
	const current = weeks.at(-1)!;
	const closed = weeks.slice(-5, -1); // last 4 complete weeks
	const before = weeks.slice(-9, -5);
	const sum = (who: Who, ws: string[], f: (w: Week) => number) =>
		ws.reduce((t, w) => t + (at(who, w) ? f(at(who, w)!) : 0), 0);
	const rate = (who: Who, ws: string[]) =>
		pct(
			sum(who, ws, (w) => w.resp24h),
			sum(who, ws, (w) => w.cobrancas),
		);
	const r24 = rate("conhecido", closed);
	const r24b = rate("conhecido", before);
	const meds = closed
		.map((w) => at("conhecido", w)?.medianaH)
		.filter((x): x is number => x != null);
	const medNow = at("conhecido", current)?.medianaH ?? null;
	const leak =
		sum("conhecido", closed, (w) => w.semResposta) +
		sum("desconhecido", closed, (w) => w.semResposta);
	const used = Object.values(s.usage[current] ?? {}).reduce((t, n) => t + (n ?? 0), 0);

	const usageWeeks = weeks;
	return (
		<section className="mx-auto w-full max-w-5xl overflow-y-auto px-6 py-6">
			<h1 className="text-[22px] font-semibold tracking-tight">Desempenho</h1>
			<p className="mt-1 mb-5 text-sm text-muted">
				Últimas 13 semanas, pela semana em que alguém puxou conversa com você. Conta como "puxou" a
				mensagem que chega depois da sua e depois de 1 h de silêncio, pra que um papo ao vivo não
				vire dezenas de cobranças.
			</p>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Tile
					v={r24 == null ? "—" : `${Math.round(r24)}%`}
					l="contatos respondidos em 24 h"
					n={
						r24 != null && r24b != null
							? `${r24 >= r24b ? "+" : ""}${Math.round(r24 - r24b)} pts vs. 4 semanas antes`
							: "4 semanas fechadas"
					}
				/>
				<Tile
					v={hours(meds.length ? meds.sort((a, b) => a - b)[meds.length >> 1]! : null)}
					l="tempo típico de resposta"
					n={`mediana, contatos · esta semana ${hours(medNow)}`}
				/>
				<Tile v={fmt(leak)} l="ficaram sem resposta" n="contatos e desconhecidos, 4 semanas" />
				<Tile
					v={fmt(s.unread.conhecido + s.unread.desconhecido)}
					l="não lidas em conversas"
					n={`${fmt(s.unread.grupo)} em grupos · ${used} resolvidas no zapzero esta semana`}
				/>
			</div>

			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<Card title="Respondido em 24 h" sub="% das vezes em que alguém puxou conversa">
					<Chart
						weeks={weeks}
						kind="line"
						max={100}
						yfmt={(v) => `${Math.round(v)}%`}
						series={SERIES.map((x) => ({
							...x,
							values: weeks.map((w) => {
								const k = at(x.who, w);
								return k ? pct(k.resp24h, k.cobrancas) : null;
							}),
						}))}
					/>
				</Card>
				<Card title="Ficaram sem resposta" sub="Alguém puxou conversa e você nunca escreveu depois">
					<Chart
						weeks={weeks}
						kind="bars"
						series={SERIES.slice(0, 2).map((x) => ({
							...x,
							values: weeks.map((w) => at(x.who, w)?.semResposta ?? 0),
						}))}
					/>
				</Card>
				<Card title="Tempo típico de resposta" sub="Mediana em horas, quando você respondeu">
					<Chart
						weeks={weeks}
						kind="line"
						yfmt={(v) => hours(v)}
						series={SERIES.map((x) => ({
							...x,
							values: weeks.map((w) => at(x.who, w)?.medianaH ?? null),
						}))}
					/>
				</Card>
				<Card title="Volume" sub="Vezes em que alguém puxou conversa, por semana">
					<Chart
						weeks={weeks}
						kind="bars"
						series={SERIES.map((x) => ({
							...x,
							values: weeks.map((w) => at(x.who, w)?.cobrancas ?? 0),
						}))}
					/>
				</Card>
			</div>

			<Card
				title="Semana a semana"
				sub="Contatos salvos · a semana atual ainda está aberta"
				className="mt-4"
			>
				<div className="overflow-x-auto">
					<table className="w-full text-[12px] tabular-nums">
						<thead className="text-faint">
							<tr className="border-b border-line">
								{[
									"semana",
									"puxaram",
									"em 24 h",
									"em 7 dias",
									"sem resposta",
									"típico",
									"recebidas",
									"enviadas",
									"zapzero",
								].map((h, i) => (
									<th
										key={h}
										className={
											i ? "px-2 py-1.5 text-right font-medium" : "py-1.5 text-left font-medium"
										}
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...usageWeeks].reverse().map((w) => {
								const k = at("conhecido", w);
								const z = Object.values(s.usage[w] ?? {}).reduce((t, n) => t + (n ?? 0), 0);
								const p = (n?: number) =>
									k?.cobrancas && n != null ? `${Math.round((100 * n) / k.cobrancas)}%` : "—";
								return (
									<tr key={w} className="border-b border-line/60 text-muted">
										<td className="py-1.5 text-ink">
											{dm(w)}
											{w === current && <span className="ml-1 text-faint">(aberta)</span>}
										</td>
										<td className="px-2 text-right">{fmt(k?.cobrancas ?? 0)}</td>
										<td className="px-2 text-right">{p(k?.resp24h)}</td>
										<td className="px-2 text-right">{p(k?.resp7d)}</td>
										<td className="px-2 text-right">{fmt(k?.semResposta ?? 0)}</td>
										<td className="px-2 text-right">{hours(k?.medianaH ?? null)}</td>
										<td className="px-2 text-right">{fmt(k?.recebidas ?? 0)}</td>
										<td className="px-2 text-right">{fmt(k?.enviadas ?? 0)}</td>
										<td className="px-2 text-right">{z || "·"}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Card>
		</section>
	);
}

function Tile({ v, l, n }: { v: string; l: string; n: string }) {
	return (
		<div className="rounded-xl border border-line bg-panel p-4">
			<div className="text-[28px] font-semibold tracking-tight tabular-nums">{v}</div>
			<div className="text-[13px] text-ink">{l}</div>
			<div className="mt-1 text-[11px] text-faint">{n}</div>
		</div>
	);
}

function Card({
	title,
	sub,
	children,
	className = "",
}: {
	title: string;
	sub: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`min-w-0 rounded-xl border border-line bg-panel p-4 ${className}`}>
			<h2 className="text-[13px] font-semibold">{title}</h2>
			<p className="mb-2 text-[12px] text-faint">{sub}</p>
			{children}
		</div>
	);
}

type Series = { label: string; color: string; values: (number | null)[] };

function Chart({
	weeks,
	series,
	kind,
	max,
	yfmt = fmt,
}: {
	weeks: string[];
	series: Series[];
	kind: "line" | "bars";
	max?: number;
	yfmt?: (v: number) => string;
}) {
	const [hover, setHover] = useState<number | null>(null);
	const W = 560;
	const H = 200;
	const L = 44;
	const R = 8;
	const T = 10;
	const B = 22;
	const iw = W - L - R;
	const ih = H - T - B;
	const bw = iw / weeks.length;
	const top = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
	const nice =
		max ??
		(() => {
			const p = 10 ** Math.floor(Math.log10(top));
			return Math.ceil(top / p) * p;
		})();
	const y = (v: number) => T + ih - (v / nice) * ih;
	const cx = (i: number) => L + bw * i + bw / 2;
	return (
		<div className="relative">
			{series.length > 1 && (
				<div className="mb-1 flex flex-wrap gap-3 text-[12px] text-muted">
					{series.map((s) => (
						<span key={s.label} className="inline-flex items-center gap-1.5">
							<i className="inline-block size-2.5 rounded-[3px]" style={{ background: s.color }} />
							{s.label}
						</span>
					))}
				</div>
			)}
			<svg
				viewBox={`0 0 ${W} ${H}`}
				className="block h-auto w-full"
				role="img"
				aria-label={series.map((x) => x.label).join(", ")}
				onMouseLeave={() => setHover(null)}
			>
				{[0, 1, 2, 3, 4].map((i) => {
					const v = (nice * i) / 4;
					return (
						<g key={i}>
							<line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" />
							<text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--faint)">
								{yfmt(v)}
							</text>
						</g>
					);
				})}
				{weeks.map((w, i) =>
					i % 2 === weeks.length % 2 ? null : (
						<text key={w} x={cx(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--faint)">
							{dm(w)}
						</text>
					),
				)}
				{hover != null && (
					<rect x={L + bw * hover} y={T} width={bw} height={ih} fill="var(--ink)" opacity={0.05} />
				)}
				{kind === "line"
					? series.map((s) => {
							const pts = s.values.flatMap((v, i) => (v == null ? [] : [[cx(i), y(v)] as const]));
							return (
								<g key={s.label}>
									<polyline
										fill="none"
										stroke={s.color}
										strokeWidth={2}
										strokeLinejoin="round"
										points={pts.map((p) => p.join(",")).join(" ")}
									/>
									{pts.map(([px, py]) => (
										<circle
											key={px}
											cx={px}
											cy={py}
											r={hover != null && px === cx(hover) ? 4.5 : 3}
											fill={s.color}
											stroke="var(--panel)"
											strokeWidth={2}
										/>
									))}
								</g>
							);
						})
					: weeks.map((w, i) => {
							const gw = Math.min(bw - 6, 36);
							const sw = (gw - 2 * (series.length - 1)) / series.length;
							const x0 = L + bw * i + (bw - gw) / 2;
							return series.map((s, j) => {
								const v = s.values[i] ?? 0;
								const h = T + ih - y(v);
								if (!v) return null;
								const x = x0 + j * (sw + 2);
								const r = Math.min(4, sw / 2, h);
								// rounded top, square at the baseline
								return (
									<path
										key={`${w}${s.label}`}
										d={`M${x},${T + ih} V${y(v) + r} q0,${-r} ${r},${-r} H${x + sw - r} q${r},0 ${r},${r} V${T + ih} Z`}
										fill={s.color}
									/>
								);
							});
						})}
				{weeks.map((w, i) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: hover target for the tooltip; the table below carries the same numbers
					<rect
						key={w}
						x={L + bw * i}
						y={T}
						width={bw}
						height={ih}
						fill="transparent"
						onMouseEnter={() => setHover(i)}
					/>
				))}
			</svg>
			{hover != null && (
				<div
					className="pointer-events-none absolute top-6 z-10 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[12px] shadow-lg"
					style={
						hover > weeks.length / 2
							? { right: `${100 - (100 * (L + bw * hover)) / W}%` }
							: { left: `${(100 * (L + bw * (hover + 1))) / W}%` }
					}
				>
					<div className="font-medium">semana de {dm(weeks[hover]!)}</div>
					{series.map((s) => (
						<div key={s.label} className="flex items-center gap-1.5 text-muted">
							<i className="inline-block size-2 rounded-[2px]" style={{ background: s.color }} />
							{s.label}:{" "}
							<span className="text-ink tabular-nums">
								{s.values[hover] == null ? "—" : yfmt(s.values[hover]!)}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
