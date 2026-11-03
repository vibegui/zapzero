import { expect, test } from "bun:test";
import { phoneKeys } from "./contacts.ts";

test("phoneKeys matches Brazilian mobiles with or without the extra 9", () => {
	const a = phoneKeys("+55 21 98604-1234");
	const b = phoneKeys("55218604-1234".replace("2186", "2186"));
	expect(a).toContain("5521986041234");
	expect(a.at(-1)).toBe(phoneKeys("+55 (21) 8604-1234").at(-1));
	expect(b.length).toBe(2);
	expect(phoneKeys("+1 407 555 0100")).toEqual(["14075550100"]);
});
