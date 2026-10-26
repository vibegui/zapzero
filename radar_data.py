"""Collects everything the dashboard shows into one JSON (names included: local file only)."""
import sqlite3, sys, json, time
from collections import defaultdict
d = sys.argv[1]
db = sqlite3.connect(f"file:{d}/chat.sqlite?mode=ro", uri=True)
db.execute(f"attach 'file:{d}/contacts.sqlite?mode=ro' as c")
C = 978307200
saved = {r[0] for r in db.execute("select ZWHATSAPPID from c.ZWAADDRESSBOOKCONTACT union select ZLID from c.ZWAADDRESSBOOKCONTACT")}
rows = db.execute("""select s.Z_PK, s.ZSESSIONTYPE, s.ZCONTACTJID, s.ZPARTNERNAME, coalesce(s.ZUNREADCOUNT,0), coalesce(s.ZARCHIVED,0),
  coalesce(m.ZMESSAGEDATE, case when s.ZLASTMESSAGEDATE < 4000000000 then s.ZLASTMESSAGEDATE end), m.ZISFROMME
  from ZWACHATSESSION s left join ZWAMESSAGE m on m.Z_PK = s.ZLASTMESSAGE
  where s.ZSESSIONTYPE in (0,1,4) and coalesce(s.ZREMOVED,0) = 0""").fetchall()
cat = lambda t, jid: "grupo" if t in (1, 4) else ("conhecido" if jid in saved else "desconhecido")
months = defaultdict(lambda: defaultdict(int)); kpi = defaultdict(int); names = {}
for pk, t, jid, name, unr, arch, ts, me in rows:
    k = cat(t, jid); names[pk] = name or jid.split("@")[0]
    kpi[f"unread_{k}"] += max(unr, 0); kpi[f"chats_unread_{k}"] += unr > 0
    if arch or not ts: continue
    m = time.strftime("%Y-%m", time.localtime(ts + C))
    months[m][f"{k}_ativas"] += 1
    if me == 0 or (me is None and unr > 0): months[m][f"{k}_pendentes"] += 1
    if unr > 0: months[m][f"{k}_unread"] += unr
groups = [dict(nome=n, unread=u, semana=w) for n, u, w in db.execute("""select s.ZPARTNERNAME, coalesce(s.ZUNREADCOUNT,0),
  (select count(*) from ZWAMESSAGE m where m.ZCHATSESSION = s.Z_PK and m.ZISFROMME = 0 and m.ZMESSAGEDATE + ? > ?)
  from ZWACHATSESSION s where s.ZSESSIONTYPE in (1,4) and coalesce(s.ZARCHIVED,0) = 0 order by 3 desc limit 12""", (C, time.time() - 7 * 86400))]
triage = []
for line in open(f"{d}/triage-00-01.txt"):
    pk, categoria, resposta, urg, acao, motivo = line.rstrip("\n").split("|", 5)
    triage.append(dict(nome=names.get(int(pk), pk), categoria=categoria, resposta=resposta, urgencia=int(urg), acao=acao, motivo=motivo))
json.dump(dict(gerado=time.strftime("%Y-%m-%d %H:%M"), kpi=kpi, semanas=json.load(open(f"{d}/cohorts.json")),
  meses=dict(sorted(months.items())), grupos=groups, triagem=triage), open(f"{d}/dashboard.json", "w"), ensure_ascii=False)
print(dict(kpi))
