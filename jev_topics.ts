// Jev relevance of each group topic for Gui: one decisions call per topic, written back into digests/all.json.
const dir = process.argv[2]!;
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY missing: put it in zap/.env");
const PERFIL = (await Bun.file(`${dir}/perfil.txt`).text()).trim();
const MODEL = process.env.JEV_MODEL ?? "typesafe/jev-1.14";
const QUESTIONS = {
  relevancia: { type: "score", instructions: "Quanto este assunto de grupo de WhatsApp importa para o Gui, dado o `perfil`?", criteria: ["irrelevante", "curiosidade", "útil saber", "precisa saber"] },
  avisar: { type: "choice", instructions: "Vale avisar o Gui agora, em vez de deixar só no resumo semanal?", criteria: {
    sim: "sim: pede ação dele, risco para a deco ou as lojas, ou alguém o citou/cobrou", nao: "não: basta estar no resumo" } },
  tipo: { type: "choice", instructions: "Que tipo de assunto é?", criteria: {
    acao: "algo que o Gui precisa fazer ou decidir", risco: "risco de segurança, operação ou reputação", oportunidade: "oportunidade de negócio, contratação, parceria", aprendizado: "ferramenta, técnica ou ideia útil", social: "social, política, lazer" } },
};
const topics: any[] = [];
for (const f of new Bun.Glob("*.jsonl").scanSync(`${dir}/digests`))
  for (const l of (await Bun.file(`${dir}/digests/${f}`).text()).trim().split("\n").filter(Boolean)) topics.push(JSON.parse(l));
let cost = 0, next = 0; const t0 = Date.now();
const top = (a: any) => Object.entries(a.probabilities as Record<string, number>).sort((x, y) => y[1] - x[1])[0]![0];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < topics.length) {
    const t = topics[next++]!;
    const res = await fetch("https://openrouter.ai/api/alpha/decisions", { method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, state: { perfil: PERFIL, assunto: { grupo: t.grupo, titulo: t.titulo, resumo: t.resumo, gui_participou: t.gui } }, questions: QUESTIONS }) });
    if (!res.ok) { console.error(t.titulo, res.status); continue; }
    const b: any = await res.json(); cost += b.usage?.cost ?? 0;
    Object.assign(t, { relevancia: +b.answers.relevancia.score.toFixed(2), avisar: +b.answers.avisar.probabilities.sim.toFixed(2), tipo: top(b.answers.tipo) });
  }
}));
await Bun.write(`${dir}/digests/all.json`, JSON.stringify(topics));
console.log(`${topics.length} topics, ${((Date.now() - t0) / 1000).toFixed(1)}s, cost $${cost.toFixed(4)}`);
for (const t of topics.filter((t) => t.avisar >= 0.5).sort((a, b) => b.avisar - a.avisar)) console.log(`  avisar ${t.avisar} rel ${t.relevancia} ${t.tipo.padEnd(12)} ${t.grupo.slice(0, 14).padEnd(14)} ${t.titulo}`);
