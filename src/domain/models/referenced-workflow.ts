/**
 * Value object for one entry of a workflow run's `referenced_workflows` —
 * a reusable workflow the run was resolved against, with the exact commit
 * (`sha`) and, when called by branch or tag, the symbolic `ref`.
 */
export class ReferencedWorkflow {
  constructor(
    /** Full workflow path, e.g. `owner/repo/.github/workflows/ci.yml@refs/heads/main`. */
    readonly path: string,
    /** Commit SHA the workflow file was resolved to. */
    readonly sha: string = "",
    /** Symbolic ref the workflow was called with, e.g. `refs/heads/main`. */
    readonly ref: string = "",
  ) {}

  /** The `owner/repo` the workflow file lives in. */
  get repository(): string {
    const [owner = "", repo = ""] = this.path.split("/");
    return owner && repo ? `${owner}/${repo}` : "";
  }

  /** True when this workflow belongs to the given `owner/repo` (case-insensitive). */
  belongsTo(repository: string): boolean {
    return this.repository.toLowerCase() === repository.trim().toLowerCase();
  }

  /**
   * Best ref to check the repository out at: the exact commit when known,
   * otherwise the symbolic ref; empty when neither is available.
   */
  get checkoutRef(): string {
    return this.sha || this.ref;
  }
}
