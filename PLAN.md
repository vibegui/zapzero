# zapzero: plano

Destino: uma **skill** + um **micro web app self-contained** que qualquer pessoa pluga no próprio WhatsApp Desktop pra entender e pilotar o WhatsApp. Sem bot, sem aparelho conectado a mais, sem servidor de terceiros. Hoje roda pro Gui; cada passo abaixo deixa o caminho pra publicar.

## 0. Central de priorização (feito, nov/2026)

TypeScript num processo Bun só (Hono + React/TanStack). Substituiu os scripts Python, o radar e a tela de limpeza.

- [x] Snapshot read-only a cada 15 min, triagem Jev só do que mudou, rascunho Haiku pra quem espera resposta. Tetos por rodada.
- [x] Categorias ranqueadas: importante e urgente / essa semana / mais de uma semana / você está esperando / grupos e lazer / limpeza.
- [x] Painel com atalhos: Y abre a conversa no WhatsApp com o texto (o dono aperta Enter), D resolvida, A arquivar (intenção), S pular, Z desfazer. Decisão vale até chegar mensagem nova.
- [x] Rascunho deixa decisões [entre colchetes]; Y seleciona o colchete em vez de mandar.
- [x] MCP app no deco Studio: Worker público mínimo com 1 tool cujo `ui://` é um iframe pro tailnet (`_meta.ui.csp.frameDomains`). O token vai no casco, que só o Studio autenticado recebe. Nenhum dado do WhatsApp passa pelo Worker.
- [x] launchd: o servidor sobe com o Mac (`com.guilherme.zapzero`).
- [x] Ignorar pessoa para sempre (I): some de tudo, sai da triagem e dos rascunhos.
- [x] No Studio: tela WhatsApp no projeto autogui (vibegui/autogui#14). Requer `chrome://flags/#local-network-access-check` desligado até o Studio delegar `local-network-access` ao iframe.
- [x] Áreas (quem é a pessoa / do que se trata): Clientes, Hiring, Time, Investidores, Parceiros, Família, Amigos, Casa e serviços, Te vendendo algo, Outros. Jev classifica junto com a triagem.
- [x] Sugestões de áreas novas: 1x por dia o modelo olha as conversas pendentes e propõe até 4 (projeto, evento, tipo de pessoa). Aceitar vira área e o Jev reclassifica o resto.
- [ ] Contatos @lid sem telefone e grupos: hoje Y copia o texto e abre o app; achar a conversa sozinho.
- [ ] Radar (cohorts, % respondido em 24h) e assuntos dos grupos voltam como aba, se fizer falta.

## 2. Agir (direção contrária: as decisões acontecerem)

Princípio: a tela registra a intenção; um executor separado faz no app do Mac, devagar, como uma pessoa faria. Toda ação vem de um clique do dono. Nada sai sozinho.

**Executor = o próprio WhatsApp Desktop**, comandado pela acessibilidade do macOS (AppleScript/JXA com System Events, ou um binário Swift pequeno com AXUIElement). Sem Baileys, sem aparelho a mais, sem chamadas diretas ao WhatsApp. Pro servidor, é o app oficial sendo usado.

Fila: a tabela `decisions` em `zap.sqlite` (kind `archive`, e `reply` quando o envio for automático). O executor consome, registra o resultado e confere no banco.

### 2a. Arquivar

1. Achar a conversa sem abri-la: abrir marca como lida. Testar primeiro numa conversa sem importância se o botão direito na lista oferece "Arquivar". Se só der abrindo, guardar quantas não lidas tinha e avisar na tela antes de executar.
2. Ritmo: 1 conversa a cada 3–5 s, em lotes de 50, pausa entre lotes. Para no primeiro erro.
3. Conferir: novo snapshot depois de cada lote; `ZARCHIVED=1` e `ZUNREADCOUNT` igual ao de antes. O que não bateu volta pra tela como "falhou".
4. Desfazer: a mesma fila com `desarquivar`.

### 2b. Responder

1. Rascunho: o modelo propõe a resposta (contexto = últimas mensagens + perfil). Aparece na tela, editável. Nunca envia sem o clique "enviar" daquela mensagem específica.
2. Executor: abre a conversa, cola o texto no campo e envia. Abrir marca como lida, e aqui tudo bem, porque responder é ler.
3. Conferir: snapshot mostra a mensagem `ZISFROMME=1` com o texto, no chat certo. Se não aparecer em 30 s, alerta.
4. Limites: no máximo N envios por hora; nunca para um contato com quem o dono não fala há mais de X meses sem confirmação extra; nunca em grupo sem confirmação extra.

### 2c. Depois

- Silenciar grupos barulhentos. Marcar como lida só quando o dono pedir explicitamente, por conversa.
- Alertas dos grupos no /hoje do autogui.

## 3. Publicar (skill + micro web app)

- [ ] Tirar o que é do Gui do código: textos "Gui/GUI" nas perguntas do Jev viram "o dono"; `perfil.txt` gerado na primeira execução (perguntar 3 coisas).
- [ ] Chave do modelo: OpenRouter por chave colada ou PKCE ("Connect with OpenRouter"), modelo configurável. Opção 100% local (Ollama) pra quem não quer mandar conversa pra nuvem.
- [ ] Um só processo: o servidor serve as páginas, roda snapshot/build e expõe a fila de ações. Python stdlib ou Bun, sem dependências.
- [ ] Skill (`SKILL.md`): o esquema do banco (ver README), as regras de segurança, os comandos. Assim qualquer agente consegue pilotar.
- [ ] Permissões do macOS: Full Disk Access pra ler o container do WhatsApp e Accessibility pra o executor. Explicar na primeira execução.
- [ ] Testes: um self-check com um `ChatStorage.sqlite` sintético (sem dado real) cobrindo datas Cocoa, chats fixados, tipos de mensagem.

## Fora de escopo

- Baileys / WhatsApp Web não oficial: o ramo `vibegui/whatsapp` do autogui fica como referência e não é o caminho, por risco de bloqueio do número.
- Escrever no banco do app: ele é do WhatsApp; mudar lá desincroniza e pode corromper.
