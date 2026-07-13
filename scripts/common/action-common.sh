#!/usr/bin/env bash
set -euo pipefail

# Dumb, single-purpose shell helpers sourced by the shell actions.
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
