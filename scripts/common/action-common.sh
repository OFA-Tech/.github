#!/usr/bin/env bash
set -euo pipefail

common_to_lower() {
  local value="${1:-}"
  printf '%s' "$value" | tr '[:upper:]' '[:lower:]'
}

common_write_output() {
  local key="$1"
  local value="${2:-}"
  echo "$key=$value" >> "$GITHUB_OUTPUT"
}

common_eval_command() {
  local command="$1"
  eval "$command"
}

common_read_file_content() {
  local file_path="${1:-}"

  if [[ -z "$file_path" ]]; then
    echo "File path is required" >&2
    return 1
  fi

  if [[ "$file_path" != /* ]]; then
    file_path="$GITHUB_WORKSPACE/$file_path"
  fi

  if [[ ! -f "$file_path" ]]; then
    echo "File not found: $file_path" >&2
    return 1
  fi

  cat "$file_path"
}

common_resolve_content_or_file() {
  local content="${1:-}"
  local file_path="${2:-}"

  if [[ -n "$content" ]]; then
    printf '%s' "$content"
    return 0
  fi

  if [[ -n "$file_path" ]]; then
    common_read_file_content "$file_path"
    return 0
  fi

  echo "Either content or file path must be provided" >&2
  return 1
}
