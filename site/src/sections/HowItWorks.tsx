import { Head } from "~/components/ui";

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
	/** @title Passos */
	steps?: Step[];
}

export default function HowItWorks({
	kicker = "Como funciona",
	title = "Três passos.",
	dim = "",
	steps = [],
}: Props) {
	return (
		<section className="block wrap" id="como-funciona">
			<Head kicker={kicker} title={title} dim={dim} />
			<ol className="steps">
				{steps.map((s, i) => (
					<li key={s.title}>
						<span className="num">{String(i + 1).padStart(2, "0")}</span>
						<h3>{s.title}</h3>
						<p>{s.text}</p>
					</li>
				))}
			</ol>
		</section>
	);
}
