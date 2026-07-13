#!/usr/bin/env bash
set -euo pipefail

# Dumb, single-purpose docker helpers sourced by the shell actions.
# Metadata resolution (account/repository fallbacks, branch-based version
# bumping, Docker Hub tag collision checks) lives in TypeScript — see
# src/application/docker and the actions/docker/metadata bundle.

# Returns 0 when the input string represents a true-like value.
docker_is_true() {
  local value="${1:-}"
  case "${value,,}" in
    true|1|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

docker_require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
}

docker_to_lower() {
  local value="${1:-}"
  printf '%s' "${value,,}"
}

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
    echo "Docker Hub repository preflight requires account and image name." >&2
    exit 1
  fi

  if [ -z "$username" ] || [ -z "$password" ]; then
    echo "Docker Hub repository preflight requires username and token/password." >&2
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "Skipping Docker Hub repository preflight because curl is not installed." >&2
    return 0
  fi

  if ! curl --silent --show-error --fail --location --user "$username:$password" \
    "https://hub.docker.com/v2/repositories/$account/$image_name/" >/dev/null 2>&1; then
    echo "Unable to access Docker Hub repository '$account/$image_name' with the provided credentials." >&2
    echo "Ensure the repository exists and that user '$username' has push permission." >&2
    exit 1
  fi
}

docker_login() {
  local registry="$1"
  local username="$2"
  local password="$3"

  if [ -z "$password" ]; then
    echo "docker_login called with an empty password/token." >&2
    exit 1
  fi

  if [ -z "$username" ]; then
    echo "docker_login could not resolve a username. Set docker username via input, secret, or DOCKER_USERNAME variable." >&2
    exit 1
  fi

  printf '%s' "$password" | docker login "$registry" -u "$username" --password-stdin
}
