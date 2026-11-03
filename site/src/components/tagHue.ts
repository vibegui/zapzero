import type { CSSProperties } from "react";

/** Same as the panel: each tag its own hue, spaced by the golden angle in list order. */
export const tagStyle = (n: number) => ({ "--h": `${(n * 137.5 + 250) % 360}` }) as CSSProperties;
