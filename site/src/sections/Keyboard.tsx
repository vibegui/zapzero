import { Head, Key } from "~/components/ui";

/** @titleBy action */
export interface Shortcut {
	/** @title Tecla */
	key: string;
	/** @title Ação */
	action: string;
	/** @title Detalhe */
	detail?: string;
}

export interface Props {
	/** @title Rótulo */
	kicker?: string;
	/** @title Título */
	title?: string;
	/** @title Segunda linha (mais clara) */
	dim?: string;
	/**
	 * @title Sequência em destaque
	 * @description Teclas separadas por espaço, ex.: Y Y Y E Y
	 */
	sequence?: string;
	/** @title Legenda da sequência */
	sequenceNote?: string;
	/** @title Atalhos */
	shortcuts?: Shortcut[];
}

export default function Keyboard({
	kicker = "No teclado",
	title = "Y, Y, Y.",
	dim = "",
	sequence = "Y Y Y E Y",
	sequenceNote = "",
	shortcuts = [],
}: Props) {
	return (
		<section className="block wrap" id="teclado">
			<Head kicker={kicker} title={title} dim={dim} />
			<div className="seq" aria-label={sequence}>
				{sequence
					.split(/\s+/)
					.filter(Boolean)
					.map((k, i) => (
						<Key key={i} big>
							{k}
						</Key>
					))}
			</div>
			{sequenceNote ? <p className="seq-note">{sequenceNote}</p> : null}
			<dl className="shortcuts">
				{shortcuts.map((s) => (
					<div key={s.key + s.action}>
						<dt>
							<Key>{s.key}</Key>
						</dt>
						<dd>
							<b>{s.action}</b>
							{s.detail ? <span> {s.detail}</span> : null}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
