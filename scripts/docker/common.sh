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

docker_to_lower() {
  local value="${1:-}"
  printf '%s' "${value,,}"
}

docker_trim_slashes() {
  local value="${1:-}"
  value="${value#/}"
  value="${value%/}"
  printf '%s' "$value"
}

docker_repo_basename() {
  local repo="${GITHUB_REPOSITORY:-}"
  repo="${repo##*/}"
  printf '%s' "${repo,,}"
}

docker_validate_repo_component() {
  local component="$1"
  local label="$2"

  if [ -z "$component" ]; then
    echo "Resolved $label is empty." >&2
    exit 1
  fi

  if [[ "$component" == */* ]]; then
    echo "Resolved $label '$component' must not contain '/'." >&2
    exit 1
  fi

  if [[ ! "$component" =~ ^[a-z0-9]+([._-][a-z0-9]+)*$ ]]; then
    echo "Resolved $label '$component' is invalid. Allowed: lowercase letters, numbers, '.', '_' and '-'." >&2
    exit 1
  fi
}

docker_normalize_component() {
  local value="${1:-}"
  value="$(docker_trim_slashes "$value")"
  printf '%s' "${value,,}"
}

docker_first_non_empty() {
  local value
  for value in "$@"; do
    if [ -n "${value:-}" ]; then
      printf '%s' "$value"
      return 0
    fi
  done
  printf '%s' ""
}

docker_detect_source_branch() {
  if [ -n "${GITHUB_HEAD_REF:-}" ]; then
    printf '%s' "$GITHUB_HEAD_REF"
    return 0
  fi

  if [ -n "${GITHUB_EVENT_PATH:-}" ] && [ -f "${GITHUB_EVENT_PATH}" ]; then
    if command -v jq >/dev/null 2>&1; then
      local jq_branch
      jq_branch="$(jq -r '.pull_request.head.ref // .head_ref // empty' "$GITHUB_EVENT_PATH" 2>/dev/null || true)"
      if [ -n "$jq_branch" ] && [ "$jq_branch" != "null" ]; then
        printf '%s' "$jq_branch"
        return 0
      fi
    fi

    local raw_event
    raw_event="$(tr -d '\n\r' < "$GITHUB_EVENT_PATH")"
    local parsed_branch
    parsed_branch="$(printf '%s' "$raw_event" | sed -nE 's/.*"pull_request"[[:space:]]*:[[:space:]]*\{.*"head"[[:space:]]*:[[:space:]]*\{.*"ref"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p')"
    if [ -z "$parsed_branch" ]; then
      parsed_branch="$(printf '%s' "$raw_event" | sed -nE 's/.*"head_ref"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p')"
    fi
    if [ -n "$parsed_branch" ]; then
      printf '%s' "$parsed_branch"
      return 0
    fi
  fi

  local commit_subject
  commit_subject="$(git log -1 --pretty=%s 2>/dev/null || true)"
  if [ -n "$commit_subject" ]; then
    local parsed_from_subject
    parsed_from_subject="$(printf '%s' "$commit_subject" | sed -nE 's/.* from [^/]+\/(.+)$/\1/p')"
    if [ -n "$parsed_from_subject" ]; then
      printf '%s' "$parsed_from_subject"
      return 0
    fi
  fi

  printf '%s' ""
}

docker_resolve_environment() {
  local requested_environment="$(docker_to_lower "${1:-}")"
  if [ -n "$requested_environment" ]; then
    printf '%s' "$requested_environment"
    return 0
  fi

  local ref_name
  ref_name="$(docker_to_lower "${GITHUB_REF_NAME:-}")"
  case "$ref_name" in
    development|develop|dev) printf '%s' "development" ;;
    staging|stage|stg) printf '%s' "staging" ;;
    *) printf '%s' "production" ;;
  esac
}

docker_env_prefix() {
  local environment="$(docker_to_lower "${1:-production}")"
  case "$environment" in
    development|dev) printf '%s' "dev-" ;;
    staging|stage|stg) printf '%s' "stg-" ;;
    production|prod|"") printf '%s' "" ;;
    *)
      echo "Unsupported docker environment '$environment'. Use development, staging or production." >&2
      exit 1
      ;;
  esac
}

docker_fetch_latest_semver() {
  local account="$1"
  local image_name="$2"
  local username="$3"
  local password="$4"

  local latest_major=0
  local latest_minor=0
  local latest_point=0
  local max_point=0

  if [ -z "$username" ] || [ -z "$password" ] || ! command -v curl >/dev/null 2>&1; then
    printf '%s|%s|%s\n' "$latest_major" "$latest_minor" "$max_point"
    return 0
  fi

  local response
  response="$(curl --silent --show-error --fail --location --user "$username:$password" "https://hub.docker.com/v2/repositories/$account/$image_name/tags?page_size=100" 2>/dev/null || true)"

  if [ -z "$response" ]; then
    printf '%s|%s|%s\n' "$latest_major" "$latest_minor" "$max_point"
    return 0
  fi

  local tags
  tags="$(printf '%s' "$response" | grep -oE '"name"[[:space:]]*:[[:space:]]*"[^"]+"' | sed -E 's/"name"[[:space:]]*:[[:space:]]*"([^"]+)"/\1/' || true)"

  local tag
  while IFS= read -r tag; do
    [ -z "$tag" ] && continue

    if [[ "$tag" =~ ^(dev-|stg-)?([0-9]+)\.([0-9]+)\.([0-9]+)-([0-9]{8})$ ]]; then
      local major="${BASH_REMATCH[2]}"
      local minor="${BASH_REMATCH[3]}"
      local point="${BASH_REMATCH[4]}"

      if (( major > latest_major )) ||
         (( major == latest_major && minor > latest_minor )) ||
         (( major == latest_major && minor == latest_minor && point > latest_point )); then
        latest_major="$major"
        latest_minor="$minor"
        latest_point="$point"
      fi

      if (( point > max_point )); then
        max_point="$point"
      fi
    fi
  done <<< "$tags"

  printf '%s|%s|%s\n' "$latest_major" "$latest_minor" "$max_point"
}

docker_tag_exists_remote() {
  local image_repo="$1"
  local tag="$2"

  if docker manifest inspect "${image_repo}:${tag}" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

docker_tag_exists_dockerhub() {
  local account="$1"
  local image_name="$2"
  local tag="$3"
  local username="$4"
  local password="$5"

  if [ -z "$username" ] || [ -z "$password" ] || ! command -v curl >/dev/null 2>&1; then
    return 1
  fi

  if curl --silent --show-error --fail --location --user "$username:$password" \
    "https://hub.docker.com/v2/repositories/$account/$image_name/tags/$tag/" >/dev/null 2>&1; then
    return 0
  fi

  return 1
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
  local account_override="${4:-}"
  local image_name_override="${5:-}"
  local requested_environment="${6:-}"
  local auth_username="${7:-}"
  local auth_password="${8:-}"
  local account_from_secret="${9:-}"
  local image_name_from_secret="${10:-}"
  local account_from_env="${11:-}"
  local image_name_from_env="${12:-}"

  local normalized_registry
  normalized_registry="$(docker_to_lower "$registry")"

  local resolved_account
  resolved_account="$(docker_first_non_empty "$account_override" "$account_from_secret" "$account_from_env" "ofa-tech")"
  resolved_account="$(docker_normalize_component "$resolved_account")"
  docker_validate_repo_component "$resolved_account" "Docker account"

  local resolved_image_name
  resolved_image_name="$(docker_first_non_empty "$image_name_override" "$image_name_from_secret" "$image_name_from_env" "$(docker_repo_basename)")"
  resolved_image_name="$(docker_normalize_component "$resolved_image_name")"
  docker_validate_repo_component "$resolved_image_name" "Docker image name"

  local default_image
  if [ -z "$normalized_registry" ] || [ "$normalized_registry" = "docker.io" ]; then
    default_image="$resolved_account/$resolved_image_name"
  else
    default_image="$normalized_registry/$resolved_account/$resolved_image_name"
  fi

  local resolved_image="$image_override"
  if [ -n "$resolved_image" ] && [[ "$resolved_image" != */* ]]; then
    resolved_image="$default_image"
  fi
  if [ -z "$resolved_image" ]; then
    resolved_image="$default_image"
  fi
  resolved_image="$(docker_trim_slashes "$resolved_image")"

  local resolved_version="$version_override"
  if [ -z "$resolved_version" ]; then
    local environment
    environment="$(docker_resolve_environment "$requested_environment")"

    local prefix
    prefix="$(docker_env_prefix "$environment")"

    local source_branch
    source_branch="$(docker_detect_source_branch)"
    source_branch="$(docker_to_lower "$source_branch")"

    local latest_triplet
    latest_triplet="$(docker_fetch_latest_semver "$resolved_account" "$resolved_image_name" "$auth_username" "$auth_password")"

    local current_major
    local current_minor
    local current_point
    IFS='|' read -r current_major current_minor current_point <<< "$latest_triplet"

    local next_major="$current_major"
    local next_minor="$current_minor"
    local next_point="$((current_point + 1))"

    case "$source_branch" in
      feature/*|feat/*)
        next_major="$((current_major + 1))"
        next_minor=0
        ;;
      fix/*|hotfix/*)
        next_minor="$((current_minor + 1))"
        ;;
      *)
        ;;
    esac

    local build_date
    build_date="$(date -u +'%Y%m%d')"

    resolved_version="${prefix}${next_major}.${next_minor}.${next_point}-${build_date}"

    while docker_tag_exists_dockerhub "$resolved_account" "$resolved_image_name" "$resolved_version" "$auth_username" "$auth_password" ||
      docker_tag_exists_remote "$resolved_image" "$resolved_version"; do
      next_point="$((next_point + 1))"
      resolved_version="${prefix}${next_major}.${next_minor}.${next_point}-${build_date}"
    done
  fi

  local image_version_tag="${resolved_image}:${resolved_version}"
  local image_latest_tag="${resolved_image}:latest"

  {
    echo "registry=$normalized_registry"
    echo "account=$resolved_account"
    echo "image-name=$resolved_image_name"
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
    echo "docker_login could not resolve a username. Set docker username via input, secret, or DOCKER_USERNAME variable." >&2
    exit 1
  fi

  printf '%s' "$password" | docker login "$registry" -u "$username" --password-stdin
}
