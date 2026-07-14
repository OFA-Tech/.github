/**
 * Raw payload shapes returned by the GitHub Actions REST API. Only the
 * fields the repository actually reads are declared.
 */
export interface ReferencedWorkflowPayload {
  path?: string;
  sha?: string;
  ref?: string;
}

export interface WorkflowRunPayload {
  referenced_workflows?: ReferencedWorkflowPayload[] | null;
}
