/**
 * Composition root for the GitHub bounded context: wires the HTTP adapter
 * into the domain port and hands back ready-to-run use cases.
 */
import { ResolveActionsVersionUseCase } from "../../../application/github/use-cases";
import { GitHubClient, type GitHubClientOptions } from "../../data/api-repositories/github/client";
import { GitHubWorkflowRunRepository } from "../../data/api-repositories/github/workflow-run-repository";

/** The wired use cases an action entrypoint works with. */
export interface GitHubWorkflowRuns {
  resolveActionsVersion: ResolveActionsVersionUseCase;
}

export function createGitHubWorkflowRuns(options: GitHubClientOptions): GitHubWorkflowRuns {
  const repository = new GitHubWorkflowRunRepository(new GitHubClient(options));
  return {
    resolveActionsVersion: new ResolveActionsVersionUseCase(repository),
  };
}
