import { expect, test } from "bun:test";
import { parseJson } from "./llm.ts";

test("parseJson finds the object inside fences and prose", () => {
	expect(parseJson('```json\n{"a": [1, {"b": 2}]}\n```')).toEqual({ a: [1, { b: 2 }] });
	expect(parseJson('Aqui está: {"x": "}"} pronto')).toEqual({ x: "}" });
	expect(() => parseJson("nada")).toThrow();
});
