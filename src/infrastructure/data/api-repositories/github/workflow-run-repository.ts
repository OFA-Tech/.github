/**
 * GitHub Actions API implementation of the {@link WorkflowRunRepository}
 * port. Maps the raw run payload into domain {@link ReferencedWorkflow}
 * value objects.
 */
import { ReferencedWorkflow } from "../../../../domain";
import type { WorkflowRunRepository } from "../../../../domain";
import type { WorkflowRunPayload } from "./api-types";
import type { GitHubClient } from "./client";

export class GitHubWorkflowRunRepository implements WorkflowRunRepository {
  constructor(private readonly client: GitHubClient) {}

  async referencedWorkflows(repository: string, runId: string): Promise<ReferencedWorkflow[]> {
    const run = await this.client.get<WorkflowRunPayload>(
      `/repos/${repository}/actions/runs/${runId}`,
    );
    return (run.referenced_workflows ?? [])
      .filter((entry) => entry.path)
      .map((entry) => new ReferencedWorkflow(entry.path ?? "", entry.sha ?? "", entry.ref ?? ""));
  }
}
