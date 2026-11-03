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
	/** @title Nome da tela no mock */
	screenTitle?: string;
	/** @title Nota da tela no mock */
	screenNote?: string;
	/** @title Rótulo "quem é você" */
	profileLabel?: string;
	/** @title Perfil de exemplo (fictício) */
	profile?: string;
	/** @title Rótulo "como você escreve" */
	voiceLabel?: string;
	/** @title Guia de tom de exemplo, um tópico por item (fictício) */
	voice?: string[];
	/** @title Botão aceitar */
	accept?: string;
	/** @title Botão ler de novo */
	reread?: string;
	/** @title Passos */
	steps?: Step[];
}

export default function Voice({
	kicker = "Seu jeito",
	title = "",
	dim = "",
	screenTitle = "Seu jeito",
	screenNote = "",
	profileLabel = "",
	profile = "",
	voiceLabel = "",
	voice = [],
	accept = "",
	reread = "",
	steps = [],
}: Props) {
	return (
		<section className="block wrap" id="seu-jeito">
			<Head kicker={kicker} title={title} dim={dim} />
			<div className="areas voice">
				<div className="voice-mock">
					<h3>{screenTitle}</h3>
					<p className="voice-note">{screenNote}</p>
					<p className="voice-label">{profileLabel}</p>
					<div className="voice-box">{profile}</div>
					<p className="voice-label">{voiceLabel}</p>
					<ul className="voice-box voice-guide">
						{voice.map((v) => (
							<li key={v}>{v}</li>
						))}
					</ul>
					<div className="voice-actions">
						<span className="accept">✓ {accept}</span>
						<span className="reread">✦ {reread}</span>
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
