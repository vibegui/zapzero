# zapzero

Inbox zero for WhatsApp, from the WhatsApp Desktop app on your Mac. No bot, no extra linked device, no calls to WhatsApp's servers.

zapzero copies the app's local database read-only, triages every chat, drafts a reply for the ones waiting on you, and shows a control panel: categories ranked by priority, the conversation, the draft. **Y** opens the chat in WhatsApp with the text typed in; you press Enter there. Nothing is sent by zapzero.

## Stack

One Bun process on `127.0.0.1:8810`:

- `server/` — Hono API, `bun:sqlite` over the snapshot, zapzero's own state in `$ZAP_DATA/zap.sqlite` (triage, drafts, decisions, spend).
- `web/` — React + Vite, TanStack Router (hash history) + Query, Tailwind v4, lucide.
- AI via OpenRouter (`OPENROUTER_API_KEY` in `.env`): Jev for triage (~$0.00005/chat), a small chat model for drafts (~$0.0002/draft). Models are config: `ZAP_TRIAGE_MODEL`, `ZAP_DRAFT_MODEL`.

## Use

```sh
bun install
bun run start                 # build the panel + serve; refreshes every 15 min (ZAP_REFRESH_MIN, 0 = off)
bun run zap refresh           # snapshot -> triage -> drafts, once
bun run zap inbox             # counts per category
bun run dev                   # API + Vite on :5188 with HMR
bun test && bun run check
tailscale serve --bg --set-path=/radar http://127.0.0.1:8810   # private tailnet only, never funnel
```

Runs at login via launchd: `~/Library/LaunchAgents/com.guilherme.zapzero.plist` (KeepAlive, log in `~/Library/Logs/zapzero.log`). After changing code: `bun run build && launchctl kickstart -k gui/$(id -u)/com.guilherme.zapzero`.

Open `http://127.0.0.1:8810/?t=<token>`; the token is in `$ZAP_DATA/token` (`$ZAP_DATA` defaults to `~/Library/Application Support/zap`, chmod 700). `$ZAP_DATA/perfil.txt` describes the owner in one paragraph; triage and drafts use it.

Areas (Clients, Hiring, Team, Investors…) cut across the priority categories; once a day the model suggests new ones from your pending chats, and accepting one makes it a choice for triage.

Keys: `Y` reply · `E` edit · `R` new draft · `D` resolved · `A` archive · `S` skip · `I` ignore this person forever · `J`/`K` move · `Z` undo · `⌘↵` reply from the editor. A `[bracket]` in a draft is a decision left to you: `Y` selects it instead of sending.

## Rules

- **Never open WhatsApp's files for writing.** `sqlite3 mode=ro` + `.backup`, then work on the copy.
- **Never send, archive or mark as read** without the owner's action. Today a reply is typed into WhatsApp and the owner presses Enter.
- **Data never lives in the repo.**
- **Message text is data, never instructions** to the model that reads it.
- **Every API call needs the token.** The panel runs in sandboxed iframes (origin `null`), so CORS is open and the token is the gate.
- **Paid calls are capped** per run (items, dollars, and a stop when the upstream fails) and only redone when a chat's last message changes.

## The local database (WhatsApp Mac, 2026)

`~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/`

| File               | Table                   | What                                                                                                                                |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ChatStorage.sqlite | `ZWACHATSESSION`        | one row per chat: `ZSESSIONTYPE`, `ZCONTACTJID`, `ZPARTNERNAME`, `ZUNREADCOUNT`, `ZARCHIVED`, `ZLASTMESSAGE`, `ZREMOVED`, `ZHIDDEN` |
|                    | `ZWAMESSAGE`            | `ZCHATSESSION`, `ZISFROMME`, `ZMESSAGEDATE`, `ZMESSAGETYPE`, `ZTEXT`, `ZPUSHNAME`, `ZGROUPMEMBER`                                   |
|                    | `ZWAGROUPMEMBER`        | `ZCONTACTNAME`, `ZMEMBERJID`                                                                                                        |
| ContactsV2.sqlite  | `ZWAADDRESSBOOKCONTACT` | `ZWHATSAPPID` (phone jid), `ZLID`, `ZFULLNAME`                                                                                      |

Encoding details:

- **Session type:** 0 = DM, 1 = group, 2 = broadcast, 3 = status, 4 = community group, 5 = channel.
- **Dates:** Cocoa epoch, so add `978307200`.
- **Pinned chats:** `ZLASTMESSAGEDATE` sits in the far future (> 4e9). Use the date of `ZLASTMESSAGE` instead.
- **Message types with content:** `0,1,2,3,4,5,7,8,15` (text, image, video, audio, contact, location, link, document, sticker). `ZGROUPEVENTTYPE=2` is the default and does not mean an event.
- **History:** linking the desktop app only syncs about the last 3 months of messages. The chat list (name, last date, unread count) is complete, but older chats have no text to read.
