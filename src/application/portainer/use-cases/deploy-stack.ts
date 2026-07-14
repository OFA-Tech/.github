/**
 * Use case: create a brand new stack (swarm or standalone) from file content.
 */
import {
  InvalidInputError,
  type DeployOperation,
  type StackEnvironment,
  type StackRepository,
  type StackType,
} from "../../../domain";
import { logger } from "../../core/logger";

export interface DeployStackInput {
  endpointId: string;
  stackType: StackType;
  stackName: string;
  stackFileContent: string;
  swarmId?: string;
  env: StackEnvironment;
}

export interface DeployResult {
  stackId: string;
  operation: DeployOperation;
}

export class DeployStackUseCase {
  constructor(private readonly stacks: StackRepository) {}

  async execute(input: DeployStackInput): Promise<DeployResult> {
    if (input.stackType === "swarm" && !input.swarmId) {
      throw new InvalidInputError("swarm-id is required for swarm deploy");
    }

    const stackId = await this.stacks.create({
      endpointId: input.endpointId,
      type: input.stackType,
      name: input.stackName,
      fileContent: input.stackFileContent,
      swarmId: input.swarmId,
      env: input.env,
    });

    logger.info("Stack deployed", { stackId, stackName: input.stackName });
    return { stackId, operation: "deploy" };
  }
}
