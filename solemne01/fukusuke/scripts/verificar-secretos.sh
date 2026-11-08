#!/usr/bin/env bash
# Verifica que ningún VALOR de secreto aparezca en el código, el frontend, los tests o los logs.
cd "$(dirname "$0")/.."
hallazgos=0
for f in secrets/*; do
  [ -f "$f" ] || continue
  v=$(head -c 40 "$f" | head -1)
  [ ${#v} -lt 12 ] && continue
  n=$(grep -rIl --exclude-dir=secrets --exclude-dir=node_modules -F -- "$v" . 2>/dev/null | wc -l)
  if [ "$n" -gt 0 ]; then echo "ENCONTRADO: $(basename "$f") en $n archivo(s)"; hallazgos=$((hallazgos+n)); fi
done
echo "Secretos revisados: $(ls secrets | wc -l) · archivos con valores expuestos: $hallazgos"
[ "$hallazgos" -eq 0 ]
