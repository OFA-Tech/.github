/**
 * Use case: locate a stack by id (direct) or by name within an endpoint.
 */
import { InvalidInputError } from "../../../domain";
import { StackLookup, type StackRepository } from "../../../domain";

export interface StackQuery {
  stackId?: string;
  stackName?: string;
  endpointId?: string;
}

export class FindStackUseCase {
  constructor(private readonly stacks: StackRepository) {}

  async execute(query: StackQuery): Promise<StackLookup> {
    if (query.stackId) {
      return StackLookup.of(await this.stacks.findById(query.stackId));
    }
    if (!query.stackName) {
      throw new InvalidInputError("Provide stack-id or stack-name");
    }
    const stack = await this.stacks.findByName(query.stackName, query.endpointId || undefined);
    return StackLookup.of(stack);
  }
}
