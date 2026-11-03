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
	/** @title Mensagem que chegou (fictícia) */
	incoming?: string;
	/** @title Sua resposta (fictícia) */
	reply?: string;
	/** @title Interruptor do evento */
	toggle?: string;
	/** @title Convidado */
	guest?: string;
	/** @title Evento criado */
	event?: string;
	/** @title Detalhe do evento */
	eventNote?: string;
	/** @title Passos */
	steps?: Step[];
	/** @title Nota (o que precisa) */
	note?: string;
}

export default function Calendar({
	kicker = "Agenda",
	title = "Respondeu o horário,",
	dim = "o seu Claude marca.",
	incoming = "",
	reply = "",
	toggle = "",
	guest = "",
	event = "",
	eventNote = "",
	steps = [],
	note = "",
}: Props) {
	return (
		<section className="block wrap" id="agenda">
			<Head kicker={kicker} title={title} dim={dim} />
			<div className="areas voice">
				<div className="voice-mock cal-mock">
					<p className="b">{incoming}</p>
					<p className="b me">{reply}</p>
					<div className="cal-toggle">
						<span className="sw" aria-hidden="true" />
						<span>{toggle}</span>
					</div>
					{guest ? <div className="cal-guest">☑ {guest}</div> : null}
					<div className="cal-event">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<rect x="3.5" y="5" width="17" height="15" rx="3" />
							<path d="M3.5 10h17M8 3v4M16 3v4" />
						</svg>
						<div>
							<b>{event}</b>
							<span>{eventNote}</span>
						</div>
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
			{note ? <p className="area-note cal-note">{note}</p> : null}
		</section>
	);
}
