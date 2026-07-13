/**
 * Branch-based version bump rules for generated image tags.
 *
 * `feature/*`/`feat/*` branches bump the major version, `fix/*`/`hotfix/*`
 * bump the minor version, and everything else only advances the point value.
 * The point value always advances from the baseline's max point.
 */
import type { SemverBaseline } from "./semver-date-tag";

export type VersionBump = "major" | "minor" | "patch";

/** Classify a (lowercased) source branch name into a bump kind. */
export function bumpForBranch(sourceBranch: string): VersionBump {
  if (sourceBranch.startsWith("feature/") || sourceBranch.startsWith("feat/")) {
    return "major";
  }
  if (sourceBranch.startsWith("fix/") || sourceBranch.startsWith("hotfix/")) {
    return "minor";
  }
  return "patch";
}

/** Apply a bump to the published baseline, yielding the next version triplet. */
export function nextVersion(
  baseline: SemverBaseline,
  bump: VersionBump,
): { major: number; minor: number; point: number } {
  const point = baseline.maxPoint + 1;
  if (bump === "major") {
    return { major: baseline.major + 1, minor: 0, point };
  }
  if (bump === "minor") {
    return { major: baseline.major, minor: baseline.minor + 1, point };
  }
  return { major: baseline.major, minor: baseline.minor, point };
}
