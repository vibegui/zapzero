import { expect, test } from "bun:test";
import { setLang, t, tf, tReason } from "./i18n.ts";

test("pt is untouched, en is looked up, reasons translate piece by piece", () => {
	setLang("pt");
	expect(t("Essa semana")).toBe("Essa semana");
	expect(tReason("trabalho · você perguntou")).toBe("trabalho · você perguntou");
	setLang("en");
	expect(t("Essa semana")).toBe("This week");
	expect(t("frase sem tradução")).toBe("frase sem tradução");
	expect(tf("esperando há {t}", { t: "3 h" })).toBe("waiting 3 h");
	expect(tReason("trabalho · você perguntou")).toBe("work · you asked");
	expect(tReason("12 não lidas")).toBe("12 unread");
	expect(tReason("convite pendente: mandou a@b.co")).toBe("invite pending: sent a@b.co");
	setLang("pt");
});
