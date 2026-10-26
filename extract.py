"""Writes non-archived DMs (most recent first) as text shards: last 8 messages per chat."""
import sqlite3, sys, time, os
d = sys.argv[1]; per = int(sys.argv[2])
db = sqlite3.connect(f"file:{d}/chat.sqlite?mode=ro", uri=True)
db.execute(f"attach 'file:{d}/contacts.sqlite?mode=ro' as c")
COCOA = 978307200
day = lambda ts: time.strftime("%Y-%m-%d", time.localtime(ts + COCOA)) if ts else "?"
TYPES = {7: 'link', 1: "imagem", 2: "vídeo", 3: "áudio", 4: "contato", 5: "localização", 8: "documento", 15: "sticker"}
chats = db.execute("""
select s.Z_PK, s.ZPARTNERNAME, s.ZCONTACTJID, s.ZUNREADCOUNT, s.ZLASTMESSAGEDATE,
  exists(select 1 from c.ZWAADDRESSBOOKCONTACT a where a.ZWHATSAPPID = s.ZCONTACTJID or a.ZLID = s.ZCONTACTJID),
  (select count(*) from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZISFROMME = 1)
from ZWACHATSESSION s
where s.ZSESSIONTYPE = 0 and coalesce(s.ZARCHIVED,0) = 0 and coalesce(s.ZREMOVED,0) = 0
  and exists(select 1 from ZWAMESSAGE m where m.ZCHATSESSION = s.Z_PK)
order by s.ZLASTMESSAGEDATE desc""").fetchall()
blocks = []
for pk, name, jid, unread, last, saved, mine in chats:
    msgs = db.execute("""select ZISFROMME, ZMESSAGEDATE, ZMESSAGETYPE, ZTEXT from ZWAMESSAGE
      where ZCHATSESSION = ? and ZMESSAGETYPE in (0,1,2,3,4,5,7,8,15) order by ZMESSAGEDATE desc limit 8""", (pk,)).fetchall()
    lines = [f"### chat {pk} | {name or 'sem nome'} | {'na agenda' if saved else 'fora da agenda'} | não lidas {unread or 0} | Gui respondeu {mine}x no histórico | última {day(msgs[0][1]) if msgs else '?'}"]
    for me, ts, kind, text in reversed(msgs):
        body = (text or "").replace("\n", " ").strip()[:300] or f"[{TYPES.get(kind, 'mídia')}]"
        lines.append(f"{day(ts)} {'GUI' if me else 'ELES'}: {body}")
    blocks.append("\n".join(lines))
for i in range(0, len(blocks), per):
    with open(f"{d}/shards/dm-{i // per:02d}.txt", "w") as f:
        f.write("\n\n".join(blocks[i:i + per]) + "\n")
print(len(blocks), "chats,", (len(blocks) + per - 1) // per, "shards")
