"""Dumps the last N days of chosen groups as text, one file per group, for topic digests."""
import sqlite3, sys, time, re
d, days, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
db = sqlite3.connect(f"file:{d}/chat.sqlite?mode=ro", uri=True)
C = 978307200; since = time.time() - days * 86400 - C
for name in names:
    pk, = db.execute("select Z_PK from ZWACHATSESSION where ZSESSIONTYPE in (1,4) and ZPARTNERNAME = ?", (name,)).fetchone()
    rows = db.execute("""select m.ZMESSAGEDATE, m.ZISFROMME, coalesce(g.ZCONTACTNAME, m.ZPUSHNAME, '?'), m.ZTEXT, m.ZMESSAGETYPE
      from ZWAMESSAGE m left join ZWAGROUPMEMBER g on g.Z_PK = m.ZGROUPMEMBER
      where m.ZCHATSESSION = ? and m.ZMESSAGEDATE > ? and m.ZMESSAGETYPE in (0,1,2,7,8) order by m.ZMESSAGEDATE""", (pk, since)).fetchall()
    lines = [f"# grupo: {name} | {len(rows)} mensagens nos últimos {days} dias"]
    for ts, me, who, text, kind in rows:
        body = (text or "").replace("\n", " ").strip()[:300]
        if not body: continue
        lines.append(f"{time.strftime('%d/%m %H:%M', time.localtime(ts + C))} {'GUI' if me else who}: {body}")
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or str(pk)
    open(f"{d}/groups/{slug}.txt", "w").write("\n".join(lines) + "\n")
    print(slug, len(rows), len(lines) - 1, sum(map(len, lines)))
