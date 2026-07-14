/**
 * Value object owning the variable-scope precedence rules for stack-file
 * interpolation.
 *
 * A placeholder name is resolved against a fixed precedence of scopes injected
 * by the calling workflow (highest first):
 *
 *   1. workflow_outputs  — `WF_OUTPUT_<NAME>`
 *   2. action_outputs    — `ACTION_OUTPUT_<NAME>`
 *   3. secrets           — `SECRET_<NAME>`
 *   4. env (bare)        — `<NAME>`
 *   5. env (scoped)      — `ENV_<NAME>`
 *   6. vars              — `VAR_<NAME>`
 *
 * The source is plain data (usually a snapshot of `process.env`), so this
 * stays pure and unit-testable.
 */
import { isValidVariableName, toEnvKey } from "../shared-utils/env-key";

/** Plain key/value data the scopes are read from. */
export type VariableSource = Record<string, string | undefined>;

export class ScopedVariables {
  constructor(private readonly source: VariableSource) {}

  /** Resolve a placeholder name across all scopes; `fallback` when nothing matches. */
  resolve(name: string, fallback: string): string {
    const scoped =
      this.readScope("WF_OUTPUT_", name) ??
      this.readScope("ACTION_OUTPUT_", name) ??
      this.readScope("SECRET_", name);
    if (scoped !== undefined) {
      return scoped;
    }

    // bare env name
    if (isValidVariableName(name) && this.source[name]) {
      return this.source[name] as string;
    }

    const envScoped = this.readScope("ENV_", name);
    if (envScoped !== undefined) {
      return envScoped;
    }

    const varsScoped = this.readScope("VAR_", name);
    if (varsScoped !== undefined) {
      return varsScoped;
    }

    return fallback;
  }

  private readScope(prefix: string, key: string): string | undefined {
    const exact = `${prefix}${key}`;
    if (isValidVariableName(exact) && this.source[exact]) {
      return this.source[exact];
    }
    const scoped = `${prefix}${toEnvKey(key)}`;
    if (this.source[scoped]) {
      return this.source[scoped];
    }
    return undefined;
  }
}
