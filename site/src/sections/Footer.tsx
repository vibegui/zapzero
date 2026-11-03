import { Logo } from "~/components/ui";

/** @titleBy label */
export interface Link {
	/** @title Texto */
	label: string;
	/** @title Link */
	href: string;
}

export interface Props {
	/** @title Chamada final */
	closer?: string;
	/** @title Botão */
	ctaLabel?: string;
	/** @title Link do botão */
	ctaHref?: string;
	/** @title Domínio */
	domain?: string;
	/** @title Links */
	links?: Link[];
	/** @title Nota de rodapé */
	fine?: string;
}

export default function Footer({
	closer = "",
	ctaLabel = "Quero testar",
	ctaHref = "",
	domain = "zapzero.dev",
	links = [],
	fine = "",
}: Props) {
	return (
		<footer className="foot">
			<div className="wrap">
				{closer ? (
					<div className="closer">
						<p className="display">{closer}</p>
						{ctaHref ? (
							<a className="btn" href={ctaHref}>
								{ctaLabel} <span aria-hidden="true">→</span>
							</a>
						) : (
							<span className="btn soon">{ctaLabel}</span>
						)}
					</div>
				) : null}
				<div className="foot-row">
					<Logo />
					<span className="domain">{domain}</span>
					<nav>
						{links.map((l) => (
							<a key={l.label} href={l.href}>
								{l.label}
							</a>
						))}
					</nav>
				</div>
				{fine ? <p className="fine">{fine}</p> : null}
			</div>
		</footer>
	);
}
