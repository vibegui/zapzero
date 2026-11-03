// A [slot] is a decision the draft left to the owner: "[hoje 14h15 | hoje 16h30]" offers choices,
// "[preço?]" asks for a free value. Filling one replaces the brackets with the value in the text.
export type Slot = { start: number; end: number; hint: string; options: string[] };

export function slots(text: string): Slot[] {
	const out: Slot[] = [];
	for (const m of text.matchAll(/\[([^\]\n]+)\](?!\()/g)) {
		const parts = m[1]!
			.split("|")
			.map((s) => s.trim())
			.filter(Boolean);
		out.push({
			start: m.index,
			end: m.index + m[0].length,
			hint: parts.length > 1 ? "" : (parts[0] ?? ""),
			options: parts.length > 1 ? parts : [],
		});
	}
	return out;
}

export const fill = (text: string, s: Slot, value: string) =>
	text.slice(0, s.start) + value + text.slice(s.end);
