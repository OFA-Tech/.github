/**
 * Result model of asking "does this stack exist?". Owns the
 * presentation-neutral fields the actions publish and the type-expectation
 * rule.
 */
import type { Stack } from "../entities/stack";
import type { ResolvedStackType } from "../enums/stack-type";
import { PreconditionError } from "../shared-utils/errors";

export class StackLookup {
  private constructor(private readonly stack: Stack | null) {}

  static of(stack: Stack | null): StackLookup {
    return new StackLookup(stack);
  }

  static notFound(): StackLookup {
    return new StackLookup(null);
  }

  get exists(): boolean {
    return this.stack !== null;
  }

  get stackId(): string {
    return this.stack?.id ?? "";
  }

  get stackName(): string {
    return this.stack?.name ?? "";
  }

  get type(): ResolvedStackType {
    return this.stack?.type ?? "unknown";
  }

  /** Enforce an optional expected runtime type. No-op when `expected` is empty. */
  ensureType(expected: string): void {
    if (!expected || !this.exists || expected === this.type) {
      return;
    }
    throw new PreconditionError(
      `Stack found but type mismatch. Expected ${expected}, got ${this.type}`,
    );
  }
}
