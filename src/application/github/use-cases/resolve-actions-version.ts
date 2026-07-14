/**
 * Use case: determine which version of the shared actions repository this
 * workflow run was called with.
 *
 * `github.job_workflow_sha` evaluates empty on nested reusable-workflow
 * calls, so instead the run's `referenced_workflows` metadata is queried and
 * the entry belonging to the actions repository selected. Falls back to a
 * caller-supplied ref (normally `main`) when the run references nothing from
 * that repository.
 */
import { InvalidInputError } from "../../../domain";
import type { WorkflowRunRepository } from "../../../domain";

export interface ResolveActionsVersionQuery {
  /** `owner/repo` the workflow run lives in (the consumer repository). */
  runRepository: string;
  /** Workflow run id within `runRepository`. */
  runId: string;
  /** `owner/repo` of the shared actions repository to resolve. */
  actionsRepository: string;
  /** Ref returned when the run references nothing from `actionsRepository`. */
  fallbackRef: string;
}

export interface ResolvedActionsVersion {
  /** Commit SHA (preferred) or symbolic ref to check the actions out at. */
  ref: string;
  /** False when `ref` is the fallback rather than a resolved reference. */
  matched: boolean;
}

export class ResolveActionsVersionUseCase {
  constructor(private readonly runs: WorkflowRunRepository) {}

  async execute(query: ResolveActionsVersionQuery): Promise<ResolvedActionsVersion> {
    if (!query.runRepository || !query.runId) {
      throw new InvalidInputError("run repository and run id are required");
    }
    if (!query.actionsRepository) {
      throw new InvalidInputError("actions repository is required");
    }

    const referenced = await this.runs.referencedWorkflows(query.runRepository, query.runId);
    const match = referenced.find(
      (workflow) => workflow.belongsTo(query.actionsRepository) && workflow.checkoutRef,
    );

    if (!match) {
      return { ref: query.fallbackRef, matched: false };
    }
    return { ref: match.checkoutRef, matched: true };
  }
}
