import { Head } from "~/components/ui";

/** @titleBy title */
export interface Point {
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
	/** @title Pontos */
	points?: Point[];
}

/** The dark band: what zapzero never does. */
export default function Privacy({
	kicker = "Privacidade",
	title = "Suas conversas ficam no seu Mac.",
	dim = "",
	points = [],
}: Props) {
	return (
		<section className="band" id="privacidade">
			<div className="wrap block">
				<Head kicker={kicker} title={title} dim={dim} />
				<ul className="points">
					{points.map((p) => (
						<li key={p.title}>
							<h3>{p.title}</h3>
							<p>{p.text}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
