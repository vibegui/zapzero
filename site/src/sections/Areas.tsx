import { Head } from "~/components/ui";

/** @titleBy label */
export interface Area {
	/** @title Nome */
	label: string;
	/** @title Conversas */
	count: number;
}

/** @titleBy label */
export interface Suggestion {
	/** @title Nome da área sugerida */
	label: string;
	/** @title Conversas */
	count: number;
	/** @title Por que a IA sugeriu */
	reason: string;
}

export interface Props {
	/** @title Rótulo */
	kicker?: string;
	/** @title Título */
	title?: string;
	/** @title Segunda linha (mais clara) */
	dim?: string;
	/** @title Texto */
	body?: string;
	/** @title Áreas */
	areas?: Area[];
	/** @title Rótulo das sugestões */
	suggestionsLabel?: string;
	/** @title Sugestões da IA */
	suggestions?: Suggestion[];
	/** @title Nota */
	note?: string;
}

export default function Areas({
	kicker = "Áreas",
	title = "Categorias dizem quando.",
	dim = "Áreas dizem quem.",
	body = "",
	areas = [],
	suggestionsLabel = "Sugestões",
	suggestions = [],
	note = "",
}: Props) {
	return (
		<section className="block wrap" id="areas">
			<Head kicker={kicker} title={title} dim={dim} />
			{body ? <p className="lede areas-lede">{body}</p> : null}
			<div className="areas">
				<ul className="area-list">
					{areas.map((a) => (
						<li key={a.label}>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
								<circle cx="7.5" cy="7.5" r="1.2" />
							</svg>
							<span>{a.label}</span>
							<b>{a.count}</b>
						</li>
					))}
				</ul>
				<div className="area-suggest">
					<p className="area-suggest-label">
						<Spark /> {suggestionsLabel}
					</p>
					{suggestions.map((s) => (
						<article key={s.label} className="suggestion">
							<header>
								<Spark />
								<h3>{s.label}</h3>
								<b>{s.count}</b>
							</header>
							<p>{s.reason}</p>
							<footer>
								<span className="accept">✓ Criar área</span>
								<span className="dismiss">✕ Não</span>
							</footer>
						</article>
					))}
					{note ? <p className="area-note">{note}</p> : null}
				</div>
			</div>
		</section>
	);
}

function Spark() {
	return (
		<svg className="spark" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
		</svg>
	);
}
