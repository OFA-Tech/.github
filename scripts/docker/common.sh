#!/usr/bin/env bash
set -euo pipefail

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

docker_resolve_metadata() {
  local registry="$1"
  local image_override="$2"
  local version_override="$3"

  local default_image
  default_image="$registry/${GITHUB_REPOSITORY,,}"

  local resolved_image="$image_override"
  if [ -z "$resolved_image" ]; then
    resolved_image="$default_image"
  fi

  local resolved_version="$version_override"
  if [ -z "$resolved_version" ]; then
    local stamp
    local short_sha
    stamp="$(date -u +'%Y%m%d%H%M%S')"
    short_sha="${GITHUB_SHA::7}"
    resolved_version="v${stamp}-${short_sha}"
  fi

  local image_version_tag="${resolved_image}:${resolved_version}"
  local image_latest_tag="${resolved_image}:latest"

  {
    echo "image=$resolved_image"
    echo "version=$resolved_version"
    echo "image-version-tag=$image_version_tag"
    echo "image-latest-tag=$image_latest_tag"
  } >> "$GITHUB_OUTPUT"
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
    echo "docker_login could not resolve a username." >&2
    exit 1
  fi

  printf '%s' "$password" | docker login "$registry" -u "$username" --password-stdin
}
