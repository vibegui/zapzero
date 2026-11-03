import { expect, test } from "bun:test";
import { fill, slots } from "./slots.ts";

test("choices, free values, links left alone, fill", () => {
	const t = "Pode sim! [hoje 14h15 | hoje 16h30] tá ótimo. Valor [preço?]. Ver [doc](https://x.y)";
	const s = slots(t);
	expect(s.map((x) => x.options)).toEqual([["hoje 14h15", "hoje 16h30"], []]);
	expect(s[1]!.hint).toBe("preço?");
	const once = fill(t, s[0]!, "hoje 16h30");
	expect(once.startsWith("Pode sim! hoje 16h30 tá ótimo.")).toBe(true);
	expect(slots(once)).toHaveLength(1);
});
