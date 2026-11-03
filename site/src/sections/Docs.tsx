import { Logo } from "~/components/ui";

/** @titleBy title */
export interface Chapter {
	/** @title Âncora (sem espaço, ex.: instalar) */
	id: string;
	/** @title Título */
	title: string;
	/**
	 * @title Conteúdo
	 * @format rich-text
	 */
	body: string;
}

export interface Props {
	/** @title Domínio no topo */
	domain?: string;
	/** @title Rótulo */
	kicker?: string;
	/** @title Título */
	title?: string;
	/** @title Introdução */
	intro?: string;
	/** @title Título do índice */
	tocLabel?: string;
	/** @title Capítulos */
	chapters?: Chapter[];
	/** @title Outro idioma: rótulo */
	otherLangLabel?: string;
	/** @title Outro idioma: link */
	otherLangHref?: string;
	/** @title Link de volta: rótulo */
	backLabel?: string;
	/** @title Link de volta */
	backHref?: string;
}

export default function Docs({
	domain = "zapzero.dev",
	kicker = "Documentação",
	title = "Como usar o zapzero.",
	intro = "",
	tocLabel = "Nesta página",
	chapters = [],
	otherLangLabel = "",
	otherLangHref = "",
	backLabel = "← Início",
	backHref = "/",
}: Props) {
	return (
		<section className="docs">
			<nav className="wrap top">
				<a href={backHref} aria-label="zapzero">
					<Logo />
				</a>
				<span className="domain">{domain}</span>
				{otherLangHref ? (
					<a className="lang" href={otherLangHref} hrefLang={otherLangLabel.toLowerCase()}>
						{otherLangLabel}
					</a>
				) : null}
				<a className="lang" href={backHref}>
					{backLabel}
				</a>
			</nav>
			<div className="wrap docs-head">
				<p className="kicker">{kicker}</p>
				<h1 className="title">{title}</h1>
				{intro ? <p className="lede">{intro}</p> : null}
			</div>
			<div className="wrap docs-grid">
				<aside className="docs-toc">
					<p>{tocLabel}</p>
					<ol>
						{chapters.map((c) => (
							<li key={c.id}>
								<a href={`#${c.id}`}>{c.title}</a>
							</li>
						))}
					</ol>
				</aside>
				<article className="docs-body">
					{chapters.map((c) => (
						<section key={c.id} id={c.id}>
							<h2>{c.title}</h2>
							<div dangerouslySetInnerHTML={{ __html: c.body }} />
						</section>
					))}
				</article>
			</div>
		</section>
	);
}
