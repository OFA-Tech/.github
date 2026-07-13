/**
 * Value object for the stack file version a rollback should restore.
 *
 * Owns the two business rules for choosing a target: an explicit target must
 * be a non-negative integer, and a computed default is "one version before the
 * stack's current version", which only exists from version 2 onward.
 */
import { InvalidInputError, PreconditionError } from "../shared-utils/errors";
import type { Stack } from "../entities/stack";

export class RollbackTarget {
  private constructor(readonly version: number) {}

  /** Validate an explicitly requested target version. */
  static fromInput(raw: string): RollbackTarget {
    if (!/^[0-9]+$/.test(raw)) {
      throw new InvalidInputError("rollback-to must be a positive integer");
    }
    return new RollbackTarget(Number(raw));
  }

  /** Default target: the version immediately before the stack's current one. */
  static previousOf(stack: Stack): RollbackTarget {
    const current = stack.version;
    if (current === undefined || current === null) {
      throw new InvalidInputError(
        "rollback-to is required when stack version is not available in stack inspect response",
      );
    }
    if (current < 2) {
      throw new PreconditionError(
        `Stack version ${current} has no previous version to rollback to`,
      );
    }
    return new RollbackTarget(current - 1);
  }

  toString(): string {
    return String(this.version);
  }
}
