#!/usr/bin/env bash
set -euo pipefail

# Dumb, single-purpose docker helpers sourced by the shell actions.
# Shared helpers (common_is_true, common_require_cmd, ...) come from
# scripts/common/action-common.sh, sourced below.
# Metadata resolution (account/repository fallbacks, branch-based version
# bumping, Docker Hub tag collision checks) lives in TypeScript — see
# src/application/docker and the actions/docker/metadata bundle.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../common/action-common.sh"

docker_resolve_username() {
  local input_username="${1:-}"
  local secret_username="${2:-}"
  local env_username="${3:-}"
  local actor_username="${4:-}"

  local resolved="$input_username"
  if [ -z "$resolved" ]; then
    resolved="$secret_username"
  fi
  if [ -z "$resolved" ]; then
    resolved="$env_username"
  fi
  if [ -z "$resolved" ]; then
    resolved="$actor_username"
  fi

  echo "$resolved"
}

docker_verify_hub_repository_access() {
  local account="$1"
  local image_name="$2"
  local username="$3"
  local password="$4"

  if [ -z "$account" ] || [ -z "$image_name" ]; then
    common_fail "Docker Hub repository preflight requires account and image name."
  fi

  if [ -z "$username" ] || [ -z "$password" ]; then
    common_fail "Docker Hub repository preflight requires username and token/password."
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "Skipping Docker Hub repository preflight because curl is not installed." >&2
    return 0
  fi

  if ! curl --silent --show-error --fail --location --user "$username:$password" \
    "https://hub.docker.com/v2/repositories/$account/$image_name/" >/dev/null 2>&1; then
    echo "Unable to access Docker Hub repository '$account/$image_name' with the provided credentials." >&2
    common_fail "Ensure the repository exists and that user '$username' has push permission."
  fi
}

docker_login() {
  local registry="$1"
  local username="$2"
  local password="$3"

  if [ -z "$password" ]; then
    common_fail "docker_login called with an empty password/token."
  fi

  if [ -z "$username" ]; then
    common_fail "docker_login could not resolve a username. Set docker username via input, secret, or DOCKER_USERNAME variable."
  fi

  printf '%s' "$password" | docker login "$registry" -u "$username" --password-stdin
}

docker_swarm_require_active() {
  if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -qi '^active$'; then
    common_fail "Docker Swarm is not active on this runner."
  fi
}

# Append `<flag> <line>` to the named array for every non-empty line of the
# newline-separated input. Uses a nameref (bash 4.3+; GitHub runners ship 5.x).
docker_append_lines() {
  local -n __docker_target="$1"
  local flag="$2"
  local lines="${3:-}"
  local line
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      __docker_target+=("$flag" "$line")
    fi
  done <<< "$lines"
}

# Run the named command array, appending raw extra options via eval when
# provided. Stdout passes through so callers can capture command output.
docker_exec_with_extra() {
  local -n __docker_cmd="$1"
  local extra="${2:-}"
  if [ -n "$extra" ]; then
    local cmd_string=""
    printf -v cmd_string '%q ' "${__docker_cmd[@]}"
    eval "$cmd_string $extra"
  else
    "${__docker_cmd[@]}"
  fi
}
