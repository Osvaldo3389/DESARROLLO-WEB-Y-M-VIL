#!/usr/bin/env bash
# Carga los secretos de ./secrets en Vault (kv v2: secret/fukusuke/<ref>) y crea un AppRole por servicio
# con una política que SOLO permite leer sus propias referencias. Requiere el contenedor vault en marcha.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f secrets/vault-root-token ] || head -c 24 /dev/urandom | base64 | tr -d '/+=' > secrets/vault-root-token
V="docker compose -f docker-compose.yml -f docker-compose.vault.yml exec -T -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=$(cat secrets/vault-root-token) vault vault"
declare -A REFS=(
  [auth]="auth-jwt-private-key gw-auth-token clients-auth-token db-auth"
  [inventory]="gw-inventory-token orders-inventory-token gql-inventory-read db-inventory"
  [orders]="gw-orders-token payments-orders-token gql-orders-read orders-inventory-token orders-clients-token analytics-ingest-token db-orders"
  [clients]="gw-clients-token orders-clients-token payments-clients-token clients-auth-token mail-api-key-clients rut-encryption-key db-clients"
  [payments]="gw-payments-token gql-payments-read payments-orders-token payments-clients-token servipag-api-key servipag-webhook-secret mail-api-key-payments db-payments"
  [analytics]="gw-analytics-token analytics-ingest-token db-analytics"
  [graphql]="gw-graphql-token gql-orders-read gql-inventory-read gql-payments-read"
  [gateway]="gw-auth-token gw-inventory-token gw-orders-token gw-clients-token gw-payments-token gw-analytics-token gw-graphql-token servipag-webhook-secret tls-gateway-cert tls-gateway-key"
)
for f in secrets/*; do
  [ -f "$f" ] || continue
  ref=$(basename "$f"); [[ $ref == seed-* || $ref == vault-root-token || $ref == db-root ]] && continue
  $V kv put "secret/fukusuke/$ref" value="$(cat "$f")" >/dev/null
done
$V auth enable approle >/dev/null 2>&1 || true
mkdir -p secrets/vault
for s in "${!REFS[@]}"; do
  pol=""
  for r in ${REFS[$s]}; do pol+="path \"secret/data/fukusuke/$r\" { capabilities = [\"read\"] }"$'\n'; done
  echo "$pol" | $V policy write "fk-$s" - >/dev/null
  $V write "auth/approle/role/$s" token_policies="fk-$s" token_ttl=1h secret_id_ttl=24h >/dev/null
  $V read -field=role_id "auth/approle/role/$s/role-id" > "secrets/vault/$s-role-id"
  $V write -f -field=secret_id "auth/approle/role/$s/secret-id" > "secrets/vault/$s-secret-id"
  echo "AppRole fk-$s listo (${REFS[$s]// /, })"
done
