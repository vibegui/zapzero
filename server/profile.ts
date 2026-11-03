// Shared with the panel: no imports, so the web bundle can use it.
/** The profile is split in topics so the owner can fix one piece without rewriting the rest. */
export const PROFILE_TOPICS = [
	{
		id: "voce",
		label: "Você",
		hint: "nome e sobrenome, como te chamam, onde e quando nasceu, de onde é a família",
	},
	{ id: "mora", label: "Onde você mora", hint: "cidade, bairro, com quem mora" },
	{ id: "trabalho", label: "Trabalho", hint: "empresa, cargo, o que faz, com quem trabalha" },
	{
		id: "familia",
		label: "Família",
		hint: "parceira ou parceiro, filhos, pais, irmãos: nomes e como aparecem no WhatsApp",
	},
	{ id: "pessoas", label: "Pessoas que importam", hint: "um por linha: nome — quem é pra você" },
	{ id: "projetos", label: "Projetos e assuntos do momento", hint: "o que está rolando agora" },
	{
		id: "rotina",
		label: "Rotina e interesses",
		hint: "esportes, hobbies, horários, compromissos fixos",
	},
	{ id: "idiomas", label: "Idiomas", hint: "em que língua fala com quem" },
	{ id: "outros", label: "Outros", hint: "qualquer coisa que ajude a entender suas conversas" },
] as const;
export type ProfileTopic = (typeof PROFILE_TOPICS)[number]["id"];
export type Profile = Record<ProfileTopic, string>;
