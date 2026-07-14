/**
 * Value object for the environment variables attached to a stack deployment.
 *
 * Distinguishes "no environment supplied" (leave the stack's env untouched on
 * update) from "an explicit, possibly empty, set of variables".
 */
import { InvalidInputError } from "../shared-utils/errors";

/** Environment variable entry accepted by Portainer stack endpoints. */
export interface StackEnvVar {
  name: string;
  value: string;
}

export class StackEnvironment {
  private constructor(private readonly vars?: StackEnvVar[]) {}

  static none(): StackEnvironment {
    return new StackEnvironment(undefined);
  }

  /** Parse the optional `env-json` action input. Empty input means "none". */
  static fromJson(raw: string): StackEnvironment {
    if (!raw) {
      return StackEnvironment.none();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InvalidInputError("env-json is not valid JSON");
    }
    if (!Array.isArray(parsed)) {
      throw new InvalidInputError("env-json must be a JSON array of {name,value} objects");
    }
    return new StackEnvironment(parsed as StackEnvVar[]);
  }

  /** True when the caller explicitly supplied an environment. */
  get isDefined(): boolean {
    return this.vars !== undefined;
  }

  /** Variables to send, defaulting to an empty set when none were supplied. */
  toArray(): StackEnvVar[] {
    return this.vars ?? [];
  }
}
