/**
 * Type-safe accessors for GitHub Action inputs.
 *
 * `@actions/core` only returns strings; these helpers add typed coercion and
 * validation so action entrypoints can declare their input contract once and
 * fail fast with an {@link InvalidInputError} on bad data.
 */
import * as core from "@actions/core";
import { InvalidInputError } from "../../domain/shared-utils/errors";

const TRUTHY = new Set(["true", "1", "yes", "y", "on"]);
const FALSY = new Set(["false", "0", "no", "n", "off", ""]);

/** Read a string input, trimming surrounding whitespace. */
export function getString(name: string, fallback = ""): string {
  const value = core.getInput(name);
  return value === "" ? fallback : value;
}

/** Read a required string input; throw {@link InvalidInputError} when empty. */
export function getRequired(name: string): string {
  const value = core.getInput(name, { required: false }).trim();
  if (value === "") {
    throw new InvalidInputError(`Input '${name}' is required`);
  }
  return value;
}

/** Read a boolean input, accepting the common true/false spellings. */
export function getBoolean(name: string, fallback = false): boolean {
  const raw = core.getInput(name).trim().toLowerCase();
  if (raw === "") {
    return fallback;
  }
  if (TRUTHY.has(raw)) {
    return true;
  }
  if (FALSY.has(raw)) {
    return false;
  }
  throw new InvalidInputError(
    `Input '${name}' must be a boolean, received '${raw}'`,
  );
}

/** Read an input constrained to a fixed set of allowed values. */
export function getEnum<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback?: T,
): T {
  const raw = core.getInput(name).trim();
  if (raw === "" && fallback !== undefined) {
    return fallback;
  }
  if (!allowed.includes(raw as T)) {
    throw new InvalidInputError(
      `Input '${name}' must be one of ${allowed.join(", ")}, received '${raw}'`,
      { allowed, received: raw },
    );
  }
  return raw as T;
}
