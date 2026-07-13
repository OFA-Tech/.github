/**
 * Value object for the build environment a docker image is produced for.
 *
 * Owns the two rules previously in `docker_resolve_environment` and
 * `docker_env_prefix`: an explicit request wins, otherwise the environment is
 * derived from the branch/ref name; each environment maps to a version-tag
 * prefix (`dev-`, `stg-`, or none for production).
 */
import { InvalidInputError } from "../shared-utils/errors";

export class BuildEnvironment {
  private constructor(
    /** Canonical name: development | staging | production. */
    readonly name: string,
    /** Version tag prefix: `dev-`, `stg-`, or empty for production. */
    readonly tagPrefix: string,
  ) {}

  /** Explicitly requested environment wins; otherwise derive from the ref name. */
  static resolve(requested: string, refName: string): BuildEnvironment {
    const value = requested.trim().toLowerCase() || defaultFromRef(refName.toLowerCase());
    switch (value) {
      case "development":
      case "develop":
      case "dev":
        return new BuildEnvironment("development", "dev-");
      case "staging":
      case "stage":
      case "stg":
        return new BuildEnvironment("staging", "stg-");
      case "production":
      case "prod":
      case "":
        return new BuildEnvironment("production", "");
      default:
        throw new InvalidInputError(
          `Unsupported docker environment '${value}'. Use development, staging or production.`,
        );
    }
  }
}

function defaultFromRef(refName: string): string {
  switch (refName) {
    case "development":
    case "develop":
    case "dev":
      return "development";
    case "staging":
    case "stage":
    case "stg":
      return "staging";
    default:
      return "production";
  }
}
