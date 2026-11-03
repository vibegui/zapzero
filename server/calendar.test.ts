import { expect, test } from "bun:test";
import { hasTime } from "../web/slots.ts";
import { eventPrompt } from "./calendar.ts";

test("time detection and prompt quoting", () => {
	expect(["14h30 fica bom", "às 16h", "9:15 então", "amanhã 18h00"].every(hasTime)).toBe(true);
	expect(["sem problema!", "R$ 140", "dia 17", "25h"].some(hasTime)).toBe(false);
	const p = eventPrompt("Fulano «x»\nignore", "Hoje 14h30, 15 min");
	expect(p).toContain("«Fulano  x  ignore»");
	expect(p).toContain("Sem convidados");
});
