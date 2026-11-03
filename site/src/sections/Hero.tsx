import { Logo } from "~/components/ui";

export interface Props {
	/** @title Domínio (aparece no topo) */
	domain?: string;
	/** @title Rótulo acima do título */
	eyebrow?: string;
	/** @title Título */
	title?: string;
	/** @title Subtítulo */
	subtitle?: string;
	/** @title Texto */
	body?: string;
	/** @title Botão principal */
	ctaLabel?: string;
	/**
	 * @title Link do botão principal
	 * @description link do botão; vazio mostra o texto como selo "em breve", sem link
	 */
	ctaHref?: string;
	/** @title Outro idioma: rótulo (ex.: EN) */
	otherLangLabel?: string;
	/** @title Outro idioma: link (ex.: /en?lang=en) */
	otherLangHref?: string;
	/** @title Link da documentação no topo: rótulo */
	docsLabel?: string;
	/** @title Link da documentação no topo */
	docsHref?: string;
	/** @title Botão secundário */
	secondaryLabel?: string;
	/** @title Link do botão secundário */
	secondaryHref?: string;
	/** @title Garantias (abaixo dos botões) */
	promises?: string[];
}

export default function Hero({
	domain = "zapzero.dev",
	eyebrow = "",
	title = "Zere o WhatsApp.",
	subtitle = "",
	body = "",
	ctaLabel = "Quero testar",
	ctaHref = "",
	otherLangLabel = "",
	otherLangHref = "",
	docsLabel = "",
	docsHref = "",
	secondaryLabel = "",
	secondaryHref = "#como-funciona",
	promises = [],
}: Props) {
	return (
		<section className="hero">
			<nav className="wrap top">
				<a href="/" aria-label="zapzero">
					<Logo />
				</a>
				<span className="domain">{domain}</span>
				{docsHref ? (
					<a className="top-link" href={docsHref}>
						{docsLabel}
					</a>
				) : null}
				{otherLangHref ? (
					<a className="lang" href={otherLangHref} hrefLang={otherLangLabel.toLowerCase()}>
						{otherLangLabel}
					</a>
				) : null}
				{ctaHref ? (
					<a className="btn small" href={ctaHref}>
						{ctaLabel}
					</a>
				) : (
					<span className="btn small soon">{ctaLabel}</span>
				)}
			</nav>
			<div className="wrap hero-copy">
				{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
				<h1 className="display">{title}</h1>
				{subtitle ? <p className="sub">{subtitle}</p> : null}
				{body ? <p className="lede">{body}</p> : null}
				<div className="actions">
					{ctaHref ? (
						<a className="btn" href={ctaHref}>
							{ctaLabel} <span aria-hidden="true">→</span>
						</a>
					) : (
						<span className="btn soon">{ctaLabel}</span>
					)}
					{secondaryLabel ? (
						<a className="btn ghost" href={secondaryHref}>
							{secondaryLabel}
						</a>
					) : null}
				</div>
				{promises.length ? (
					<ul className="promises">
						{promises.map((p) => (
							<li key={p}>{p}</li>
						))}
					</ul>
				) : null}
			</div>
		</section>
	);
}
