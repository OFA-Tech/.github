/** Key-normalization helpers for environment-style variable names. */

const VALID_VAR_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** True when `name` is a valid environment variable identifier. */
export function isValidVariableName(name: string): boolean {
  return VALID_VAR_NAME.test(name);
}

/** Normalize a key to an uppercased env-safe identifier (`a-b.c` -> `A_B_C`). */
export function toEnvKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
}
