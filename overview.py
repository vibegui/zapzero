"""WhatsApp overview from read-only copies of the desktop app's databases. No message text."""
import sqlite3, sys, time
from collections import Counter

d = sys.argv[1]
db = sqlite3.connect(f"file:{d}/chat.sqlite?mode=ro", uri=True)
db.execute(f"attach 'file:{d}/contacts.sqlite?mode=ro' as c")
COCOA = 978307200
now = time.time()

rows = db.execute("""
select s.ZSESSIONTYPE, s.ZCONTACTJID, s.ZPARTNERNAME, s.ZARCHIVED, s.ZUNREADCOUNT,
       s.ZLASTMESSAGEDATE, m.ZISFROMME,
       (select count(*) from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZISFROMME = 1) as mine,
       (select count(*) from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK) as total,
       exists(select 1 from c.ZWAADDRESSBOOKCONTACT a where a.ZWHATSAPPID = s.ZCONTACTJID or a.ZLID = s.ZCONTACTJID) as saved
from ZWACHATSESSION s left join ZWAMESSAGE m on m.Z_PK = s.ZLASTMESSAGE
where s.ZSESSIONTYPE in (0, 1, 4, 5) and coalesce(s.ZREMOVED, 0) = 0
""").fetchall()

def age(ts):
    if not ts: return "sem data"
    days = (now - (ts + COCOA)) / 86400
    for limit, label in ((7, "<7d"), (30, "7-30d"), (90, "30-90d"), (365, "90d-1a")):
        if days < limit: return label
    return ">1a"

def bucket(kind, saved, mine):
    if kind in (1, 4): return "grupo"
    if kind == 5: return "canal"
    if saved or mine: return "conhecido"
    return "spam provável"

stats = Counter(); unread = Counter(); pend = Counter(); waiting = []
for kind, jid, name, archived, unr, ts, last_me, mine, total, saved in rows:
    b = bucket(kind, saved, mine)
    stats[b, "arquivada" if archived else "ativa"] += 1
    if unr: unread[b] += 1; unread[b, "msgs"] += unr
    # pending = they spoke last (or unread with unknown last message), not archived
    if not archived and (last_me == 0 or (last_me is None and unr)):
        pend[b, age(ts)] += 1
        if b in ("conhecido", "spam provável"):
            waiting.append((ts or 0, b, name or jid.split("@")[0][-4:].rjust(8, "*"), unr, age(ts), saved, mine))

AGES = ["<7d", "7-30d", "30-90d", "90d-1a", ">1a", "sem data"]
print(f"{'':16}{'ativas':>8}{'arquiv.':>8}{'c/unread':>9}{'msgs unr':>9}")
for b in ("conhecido", "spam provável", "grupo", "canal"):
    print(f"{b:16}{stats[b,'ativa']:>8}{stats[b,'arquivada']:>8}{unread[b]:>9}{unread[b,'msgs']:>9}")
print("\nPendentes (falaram por último, não arquivadas), por idade:")
print(f"{'':16}" + "".join(f"{a:>9}" for a in AGES))
for b in ("conhecido", "spam provável", "grupo"):
    print(f"{b:16}" + "".join(f"{pend[b,a]:>9}" for a in AGES))
waiting.sort(reverse=True)
for b in ("conhecido", "spam provável"):
    print(f"\n{b} esperando (mais recentes primeiro, até 25):")
    for ts, bb, name, unr, a, saved, mine in [w for w in waiting if w[1] == b][:25]:
        flags = ("agenda " if saved else "") + (f"vc respondeu {mine}x" if mine else "")
        print(f"  {a:>7}  {unr or 0:>3} unr  {name[:34]:34} {flags}")
