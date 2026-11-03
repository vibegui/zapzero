import { Head } from "~/components/ui";

/** @titleBy q */
export interface Item {
	/** @title Pergunta */
	q: string;
	/**
	 * @title Resposta
	 * @format rich-text
	 */
	a: string;
}

export interface Props {
	/** @title Rótulo */
	kicker?: string;
	/** @title Título */
	title?: string;
	/** @title Perguntas */
	items?: Item[];
}

/** Questions that open in place (native <details>, no script). */
export default function Faq({
	kicker = "Perguntas",
	title = "O que todo mundo pergunta.",
	items = [],
}: Props) {
	return (
		<section className="block wrap" id="perguntas">
			<Head kicker={kicker} title={title} />
			<div className="faq">
				{items.map((it) => (
					<details key={it.q}>
						<summary>{it.q}</summary>
						<div className="prose" dangerouslySetInnerHTML={{ __html: it.a }} />
					</details>
				))}
			</div>
		</section>
	);
}
