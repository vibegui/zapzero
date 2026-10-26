"""Weekly cohorts over the synced window: incoming messages, how they were answered, what is still unread."""
import sqlite3, sys, json, time, datetime as dt
from collections import defaultdict
d = sys.argv[1]
db = sqlite3.connect(f"file:{d}/chat.sqlite?mode=ro", uri=True)
db.execute(f"attach 'file:{d}/contacts.sqlite?mode=ro' as c")
C = 978307200; now = time.time()
saved = {r[0] for r in db.execute("select ZWHATSAPPID from c.ZWAADDRESSBOOKCONTACT union select ZLID from c.ZWAADDRESSBOOKCONTACT")}
chats = {pk: (t, jid, name, unr or 0, arch or 0) for pk, t, jid, name, unr, arch in db.execute(
    "select Z_PK, ZSESSIONTYPE, ZCONTACTJID, ZPARTNERNAME, ZUNREADCOUNT, ZARCHIVED from ZWACHATSESSION where ZSESSIONTYPE in (0,1,4)")}
def cat(pk):
    t, jid, *_ = chats[pk]
    return "grupo" if t in (1, 4) else ("conhecido" if jid in saved else "desconhecido")
msgs = defaultdict(list)
for pk, me, ts in db.execute("select ZCHATSESSION, ZISFROMME, ZMESSAGEDATE + ? from ZWAMESSAGE where ZMESSAGETYPE in (0,1,2,3,4,5,7,8,15) and ZMESSAGEDATE + ? > ? order by ZMESSAGEDATE", (C, C, now - 92 * 86400)):
    if pk in chats: msgs[pk].append((ts, me))
week = lambda ts: (dt.date.fromtimestamp(ts) - dt.timedelta(days=dt.date.fromtimestamp(ts).weekday())).isoformat()
out = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
lag = defaultdict(lambda: defaultdict(list))
for pk, ms in msgs.items():
    k = cat(pk); unr = chats[pk][3]
    incoming = [i for i, (ts, me) in enumerate(ms) if not me]
    unread_idx = set(incoming[-unr:]) if unr else set()
    # A "thread start": an incoming message after Gui's last message (or the first one). Answered = Gui sends later.
    prev_me = True
    for i, (ts, me) in enumerate(ms):
        w = week(ts); o = out[k][w]
        if me: o["enviadas"] += 1; prev_me = True; continue
        o["recebidas"] += 1
        if i in unread_idx: o["nao_lidas"] += 1
        if prev_me:
            o["cobrancas"] += 1
            reply = next((t for t, m in ms[i:] if m), None)
            if reply is None: o["sem_resposta"] += 1
            else:
                h = (reply - ts) / 3600; lag[k][w].append(h)
                o["resp_24h"] += h <= 24; o["resp_7d"] += h <= 168
            prev_me = False
res = {k: {w: dict(v, mediana_h=sorted(lag[k][w])[len(lag[k][w]) // 2] if lag[k][w] else None) for w, v in sorted(ws.items())} for k, ws in out.items()}
json.dump(res, open(f"{d}/cohorts.json", "w"), indent=1)
for k in ("conhecido", "desconhecido", "grupo"):
    print(f"\n{k}: semana  receb  envia  cobr  24h%  7d%  semResp  mediana_h  naoLidas")
    for w, v in res.get(k, {}).items():
        c = v.get("cobrancas", 0) or 1
        print(f"  {w} {v.get('recebidas',0):6.0f} {v.get('enviadas',0):6.0f} {v.get('cobrancas',0):5.0f} {100*v.get('resp_24h',0)/c:5.0f} {100*v.get('resp_7d',0)/c:4.0f} {v.get('sem_resposta',0):7.0f} {v['mediana_h'] or 0:9.1f} {v.get('nao_lidas',0):8.0f}")
