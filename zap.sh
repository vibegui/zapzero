#!/bin/sh
# zap: reads the WhatsApp Mac app's local database (never writes to it) and serves the radar + cleanup pages.
set -eu
Z=$(cd "$(dirname "$0")" && pwd)
D=${ZAP_DATA:-"$HOME/Library/Application Support/zap"}
WA="$HOME/Library/Group Containers/group.net.whatsapp.WhatsApp.shared"
mkdir -p "$D" && chmod 700 "$D"

case ${1:-} in
  snapshot)  # read-only copies: the app's own files are never opened for writing
    sqlite3 "file:$WA/ChatStorage.sqlite?mode=ro" ".backup '$D/chat.sqlite'"
    sqlite3 "file:$WA/ContactsV2.sqlite?mode=ro" ".backup '$D/contacts.sqlite'" ;;
  overview) python3 -I "$Z/overview.py" "$D" ;;
  triage)    # Jev over every DM (~$0.00004 per chat)
    mkdir -p "$D/shards" && python3 -I "$Z/extract.py" "$D" 25
    cd "$Z" && bun jev_triage.ts "$D" $(cd "$D/shards" && ls) ;;
  groups) shift; python3 -I "$Z/groups.py" "$D" "$@" ;;
  topics) cd "$Z" && bun jev_topics.ts "$D" ;;
  build)
    python3 -I "$Z/cohorts.py" "$D"
    python3 -I "$Z/radar_data.py" "$D"
    python3 -I "$Z/limpeza.py" "$D"
    python3 -I "$Z/build.py" "$D" ;;
  serve) exec python3 -I "$Z/serve.py" "$D/site" ;;
  *) echo "uso: zap.sh snapshot | overview | triage | groups <dias> <grupo>... | topics | build | serve"; exit 1 ;;
esac
