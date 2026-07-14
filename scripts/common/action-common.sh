#!/usr/bin/env bash
set -euo pipefail

# Dumb, single-purpose shell helpers sourced by the shell actions.
# Domain-specific helpers live in scripts/docker/common.sh and
# scripts/portainer/common.sh, which source this file for the shared ones.
# Stack-file loading and placeholder interpolation live in TypeScript — see
# Template/ScopedVariables in src/domain/models and the StackFileResolver in
# src/application/core, used by the Portainer deploy bundle.

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

common_fail() {
  echo "$1" >&2
  exit 1
}

common_require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    common_fail "Required command not found: $cmd"
  fi
}

# Returns 0 when the input string represents a true-like value.
common_is_true() {
  case "$(common_to_lower "${1:-}")" in
    true|1|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

# Prints the literal string true/false, for JSON payloads and CLI flags.
common_bool() {
  if common_is_true "${1:-}"; then
    printf '%s' "true"
  else
    printf '%s' "false"
  fi
}
