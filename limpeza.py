"""Archive candidates for the cleanup screen (names and previews included: local/tailnet only)."""
import sqlite3, sys, json, time
d = sys.argv[1]
db = sqlite3.connect(f"file:{d}/chat.sqlite?mode=ro", uri=True)
db.execute(f"attach 'file:{d}/contacts.sqlite?mode=ro' as c")
C = 978307200; now = time.time()
saved = {r[0] for r in db.execute("select ZWHATSAPPID from c.ZWAADDRESSBOOKCONTACT union select ZLID from c.ZWAADDRESSBOOKCONTACT")}
jev = {}
for line in open(f"{d}/jev-all.txt"):
    pk, cat, resp, urg, acao, p, espera = line.rstrip("\n").split("|")
    jev[int(pk)] = dict(cat=cat, resp=resp, acao=acao, p=float(p), espera=espera)
for line in open(f"{d}/triage-00-01.txt"):  # Haiku read these 50 closely: its verdict wins
    pk, cat, resp, urg, acao, motivo = line.rstrip("\n").split("|", 5)
    jev[int(pk)] = dict(jev.get(int(pk), {}), resp=resp, acao=acao, motivo=motivo)
TYPES = {7: "link", 1: "imagem", 2: "vídeo", 3: "áudio", 4: "contato", 5: "localização", 8: "documento", 15: "sticker"}
rows = db.execute("""select s.Z_PK, s.ZSESSIONTYPE, s.ZCONTACTJID, s.ZPARTNERNAME, coalesce(s.ZUNREADCOUNT,0),
  coalesce(m.ZMESSAGEDATE, case when s.ZLASTMESSAGEDATE < 4000000000 then s.ZLASTMESSAGEDATE end),
  m.ZISFROMME, m.ZTEXT, m.ZMESSAGETYPE, gm.ZCONTACTNAME,
  (select count(*) from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK and x.ZISFROMME = 1)
  from ZWACHATSESSION s left join ZWAMESSAGE m on m.Z_PK = coalesce((select x.Z_PK from ZWAMESSAGE x where x.ZCHATSESSION = s.Z_PK
    and x.ZMESSAGETYPE in (0,1,2,3,4,5,7,8,15) order by x.ZMESSAGEDATE desc limit 1), s.ZLASTMESSAGE) left join ZWAGROUPMEMBER gm on gm.Z_PK = m.ZGROUPMEMBER
  where s.ZSESSIONTYPE in (0,1,4) and coalesce(s.ZARCHIVED,0) = 0 and coalesce(s.ZREMOVED,0) = 0 and coalesce(s.ZHIDDEN,0) = 0
    and s.ZLASTMESSAGEDATE < 4000000000""").fetchall()  # pinned chats sit in the far future: never offered
out = []
for pk, t, jid, name, unread, ts, me, text, kind, sender, mine in rows:
    dias = int((now - ts - C) / 86400) if ts else 9999
    body = (text or "").replace("\n", " ").strip()[:140] or (f"[{TYPES[kind]}]" if kind in TYPES else "")
    who = "Você" if me else (sender or "")
    if not name or name.startswith("+"):  # unsaved number: the sender's own WhatsApp name says more
        push = db.execute("select ZPUSHNAME from ZWAMESSAGE where ZCHATSESSION = ? and ZISFROMME = 0 and ZPUSHNAME > '' order by ZMESSAGEDATE desc limit 1", (pk,)).fetchone()
        if push and not push[0].endswith("="): name = f"~{push[0]} · {name or jid.split('@')[0]}"
    item = dict(pk=pk, ultima=time.strftime('%Y-%m-%d', time.localtime(ts + C)) if ts else None, nome=name or jid.split("@")[0], dias=dias, unread=unread, mine=mine,
                preview=(f"{who}: {body}" if who else body) if body else "(o Mac não tem as mensagens: só sincronizou os últimos ~3 meses)")
    if t in (1, 4):
        if dias >= 90 and unread > 0: sec, on, why = "grupos-mortos", False, f"{unread} não lidas que o Mac não baixou: confira no celular"
        elif dias >= 90: sec, on, why = "grupos-mortos", True, ""
        elif dias >= 30: sec, on, why = "grupos-parados", mine == 0, "você não escreveu no período sincronizado" if mine == 0 else f"você escreveu {mine}x"
        else: continue
    else:
        j = jev.get(pk)
        if j is None:
            if dias < 90: continue
            sec, on, why = "dms-antigas", True, ""
        elif j["acao"] != "arquivar" or j["resp"] == "sim" or j.get("espera") == "eles_esperam": continue
        elif j.get("cat") in ("empresa", "servico"): sec, on, why = "empresas", True, "empresa ou mensagem automática"
        elif j.get("cat") == "desconhecido" and jid not in saved and mine == 0: sec, on, why = "desconhecidos", True, "fora da agenda, você nunca respondeu"
        else: sec, on, why = "encerradas", j.get("cat") != "pessoal", "conversa encerrada"
        if j and j.get("motivo"): why = j["motivo"]
    out.append(dict(item, secao=sec, marcado=on, motivo=why, tipo="grupo" if t in (1, 4) else "dm"))
out.sort(key=lambda x: (x["marcado"], -x["dias"] if x["tipo"] == "grupo" else x["dias"]))
json.dump(dict(gerado=time.strftime("%Y-%m-%d %H:%M"), itens=out), open(f"{d}/limpeza.json", "w"), ensure_ascii=False)
from collections import Counter
print(len(out), Counter((x["secao"], x["marcado"]) for x in out))
