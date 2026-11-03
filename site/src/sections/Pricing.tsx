import { Head } from "~/components/ui";

/** @titleBy label */
export interface Figure {
	/** @title Valor */
	value: string;
	/** @title Legenda */
	label: string;
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
	/** @title Números */
	figures?: Figure[];
	/** @title Notas (onde roda, código aberto…) */
	notes?: string[];
}

export default function Pricing({
	kicker = "Quanto custa",
	title = "Centavos por mês.",
	dim = "Chave sua.",
	body = "",
	figures = [],
	notes = [],
}: Props) {
	return (
		<section className="block wrap" id="preco">
			<Head kicker={kicker} title={title} dim={dim} />
			{body ? <p className="lede">{body}</p> : null}
			<div className="figures">
				{figures.map((f) => (
					<div key={f.label}>
						<b>{f.value}</b>
						<span>{f.label}</span>
					</div>
				))}
			</div>
			{notes.length ? (
				<ul className="notes">
					{notes.map((n) => (
						<li key={n}>{n}</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
