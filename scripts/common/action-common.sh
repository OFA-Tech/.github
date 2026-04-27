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

common_to_env_key() {
  local value="${1:-}"
  value="${value//[^a-zA-Z0-9_]/_}"
  printf '%s' "${value^^}"
}

common_is_valid_var_name() {
  local value="${1:-}"
  [[ "$value" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]
}

common_resolve_placeholder_value() {
  local key="${1:-}"
  local default_value="${2:-}"

  local env_key
  env_key="$(common_to_env_key "$key")"

  # workflow_outputs scope
  local wf_output_exact="WF_OUTPUT_${key}"
  local wf_output_var="WF_OUTPUT_${env_key}"
  if common_is_valid_var_name "$wf_output_exact" && [[ -v "$wf_output_exact" && -n "${!wf_output_exact}" ]]; then
    printf '%s' "${!wf_output_exact}"
    return 0
  fi
  if [[ -v "$wf_output_var" && -n "${!wf_output_var}" ]]; then
    printf '%s' "${!wf_output_var}"
    return 0
  fi

  # action_outputs scope
  local action_output_exact="ACTION_OUTPUT_${key}"
  local action_output_var="ACTION_OUTPUT_${env_key}"
  if common_is_valid_var_name "$action_output_exact" && [[ -v "$action_output_exact" && -n "${!action_output_exact}" ]]; then
    printf '%s' "${!action_output_exact}"
    return 0
  fi
  if [[ -v "$action_output_var" && -n "${!action_output_var}" ]]; then
    printf '%s' "${!action_output_var}"
    return 0
  fi

  # secrets scope
  local secret_exact="SECRET_${key}"
  local secret_var="SECRET_${env_key}"
  if common_is_valid_var_name "$secret_exact" && [[ -v "$secret_exact" && -n "${!secret_exact}" ]]; then
    printf '%s' "${!secret_exact}"
    return 0
  fi
  if [[ -v "$secret_var" && -n "${!secret_var}" ]]; then
    printf '%s' "${!secret_var}"
    return 0
  fi

  # env scope
  if common_is_valid_var_name "$key" && [[ -v "$key" && -n "${!key}" ]]; then
    printf '%s' "${!key}"
    return 0
  fi

  local env_exact="ENV_${key}"
  local env_scoped_var="ENV_${env_key}"
  if common_is_valid_var_name "$env_exact" && [[ -v "$env_exact" && -n "${!env_exact}" ]]; then
    printf '%s' "${!env_exact}"
    return 0
  fi
  if [[ -v "$env_scoped_var" && -n "${!env_scoped_var}" ]]; then
    printf '%s' "${!env_scoped_var}"
    return 0
  fi

  # vars scope
  local vars_exact="VAR_${key}"
  local vars_scoped_var="VAR_${env_key}"
  if common_is_valid_var_name "$vars_exact" && [[ -v "$vars_exact" && -n "${!vars_exact}" ]]; then
    printf '%s' "${!vars_exact}"
    return 0
  fi
  if [[ -v "$vars_scoped_var" && -n "${!vars_scoped_var}" ]]; then
    printf '%s' "${!vars_scoped_var}"
    return 0
  fi

  printf '%s' "$default_value"
}

common_resolve_content_or_file() {
  local content="${1:-}"
  local file_path="${2:-}"

  local resolved_content="$content"
  if [[ -z "$resolved_content" && -n "$file_path" ]]; then
    resolved_content="$(common_read_file_content "$file_path")"
  fi

  if [[ -z "$resolved_content" ]]; then
    echo "Either content or file path is required" >&2
    return 1
  fi

  common_interpolate_vars "$resolved_content"
}

common_interpolate_vars() {
  local content="${1:-}"

  if [[ -z "$content" ]]; then
    echo "Content is required" >&2
    return 1
  fi

  local temp_result="$content"
  while [[ "$temp_result" =~ \$\{([^}]+)\} ]]; do
    local full_match="${BASH_REMATCH[0]}"
    local var_spec="${BASH_REMATCH[1]}"
    
    local var_name=""
    local default_value=""
    
    # Parse var_spec: either "VAR" or "VAR:-default"
    if [[ "$var_spec" =~ ^([^:]+):-(.*)$ ]]; then
      var_name="${BASH_REMATCH[1]}"
      default_value="${BASH_REMATCH[2]}"
    else
      var_name="$var_spec"
      default_value=""
    fi
    
    local replacement_value=""
    replacement_value="$(common_resolve_placeholder_value "$var_name" "$default_value")"

    temp_result="${temp_result//"$full_match"/"$replacement_value"}"
  done

  printf '%s' "$temp_result"
}
