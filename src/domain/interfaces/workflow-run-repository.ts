/**
 * Port: read access to a workflow run's metadata on the hosting forge
 * (GitHub Actions API). Implemented in infrastructure.
 */
import type { ReferencedWorkflow } from "../models/referenced-workflow";

export interface WorkflowRunRepository {
  /** Reusable workflows referenced by the given run of `owner/repo`. */
  referencedWorkflows(repository: string, runId: string): Promise<ReferencedWorkflow[]>;
}
