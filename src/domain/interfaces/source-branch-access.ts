/**
 * Domain port for detecting the source branch a build originates from
 * (pull-request head ref, event payload, or merge-commit subject).
 * Returns an empty string when no source branch can be determined.
 */
export interface SourceBranchAccess {
  detect(): Promise<string>;
}
