/**
 * Use case: update an existing stack.
 *
 * When the stack is Git-backed and git-redeploy is preferred, trigger a git
 * redeploy; otherwise fall back to a file content update (fetching the current
 * file when none was supplied).
 */
import { PreconditionError } from "../../../domain";
import { logger } from "../../core/logger";
import type { StackEnvironment, StackRepository } from "../../../domain";
import type { DeployResult } from "./deploy-stack";

export interface UpdateStackInput {
  endpointId: string;
  stackId: string;
  stackFileContent: string;
  prune: boolean;
  repull: boolean;
  preferGitRedeploy: boolean;
  env: StackEnvironment;
}

export class UpdateStackUseCase {
  constructor(private readonly stacks: StackRepository) {}

  async execute(input: UpdateStackInput): Promise<DeployResult> {
    const stack = await this.stacks.getById(input.stackId);

    if (input.preferGitRedeploy && stack.isGitBacked) {
      logger.info("Updating via git redeploy", { stackId: input.stackId });
      const stackId = await this.stacks.redeployFromGit({
        endpointId: input.endpointId,
        stackId: input.stackId,
        prune: input.prune,
        repullImage: input.repull,
      });
      return { stackId, operation: "update" };
    }

    let content = input.stackFileContent;
    if (!content) {
      content = await this.stacks.getStackFileContent(input.stackId);
      if (!content) {
        throw new PreconditionError(
          "stack-file-content not provided and current stack file could not be retrieved",
        );
      }
    }

    logger.info("Updating via file content", { stackId: input.stackId });
    const stackId = await this.stacks.updateFile({
      endpointId: input.endpointId,
      stackId: input.stackId,
      fileContent: content,
      prune: input.prune,
      repullImage: input.repull,
      env: input.env,
    });
    return { stackId, operation: "update" };
  }
}
