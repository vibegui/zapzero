"""Fills the page templates in web/ with the data dir's JSON and writes them to <data>/site."""
import sys, json, os
web = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
d = sys.argv[1]
read = lambda p: open(p).read()
radar = (read(f"{web}/radar.html").replace("__DATA__", read(f"{d}/dashboard.json"))
  .replace("__ANALYSIS__", json.dumps(read(f"{d}/analysis.html") if os.path.exists(f"{d}/analysis.html") else ""))
  .replace("__TOPICS__", read(f"{d}/digests/all.json") if os.path.exists(f"{d}/digests/all.json") else "[]"))
os.makedirs(f"{d}/site", exist_ok=True)
open(f"{d}/site/index.html", "w").write(radar)
open(f"{d}/site/limpeza.html", "w").write(read(f"{web}/limpeza.html").replace("__DATA__", read(f"{d}/limpeza.json")))
