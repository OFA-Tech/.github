/**
 * Use case: roll a stack back to a previous file version.
 */
import { PreconditionError } from "../../../domain";
import { logger } from "../../core/logger";
import { RollbackTarget, type StackRepository } from "../../../domain";

export interface RollbackStackInput {
  endpointId: string;
  stackName: string;
  /** Explicit target version. When omitted, falls back to current minus one. */
  rollbackTo?: string;
  prune: boolean;
  repull: boolean;
}

export interface RollbackResult {
  stackId: string;
  rollbackTo: string;
}

export class RollbackStackUseCase {
  constructor(private readonly stacks: StackRepository) {}

  async execute(input: RollbackStackInput): Promise<RollbackResult> {
    const stack = await this.stacks.findByName(input.stackName, input.endpointId);
    if (!stack) {
      throw new PreconditionError(
        `Stack '${input.stackName}' was not found for endpoint '${input.endpointId}'`,
      );
    }

    const target = input.rollbackTo
      ? RollbackTarget.fromInput(input.rollbackTo)
      : RollbackTarget.previousOf(stack);

    await this.stacks.rollback({
      endpointId: input.endpointId,
      stackId: stack.id,
      target,
      prune: input.prune,
      repullImage: input.repull,
    });

    logger.info("Stack rolled back", { stackId: stack.id, rollbackTo: target.toString() });
    return { stackId: stack.id, rollbackTo: target.toString() };
  }
}
