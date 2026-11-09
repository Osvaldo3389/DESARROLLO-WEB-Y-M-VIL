#!/usr/bin/env bash
# Muestrea cada 2 s el % de CPU (delta de tiempo de CPU en /proc) y la memoria RSS de cada servicio.
cd "$(dirname "$0")/../.."
out=${1:-tests/resultados/recursos.csv}
hz=$(getconf CLK_TCK)
echo "ts,servicio,cpu,rss_mb" > "$out"
declare -A prev
while [ -f .run/muestreo.on ]; do
  for f in .run/pids/*.pid; do
    n=$(basename "$f" .pid); p=$(cat "$f")
    [ -r /proc/$p/stat ] || continue
    t=$(awk '{print $14+$15}' /proc/$p/stat); rss=$(awk '/VmRSS/{print $2}' /proc/$p/status)
    if [ -n "${prev[$n]:-}" ]; then
      awk -v a="$t" -v b="${prev[$n]}" -v hz="$hz" -v n="$n" -v r="$rss" -v ts="$(date +%s)" 'BEGIN{printf "%s,%s,%.1f,%.1f\n", ts, n, (a-b)/hz/2*100, r/1024}' >> "$out"
    fi
    prev[$n]=$t
  done
  sleep 2
done
