# zap: plano

Destino: uma **skill** + um **micro web app self-contained** que qualquer pessoa pluga no próprio WhatsApp Desktop pra entender e pilotar o WhatsApp. Sem bot, sem aparelho conectado a mais, sem servidor de terceiros. Hoje roda pro Gui; cada passo abaixo deixa o caminho pra publicar.

## 1. Ler (feito)

- [x] Snapshot read-only do banco local (`zap.sh snapshot`).
- [x] Visão geral sem conteúdo: conhecidos × desconhecidos × grupos, não lidas, quem falou por último.
- [x] Cohorts semanais: % respondido em 24h, sem resposta, onde o volume de grupos explodiu.
- [x] Triagem de DMs em cascata: regras grátis → Jev (~$0.00004/chat) → Haiku só na faixa incerta.
- [x] Assuntos dos grupos (1 semana): Haiku resume, Jev pontua relevância e "vale avisar".
- [x] Radar + tela de limpeza servidos só no tailnet pessoal. Decisões salvas em `decisoes.json`.
- [ ] Haiku nas ~60 DMs em que o Jev ficou em dúvida.
- [ ] Assuntos dos ~30 grupos ativos, toda semana; juntar assuntos repetidos entre grupos; "conversa solta" só se citar o dono.
- [ ] O resumo dos grupos ainda é feito à mão por subagents Haiku: virar um comando (`zap.sh digest`) com o prompt versionado.

## 2. Agir (direção contrária: as decisões acontecerem)

Princípio: a tela registra a intenção; um executor separado faz no app do Mac, devagar, como uma pessoa faria. Toda ação vem de um clique do dono. Nada sai sozinho.

**Executor = o próprio WhatsApp Desktop**, comandado pela acessibilidade do macOS (AppleScript/JXA com System Events, ou um binário Swift pequeno com AXUIElement). Sem Baileys, sem aparelho a mais, sem chamadas diretas ao WhatsApp. Pro servidor, é o app oficial sendo usado.

Fila: `acoes.jsonl` no diretório de dados. Uma linha por ação: `{id, tipo, chat, texto?, aprovado_em}`. O executor consome, registra o resultado e confere no banco.

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
