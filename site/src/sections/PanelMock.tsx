import { Draft, Key } from "~/components/ui";

/** @titleBy label */
export interface Category {
	/** @title Nome */
	label: string;
	/** @title Quantidade */
	count: number;
	/** @title Tipo */
	kind?: "urgent" | "normal" | "area" | "suggested";
}

/** @titleBy name */
export interface Row {
	/** @title Nome (fictício) */
	name: string;
	/** @title Última mensagem */
	preview: string;
	/** @title Hora */
	time?: string;
	/** @title Não lidas */
	unread?: number;
	/** @title Contexto (quem é, há quanto tempo espera) */
	context?: string;
}

/** @titleBy text */
export interface Message {
	/** @title Texto */
	text: string;
	/** @title Hora */
	time?: string;
	/** @title Enviada por mim */
	me?: boolean;
}

export interface Labels {
	/** @title "rascunho pronto" */
	draftReady?: string;
	/** @title Título do rascunho */
	draftTitle?: string;
	/** @title Botão responder */
	reply?: string;
	/** @title Botão editar */
	edit?: string;
	/** @title Botão arquivar */
	archive?: string;
	/** @title Botão ignorar */
	ignore?: string;
}

const PT: Required<Labels> = {
	draftReady: "rascunho pronto",
	draftTitle: "Rascunho no seu jeito de escrever",
	reply: "Responder no WhatsApp",
	edit: "Editar",
	archive: "Arquivar",
	ignore: "Ignorar sempre",
};

export interface Props {
	/** @title Legenda acima do painel */
	caption?: string;
	/** @title Categorias */
	categories?: Category[];
	/** @title Conversas na lista */
	rows?: Row[];
	/** @title Mensagens da conversa aberta */
	messages?: Message[];
	/**
	 * @title Rascunho da IA
	 * @description Use [colchetes] para o que a pessoa deve preencher
	 */
	draft?: string;
	/** @title Nota de custo (rodapé da barra lateral) */
	costNote?: string;
	/** @title Rótulos da interface */
	labels?: Labels;
}

/** A static picture of the panel, in HTML. Every name and message here is made up. */
export default function PanelMock({
	caption = "",
	categories = [],
	rows = [],
	messages = [],
	draft = "",
	costNote = "",
	labels = {},
}: Props) {
	const l = { ...PT, ...labels };
	const open = rows[0];
	const active = categories[0];
	return (
		<section className="mock-wrap" aria-label="Exemplo do painel do zapzero">
			<div className="wrap">
				<div
					className="mock"
					role="img"
					aria-label={caption || "Painel do zapzero com conversas fictícias"}
				>
					<div className="mock-bar">
						<i />
						<i />
						<i />
						<span>zapzero</span>
					</div>
					<div className="mock-body">
						<aside className="m-side">
							{categories.map((c, i) => (
								<div key={c.label} className={`m-cat ${c.kind ?? "normal"}${i === 0 ? " on" : ""}`}>
									<span className="dot" />
									<span className="lbl">{c.label}</span>
									<span className="n">{c.count}</span>
								</div>
							))}
							{costNote ? <div className="m-cost">{costNote}</div> : null}
						</aside>
						<div className="m-list">
							<div className="m-h">
								<b>{active?.label}</b>
								<span>{rows.length}</span>
							</div>
							{rows.map((r, i) => (
								<div key={r.name} className={`m-row${i === 0 ? " on" : ""}`}>
									<div className="r1">
										<b>{r.name}</b>
										{r.unread ? <span className="badge">{r.unread}</span> : null}
										<span className="t">{r.time}</span>
									</div>
									<div className="r2">{r.preview}</div>
									<div className="r3">{l.draftReady}</div>
								</div>
							))}
						</div>
						<div className="m-chat">
							<div className="m-chips" aria-hidden="true">
								{categories.slice(0, 4).map((c, i) => (
									<span
										key={c.label}
										className={`chip${i === 0 ? " on" : ""}${c.kind === "urgent" ? " urgent" : ""}`}
									>
										{c.label} <b>{c.count}</b>
									</span>
								))}
							</div>
							<div className="m-who">
								<b>{open?.name}</b>
								<span>{open?.context}</span>
							</div>
							<div className="m-msgs">
								{messages.map((m) => (
									<p key={m.text} className={m.me ? "b me" : "b"}>
										{m.text}
										{m.time ? <time>{m.time}</time> : null}
									</p>
								))}
							</div>
							<div className="m-draft">
								<div className="m-draft-l">{l.draftTitle}</div>
								<p>
									<Draft text={draft} />
								</p>
								<div className="m-keys">
									<span className="go">
										{l.reply} <Key>Y</Key>
									</span>
									<span>
										{l.edit} <Key>E</Key>
									</span>
									<span>
										{l.archive} <Key>A</Key>
									</span>
									<span className="hide-sm">
										{l.ignore} <Key>I</Key>
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
				{caption ? <p className="mock-cap">{caption}</p> : null}
			</div>
		</section>
	);
}
