// UI language. Portuguese is the source text; English is looked up by that exact string.
// The server picks the language (inbox.lang); Shell calls setLang during render.
export type Lang = "pt" | "en";

let current: Lang = "pt";
export const setLang = (l: Lang) => {
	current = l;
};
export const lang = () => current;
/** for toLocaleString / Intl */
export const locale = () => (current === "en" ? "en-US" : "pt-BR");

export const t = (pt: string): string => (current === "en" ? (EN[pt] ?? pt) : pt);

/** t() then fills {name} placeholders */
export const tf = (pt: string, vars: Record<string, string | number>) =>
	t(pt).replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** item.reason from server/inbox.ts: "label · suffix" pieces plus two templated ones */
export function tReason(r: string) {
	if (current !== "en") return r;
	return r
		.split(" · ")
		.map((p) => {
			const unread = p.match(/^(\d+) não lidas$/);
			if (unread) return `${unread[1]} unread`;
			const inv = p.match(/^convite pendente: mandou (.+)$/);
			if (inv) return `invite pending: sent ${inv[1]}`;
			return t(p);
		})
		.join(" · ");
}

const EN: Record<string, string> = {
	// server: categories (server/inbox.ts CATEGORIES)
	"Importante e urgente": "Important & urgent",
	"Essa semana": "This week",
	"Mais de uma semana": "Older than a week",
	"Você está esperando": "Waiting on them",
	"Grupos e lazer": "Groups",
	Limpeza: "Cleanup",
	// server: reasons (server/inbox.ts)
	trabalho: "work",
	pessoal: "personal",
	serviço: "service",
	desconhecido: "unknown",
	empresa: "company",
	golpe: "scam",
	fixado: "pinned",
	"grupo parado, você nunca escreveu": "quiet group, you never wrote",
	"grupo parado": "quiet group",
	"sem mensagens sincronizadas há 90+ dias": "no synced messages in 90+ days",
	"aguardando triagem": "awaiting triage",
	"você perguntou": "you asked",
	revisar: "review",
	"nada a fazer": "nothing to do",
	"fora da agenda, você nunca respondeu": "not a contact, you never replied",
	"conversa encerrada": "conversation over",
	"(o Mac só sincronizou os últimos ~3 meses: sem texto desta conversa)":
		"(the Mac only synced the last ~3 months: no text for this chat)",
	// server: built-in tags (server/store.ts BUILTIN_AREAS)
	Clientes: "Clients",
	Time: "Team",
	Investidores: "Investors",
	Parceiros: "Partners",
	Família: "Family",
	Amigos: "Friends",
	"Casa e serviços": "Home & services",
	"Te vendendo algo": "Selling to you",
	Outros: "Other",
	// server: profile topics (server/profile.ts PROFILE_TOPICS)
	Você: "You",
	"nome e sobrenome, como te chamam, onde e quando nasceu, de onde é a família":
		"full name, what people call you, where and when you were born, where your family is from",
	"Onde você mora": "Where you live",
	"cidade, bairro, com quem mora": "city, neighborhood, who you live with",
	Trabalho: "Work",
	"empresa, cargo, o que faz, com quem trabalha": "company, role, what you do, who you work with",
	"parceira ou parceiro, filhos, pais, irmãos: nomes e como aparecem no WhatsApp":
		"partner, kids, parents, siblings: names and how they show up in WhatsApp",
	"Pessoas que importam": "People who matter",
	"um por linha: nome — quem é pra você": "one per line: name — who they are to you",
	"Projetos e assuntos do momento": "Current projects and topics",
	"o que está rolando agora": "what's going on right now",
	"Rotina e interesses": "Routine and interests",
	"esportes, hobbies, horários, compromissos fixos": "sports, hobbies, schedule, fixed commitments",
	Idiomas: "Languages",
	"em que língua fala com quem": "which language you speak with whom",
	"qualquer coisa que ajude a entender suas conversas":
		"anything that helps make sense of your chats",
	// api.ts ago()
	agora: "now",
	meses: "months",
	// app.tsx: shell + sidebar
	"Falta o token": "Missing token",
	"Abra o painel com": "Open the panel with",
	"(o token está em": "(the token is in",
	"Sem acesso ao Mac": "Can't reach the Mac",
	"Token inválido.": "Invalid token.",
	"O Mac está desligado ou fora do tailnet.": "The Mac is off or outside the tailnet.",
	"Proposta de agenda": "Proposed meetings",
	"Resumo dos grupos": "Group digest",
	Desempenho: "Performance",
	Feitas: "Done",
	"Seu jeito": "Your voice",
	"atualizando…": "refreshing…",
	"lido há {t}": "read {t} ago",
	"sem leitura": "not read yet",
	"Ler o WhatsApp de novo": "Read WhatsApp again",
	"IA nas últimas 24 h:": "AI in the last 24 h:",
	"Buscar nome  /": "Search name  /",
	"Nada na caixa com esse nome.": "Nothing in the inbox by that name.",
	Tags: "Tags",
	Sugestões: "Suggestions",
	"Sugerir tags novas agora": "Suggest new tags now",
	"Criar tag": "Create tag",
	Não: "No",
	"Nenhuma agora. ✨ para pedir.": "None right now. ✨ to ask.",
	// app.tsx: category + focus
	"Aberto no WhatsApp: aperte Enter lá para enviar a {name}":
		"Opened in WhatsApp: press Enter there to send to {name}",
	"Texto copiado: cole na conversa com {name}": "Text copied: paste it in the chat with {name}",
	"{name}: marcada para arquivar": "{name}: marked to archive",
	"{n} marcadas para arquivar": "{n} marked to archive",
	"{n} resolvidas": "{n} done",
	"Marcar todas": "Select all",
	"Conectar ao Claude": "Connect to Claude",
	"Contatos e e-mails": "Contacts and e-mails",
	"O e-mail de cada pessoa, pra convidar sem perguntar. Vem dos Contatos do Mac, do que a pessoa escreveu na conversa e dos convidados das suas reuniões, que o seu Claude procura no calendário.":
		"Each person's e-mail, to invite them without asking. It comes from the Mac's Contacts, from what they wrote in the chat and from your meetings' guests, which your Claude looks up in your calendar.",
	"{a} de {b} com e-mail.": "{a} of {b} with an e-mail.",
	"Manda os mais próximos sem e-mail pro seu Claude procurar nos convidados do calendário":
		"Sends the closest people with no e-mail to your Claude, to look for them among your calendar's guests",
	"Procurando no calendário…": "Searching your calendar…",
	"Buscar no calendário ({n})": "Search the calendar ({n})",
	"Nada a buscar": "Nothing to search",
	"Última busca: {f} e-mails para {a} pessoas.": "Last search: {f} e-mails for {a} people.",
	"Filtrar por nome ou número": "Filter by name or number",
	"Sugestões ({n})": "Suggestions ({n})",
	"Mais próximos primeiro": "Closest first",
	"Contatos do Mac": "Mac Contacts",
	"na conversa": "in the chat",
	calendário: "calendar",
	você: "you",
	Confirmar: "Confirm",
	"Não é": "Not them",
	"não achei no calendário": "not found in the calendar",
	"sem e-mail": "no e-mail",
	"e-mail": "e-mail",
	"Comando copiado: cole no terminal": "Command copied: paste it in the terminal",
	"Copia o comando que adiciona o zapzero ao Claude Code. Cole no terminal.":
		"Copies the command that adds zapzero to Claude Code. Paste it in the terminal.",
	"Desmarcar todas": "Select none",
	marca: "selects",
	"Arquivar {n}": "Archive {n}",
	"Marcar {name}": "Select {name}",
	"{name}: ignorada para sempre": "{name}: ignored for good",
	"{name}: resolvida": "{name}: done",
	"{name}: pulada até chegar mensagem nova": "{name}: skipped until a new message arrives",
	"criando o evento no seu calendário": "creating the event in your calendar",
	"Lendo…": "Reading…",
	"Carregando o inbox do Mac.": "Loading the inbox from the Mac.",
	"Carregando.": "Loading.",
	rascunho: "draft",
	"Zerado. 🎉": "All clear. 🎉",
	"{a} de {b}": "{a} of {b}",
	"Nada aqui": "Nothing here",
	"Escolha outra categoria.": "Pick another category.",
	desfazer: "undo",
	"esperando há {t}": "waiting {t}",
	"Ir para conversa": "Go to chat",
	"O Mac não tem o texto desta conversa (só sincroniza ~3 meses).":
		"The Mac doesn't have this chat's text (it only syncs ~3 months).",
	"no convite de": "on the invite for",
	"reescrevendo com o que você escolheu, no seu tom…":
		"rewriting with what you picked, in your tone…",
	"Não deu pra reescrever ({e}); o texto ficou com as escolhas coladas.":
		"Couldn't rewrite ({e}); your picks were pasted into the text as is.",
	"Sem rascunho: escreva, ou R para gerar": "No draft: write one, or R to generate",
	"Escreva a resposta": "Write your reply",
	"Ao responder ou resolver, garantir a call no calendário com":
		"On reply or done, make sure the call is on the calendar with",
	"você combinou: «{agreed}» · seu Claude acha o evento ou cria, e convida":
		"you agreed: «{agreed}» · your Claude finds or creates the event, and invites",
	"Ao responder, criar o evento no meu calendário": "On reply, create the event in my calendar",
	"· seu Claude cria": "· your Claude creates it",
	", só na sua agenda, sem convidados": ", only on your calendar, no guests",
	"Me passa seu e-mail que te mando o convite?": "What's your email? I'll send you the invite.",
	"+ pedir o e-mail dele pro convite": "+ ask for their email for the invite",
	convidar: "invite",
	"· recebe o convite do Google por e-mail": "· gets the Google invite by email",
	"Responder no WhatsApp": "Reply in WhatsApp",
	Arquivar: "Archive",
	"Novo rascunho": "New draft",
	Resolvida: "Done",
	Pular: "Skip",
	"Ignorar sempre": "Always ignore",
	"Arquivar tira daqui; no WhatsApp, arquive você mesmo.":
		"Archive removes it here; archive it in WhatsApp yourself.",
	"Responder abre a conversa no WhatsApp com o texto escrito. Só sai quando você aperta Enter lá.":
		"Reply opens the chat in WhatsApp with the text typed in. It only goes out when you press Enter there.",
	edita: "edit",
	"escolhe o que falta": "pick what's missing",
	navega: "navigate",
	"abre a conversa": "open the chat",
	"responde editando": "reply while editing",
	"Falta você decidir {n} coisas": "{n} things left for you to decide",
	"Falta você decidir uma coisa": "One thing left for you to decide",
	"outro…": "other…",
	"escreva e Enter": "type and Enter",
	// app.tsx: done
	respondida: "replied",
	resolvida: "done",
	pulada: "skipped",
	arquivar: "archive",
	"ignorada sempre": "always ignored",
	"criando o evento…": "creating the event…",
	"no calendário:": "on the calendar:",
	"evento não criado:": "event not created:",
	"erro no evento:": "event error:",
	"Nada ainda.": "Nothing yet.",
	// app.tsx: voice
	"Li suas mensagens e escrevi como você escreve. Confere antes dos rascunhos seguirem isso?":
		"I read your messages and wrote down how you write. Check it before drafts follow it?",
	"Conferir →": "Review →",
	"A IA leu suas mensagens, suas conversas mais ativas e seus grupos, e escreveu isto. A triagem e os rascunhos seguem esse texto: aceite ou ajuste cada parte.":
		"The AI read your messages, your most active chats and your groups, and wrote this. Triage and drafts follow it: accept or adjust each part.",
	"A triagem e os rascunhos seguem este texto. Mude quando quiser.":
		"Triage and drafts follow this text. Change it whenever you like.",
	"Depois do primeiro scan a IA preenche isto a partir das suas conversas.":
		"After the first scan the AI fills this in from your chats.",
	"Quem é você": "Who you are",
	"Como você escreve": "How you write",
	"Tamanho, tom, pontuação, emoji, expressões suas. Um tópico por linha.":
		"Length, tone, punctuation, emoji, your own expressions. One point per line.",
	Aceitar: "Accept",
	Salvar: "Save",
	"Ler minhas conversas de novo": "Read my chats again",
	"Salvo.": "Saved.",
	"Ler de novo substitui tudo pelo que a IA sugerir agora.":
		"Reading again replaces everything with what the AI suggests now.",
	"Aprendido com {n} respostas que você mudou": "Learned from {n} replies you edited",
	"Adicionar ao meu jeito": "Add to my voice",
	Descartar: "Discard",
	// agenda.tsx
	"Compromissos com dia e hora que apareceram nas conversas, seus ou da outra pessoa. Aceite e o seu Claude marca no calendário e convida quem você marcar.":
		"Meetings with a day and time that came up in your chats, proposed by you or the other person. Accept and your Claude books it on your calendar and invites whoever you tick.",
	"Precisa do Claude Code instalado, com um conector de calendário.":
		"Needs Claude Code installed, with a calendar connector.",
	"Nada proposto agora.": "Nothing proposed right now.",
	Marcados: "Booked",
	"Você para": "You to",
	"Sem e-mail conhecido: o evento fica só na sua agenda.":
		"No known email: the event stays on your calendar only.",
	"seu Claude está marcando…": "your Claude is booking it…",
	marcado: "booked",
	" · convidou {g}": " · invited {g}",
	"não deu: {r}": "failed: {r}",
	Marcar: "Book",
	// digest.tsx
	ruído: "noise",
	leve: "light",
	"vale ler": "worth reading",
	"precisa de você": "needs you",
	"Uma vez por semana o seu Claude lê os grupos mais movimentados e resume o que rolou e o que envolve você.":
		"Once a week your Claude reads your busiest groups and sums up what happened and what involves you.",
	" Últimos 7 dias, gerado {when}.": " Last 7 days, generated {when}.",
	"Lendo os grupos…": "Reading the groups…",
	"Gerar agora": "Generate now",
	"Ainda não tem resumo. Ele sai sozinho na próxima leitura, ou clique em Gerar agora.":
		"No digest yet. It comes out on its own at the next read, or click Generate now.",
	"{n} suas": "{n} yours",
	"Você:": "You:",
	// stats.tsx
	"Contatos salvos": "Saved contacts",
	Desconhecidos: "Unknown",
	Grupos: "Groups",
	"lendo…": "reading…",
	'Últimas 13 semanas, pela semana em que alguém puxou conversa com você. Conta como "puxou" a mensagem que chega depois da sua e depois de 1 h de silêncio, pra que um papo ao vivo não vire dezenas de cobranças.':
		'Last 13 weeks, by the week someone reached out to you. A "reach-out" is a message that arrives after yours and after 1 h of silence, so a live back-and-forth doesn\'t count as dozens of them.',
	"contatos respondidos em 24 h": "contacts answered within 24 h",
	"{n} pts vs. 4 semanas antes": "{n} pts vs. the 4 weeks before",
	"4 semanas fechadas": "4 complete weeks",
	"tempo típico de resposta": "typical response time",
	"mediana, contatos · esta semana {h}": "median, contacts · this week {h}",
	"ficaram sem resposta": "went unanswered",
	"contatos e desconhecidos, 4 semanas": "contacts and unknown, 4 weeks",
	"não lidas em conversas": "unread in chats",
	"{g} em grupos · {u} resolvidas no zapzero esta semana":
		"{g} in groups · {u} handled in zapzero this week",
	"Respondido em 24 h": "Answered within 24 h",
	"% das vezes em que alguém puxou conversa": "% of the times someone reached out",
	"Ficaram sem resposta": "Went unanswered",
	"Alguém puxou conversa e você nunca escreveu depois":
		"Someone reached out and you never wrote back",
	"Tempo típico de resposta": "Typical response time",
	"Mediana em horas, quando você respondeu": "Median in hours, when you answered",
	Volume: "Volume",
	"Vezes em que alguém puxou conversa, por semana": "Times someone reached out, per week",
	"Semana a semana": "Week by week",
	"Contatos salvos · a semana atual ainda está aberta":
		"Saved contacts · the current week is still open",
	semana: "week",
	puxaram: "reached out",
	"em 24 h": "in 24 h",
	"em 7 dias": "in 7 days",
	"sem resposta": "unanswered",
	típico: "typical",
	recebidas: "received",
	enviadas: "sent",
	"(aberta)": "(open)",
	"semana de {d}": "week of {d}",
};
