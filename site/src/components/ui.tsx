import type { ReactNode } from "react";

/** Section opener: small label, big title, optional second line in a quieter tone. */
export function Head({
	kicker,
	title,
	dim,
	id,
}: {
	kicker?: string;
	title: string;
	dim?: string;
	id?: string;
}) {
	return (
		<header className="head" id={id}>
			{kicker ? <p className="kicker">{kicker}</p> : null}
			<h2 className="title">
				{title}
				{dim ? <span className="dim"> {dim}</span> : null}
			</h2>
		</header>
	);
}

/** Highlights the [bracketed] parts of a draft: the commitments left for you to fill. */
export function Draft({ text }: { text: string }) {
	return (
		<>
			{text.split(/(\[[^\]]*\])/).map((part, i) =>
				part.startsWith("[") && part.endsWith("]") ? (
					<mark key={i} className="fill">
						{part}
					</mark>
				) : (
					part
				),
			)}
		</>
	);
}

export function Key({ children, big }: { children: ReactNode; big?: boolean }) {
	return <kbd className={big ? "key big" : "key"}>{children}</kbd>;
}

export function Logo() {
	return (
		<span className="logo">
			<svg viewBox="0 0 32 32" aria-hidden="true">
				<rect width="32" height="32" rx="9" fill="var(--accent)" />
				<circle cx="16" cy="16" r="7" fill="none" stroke="var(--accent-ink)" strokeWidth="3.2" />
			</svg>
			zapzero
		</span>
	);
}
