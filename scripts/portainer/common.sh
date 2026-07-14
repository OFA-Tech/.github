#!/usr/bin/env bash
set -euo pipefail

# Dumb, single-purpose Portainer API helpers sourced by the curl-based shell
# actions (scale, stack-file, stack-inspect, status).
# Shared helpers (common_fail, common_require_cmd, common_bool, ...) come from
# scripts/common/action-common.sh, sourced below.
# Deploy/update, rollback, and stack-exists logic lives in TypeScript — see
# src/application/portainer and the bundles under dist/.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../common/action-common.sh"

# Strip trailing slashes; they break path concatenation against the API.
portainer_normalize_url() {
  local url="${1:-}"
  printf '%s' "${url%/}"
}

# GET an API path. The X-API-Key header is only sent when a key is provided
# (the /api/system/status endpoint is unauthenticated).
portainer_api_get() {
  local base_url="$1"
  local api_key="$2"
  local path="$3"
  if [ -n "$api_key" ]; then
    curl -fsSL -H "X-API-Key: ${api_key}" "${base_url}${path}"
  else
    curl -fsSL "${base_url}${path}"
  fi
}

# PUT a JSON payload to an API path.
portainer_api_put() {
  local base_url="$1"
  local api_key="$2"
  local path="$3"
  local payload="$4"
  curl -fsSL -X PUT \
    -H "X-API-Key: ${api_key}" \
    -H "Content-Type: application/json" \
    --data "$payload" \
    "${base_url}${path}"
}

# Derive swarm|standalone|unknown from a stack JSON payload — the shell
# counterpart of resolveStackType in the TypeScript stack mapper.
portainer_resolve_stack_type() {
  local stack_json="$1"
  local type_value
  local swarm_id

  type_value="$(jq -r '.Type // empty' <<<"$stack_json")"
  swarm_id="$(jq -r '.SwarmID // empty' <<<"$stack_json")"

  if [ -n "$swarm_id" ] || [ "$type_value" = "1" ]; then
    printf '%s' "swarm"
    return
  fi

  if [ "$type_value" = "2" ]; then
    printf '%s' "standalone"
    return
  fi

  printf '%s' "unknown"
}
