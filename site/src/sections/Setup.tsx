import { Head } from "~/components/ui";

/** @titleBy name */
export interface Item {
	/** @title Ícone */
	icon: "whatsapp" | "claude" | "openrouter";
	/** @title Nome */
	name: string;
	/** @title Selo (obrigatório, opcional…) */
	badge?: string;
	/** @title Opcional (selo mais claro) */
	optional?: boolean;
	/** @title Texto */
	text: string;
	/** @title Link */
	href?: string;
	/** @title Texto do link */
	linkLabel?: string;
}

export interface Props {
	/** @title Rótulo */
	kicker?: string;
	/** @title Título */
	title?: string;
	/** @title Segunda linha (mais clara) */
	dim?: string;
	/** @title O que instalar */
	items?: Item[];
	/** @title Comando de instalação */
	command?: string;
}

const ICONS: Record<Item["icon"], React.ReactNode> = {
	// a chat bubble with a laptop base: WhatsApp on the Mac
	whatsapp: (
		<>
			<path d="M7 5h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-6l-4 3v-3a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" />
			<path d="M9 10.5h6M9 13h3.5" />
		</>
	),
	// a terminal prompt: Claude Code on your machine
	claude: (
		<>
			<rect x="3" y="5" width="18" height="14" rx="3" />
			<path d="m7.5 10 2.5 2-2.5 2M12.5 14.5h4" />
		</>
	),
	// one key, many models: a router fanning out
	openrouter: (
		<>
			<circle cx="5.5" cy="12" r="2" />
			<path d="M7.5 12h4M11.5 12c2-4 3.5-5 6-5M11.5 12c2 4 3.5 5 6 5M11.5 12h6" />
			<circle cx="19" cy="7" r="1.4" />
			<circle cx="19" cy="12" r="1.4" />
			<circle cx="19" cy="17" r="1.4" />
		</>
	),
};

export default function Setup({
	kicker = "O que você precisa",
	title = "Dois apps que você já tem.",
	dim = "E um opcional.",
	items = [],
	command = "",
}: Props) {
	return (
		<section className="block wrap" id="instalar">
			<Head kicker={kicker} title={title} dim={dim} />
			<ul className="setup">
				{items.map((it) => (
					<li key={it.name} className={it.optional ? "opt" : ""}>
						<span className={`setup-icon ${it.icon}`}>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								{ICONS[it.icon]}
							</svg>
						</span>
						{it.badge ? <span className="setup-badge">{it.badge}</span> : null}
						<h3>{it.name}</h3>
						<p>{it.text}</p>
						{it.href ? (
							<a href={it.href} target="_blank" rel="noreferrer">
								{it.linkLabel || it.href} →
							</a>
						) : null}
					</li>
				))}
			</ul>
			{command ? <pre className="setup-cmd">{command}</pre> : null}
		</section>
	);
}
