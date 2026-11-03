# zapzero roadmap

Goal: a skill + a self-contained app anyone can plug into their own WhatsApp Desktop to understand and pilot their WhatsApp. No bot, no extra device, no third-party server.

## Done

- Read-only snapshot of WhatsApp Desktop's database every 15 minutes (launchd).
- Triage per DM with Jev on OpenRouter: who waits on whom, urgency, who the person is, area. Only chats whose last message changed.
- Ranked categories (urgent, this week, older, you're waiting, groups, cleanup) and areas (clients, hiring, team…), plus AI-suggested areas once a day.
- Drafts in the owner's tone of voice. "Seu jeito": after the first scan the AI writes who the owner is and how they write; the owner accepts or edits it.
- Keyboard panel: reply (opens WhatsApp with the text, owner presses Enter), resolve, archive (intent only), skip, ignore forever, undo.
- Token-gated API; works on a private tailnet and as an MCP App screen.
- `bun run setup`: checks, first scan, build, launchd agent.

## Next

- **Archive executor.** Archive is recorded but not carried out. Drive WhatsApp Desktop through macOS Accessibility (AppleScript/JXA or a small Swift binary): find the chat without opening it (opening marks it read), archive one every 3–5 s in batches of 50, verify `ZARCHIVED=1` and an unchanged unread count in the next snapshot, undo with unarchive.
- **Sending without the Enter.** Optional, per message: paste and send through Accessibility, verify `ZISFROMME=1` in the next snapshot, hourly limits, extra confirmation for groups and people not talked to in months.
- **Chats without a phone number** (`@lid` contacts, groups): today Y copies the text and opens the app; find and open the chat directly.
- **Group digests**: weekly topics per active group, alerting only when the owner is mentioned or something needs them.
- **Local models**: Ollama for drafts and suggestions, for people who want nothing to leave the Mac.
- **English UI** and onboarding inside the panel instead of the terminal.
- **Synthetic `ChatStorage.sqlite` fixture** to test the reader (Cocoa dates, pinned chats, message types) without real data.

## Out of scope

- Baileys / unofficial WhatsApp Web clients: they risk a ban.
- Writing to the app's database: it belongs to WhatsApp; changing it desyncs and can corrupt it.
