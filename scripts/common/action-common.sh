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

common_interpolate_vars() {
  local content="${1:-}"
  local vars_json="${2:-}"

  if [[ -z "$content" ]]; then
    echo "Content is required" >&2
    return 1
  fi

  # If no vars_json provided, use environment variables only
  local result="$content"
  
  # Find all variable patterns: ${VAR} and ${VAR:-default}
  # Process them using sed and parameter expansion
  local var_pattern='\$\{([^}]+)\}'
  
  # Use a temporary file to process all variables
  local temp_result="$result"
  
  # Extract all variable names and defaults
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
    
    # Precedence: JSON map value -> environment variable -> default from :- -> empty string
    if [[ -n "$vars_json" ]]; then
      # Try to get value from JSON map
      replacement_value="$(echo "$vars_json" | jq -r ".\"$var_name\" // \"\"" 2>/dev/null || echo "")"
    fi
    
    if [[ -z "$replacement_value" ]]; then
      # Try to get from environment variable
      if [[ -v "$var_name" ]]; then
        replacement_value="${!var_name}"
      elif [[ -n "$default_value" ]]; then
        replacement_value="$default_value"
      fi
    fi
    
    # Escape special characters for sed replacement
    replacement_value="$(printf '%s\n' "$replacement_value" | sed -e 's/[\/&]/\\&/g')"
    
    # Replace the variable in the content
    temp_result="${temp_result//"$full_match"/"$replacement_value"}"
  done
  
  printf '%s' "$temp_result"
}
