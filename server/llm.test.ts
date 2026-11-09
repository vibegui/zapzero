import { expect, test } from "bun:test";
import { onlyMessage, parseJson } from "./llm.ts";

test("parseJson finds the object inside fences and prose", () => {
	expect(parseJson('```json\n{"a": [1, {"b": 2}]}\n```')).toEqual({ a: [1, { b: 2 }] });
	expect(parseJson('Aqui está: {"x": "}"} pronto')).toEqual({ x: "}" });
	expect(() => parseJson("nada")).toThrow();
});

test("onlyMessage keeps the reply, never the model's reasoning", () => {
	expect(onlyMessage("Pensando: ele perguntou.\n\n<msg>Valeu, vou mandar lá!</msg>")).toBe(
		"Valeu, vou mandar lá!",
	);
	expect(onlyMessage("A última msg é de setembro. Valeu, vou mandar lá!")).toBe(""); // no tags
	expect(onlyMessage("<msg>Pensei em escrever o rascunho do dono, mas…</msg>")).toBe("");
	expect(onlyMessage("<msg></msg>")).toBe("");
});
