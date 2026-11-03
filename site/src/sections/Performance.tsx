import { Head } from "~/components/ui";

/** @titleBy label */
export interface Kpi {
	/** @title Número */
	value: string;
	/** @title Rótulo */
	label: string;
	/** @title Nota */
	note?: string;
}

/** @titleBy label */
export interface Series {
	/** @title Nome da série */
	label: string;
	/** @title % respondido em 24 h, uma por semana (fictício) */
	values: number[];
}

/** @titleBy title */
export interface Step {
	/** @title Título */
	title: string;
	/** @title Texto */
	text: string;
}

export interface Props {
	/** @title Rótulo */
	kicker?: string;
	/** @title Título */
	title?: string;
	/** @title Segunda linha (mais clara) */
	dim?: string;
	/** @title Nome da tela no mock */
	screenTitle?: string;
	/** @title Números do mock (fictícios) */
	kpis?: Kpi[];
	/** @title Título do gráfico */
	chartTitle?: string;
	/** @title Séries do gráfico (até 3, fictícias) */
	series?: Series[];
	/** @title Rótulo da primeira semana */
	from?: string;
	/** @title Rótulo da última semana */
	to?: string;
	/** @title Passos */
	steps?: Step[];
}

const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)"];

export default function Performance({
	kicker = "Desempenho",
	title = "",
	dim = "",
	screenTitle = "Desempenho",
	kpis = [],
	chartTitle = "",
	series = [],
	from = "",
	to = "",
	steps = [],
}: Props) {
	const W = 520;
	const H = 170;
	const L = 34;
	const T = 8;
	const B = 20;
	const ih = H - T - B;
	const n = Math.max(2, ...series.map((s) => s.values.length));
	const x = (i: number) => L + ((W - L - 6) * i) / (n - 1);
	const y = (v: number) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
	return (
		<section className="block wrap" id="desempenho">
			<Head kicker={kicker} title={title} dim={dim} />
			<div className="areas voice">
				<div className="voice-mock perf-mock">
					<h3>{screenTitle}</h3>
					<div className="perf-kpis">
						{kpis.map((k) => (
							<div key={k.label} className="perf-kpi">
								<div className="v">{k.value}</div>
								<div className="l">{k.label}</div>
								{k.note && <div className="n">{k.note}</div>}
							</div>
						))}
					</div>
					<div className="perf-chart">
						<p className="voice-label">{chartTitle}</p>
						<div className="perf-legend">
							{series.slice(0, 3).map((s, i) => (
								<span key={s.label}>
									<i style={{ background: COLORS[i] }} />
									{s.label}
								</span>
							))}
						</div>
						<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chartTitle}>
							{[0, 50, 100].map((v) => (
								<g key={v}>
									<line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="var(--line)" />
									<text x={L - 6} y={y(v) + 3} textAnchor="end">
										{v}%
									</text>
								</g>
							))}
							<text x={L} y={H - 4}>
								{from}
							</text>
							<text x={W - 6} y={H - 4} textAnchor="end">
								{to}
							</text>
							{series.slice(0, 3).map((s, i) => (
								<g key={s.label}>
									<polyline
										fill="none"
										stroke={COLORS[i]}
										strokeWidth={2}
										strokeLinejoin="round"
										points={s.values.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
									/>
									{s.values.map((v, j) => (
										<circle
											// biome-ignore lint/suspicious/noArrayIndexKey: fixed points of a static mock
											key={j}
											cx={x(j)}
											cy={y(v)}
											r={3}
											fill={COLORS[i]}
											stroke="var(--panel)"
											strokeWidth={2}
										/>
									))}
								</g>
							))}
						</svg>
					</div>
				</div>
				<ol className="voice-steps">
					{steps.map((s, i) => (
						<li key={s.title}>
							<span className="num">{String(i + 1).padStart(2, "0")}</span>
							<div>
								<h3>{s.title}</h3>
								<p>{s.text}</p>
							</div>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
