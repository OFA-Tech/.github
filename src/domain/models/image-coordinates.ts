/**
 * Value object for where a docker image lives: registry, account (namespace),
 * and repository name.
 *
 * Owns the normalization and validation rules previously implemented by
 * `docker_normalize_component`/`docker_validate_repo_component` in shell:
 * components are lowercased, stripped of surrounding slashes, and must match
 * the docker repository grammar.
 */
import { InvalidInputError } from "../shared-utils/errors";

const COMPONENT_GRAMMAR = /^[a-z0-9]+([._-][a-z0-9]+)*$/;

function normalizeComponent(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

function validateComponent(component: string, label: string): void {
  if (!component) {
    throw new InvalidInputError(`Resolved ${label} is empty.`);
  }
  if (component.includes("/")) {
    throw new InvalidInputError(`Resolved ${label} '${component}' must not contain '/'.`);
  }
  if (!COMPONENT_GRAMMAR.test(component)) {
    throw new InvalidInputError(
      `Resolved ${label} '${component}' is invalid. Allowed: lowercase letters, numbers, '.', '_' and '-'.`,
    );
  }
}

export class ImageCoordinates {
  private constructor(
    /** Normalized registry host; empty or `docker.io` means Docker Hub. */
    readonly registry: string,
    /** Account / namespace component. */
    readonly account: string,
    /** Repository (image name) component. */
    readonly repository: string,
  ) {}

  static create(registry: string, account: string, repository: string): ImageCoordinates {
    const normalizedAccount = normalizeComponent(account);
    validateComponent(normalizedAccount, "Docker account");
    const normalizedRepository = normalizeComponent(repository);
    validateComponent(normalizedRepository, "Docker image name");
    return new ImageCoordinates(registry.toLowerCase(), normalizedAccount, normalizedRepository);
  }

  /** Full image path without a tag; Docker Hub omits the registry prefix. */
  get imagePath(): string {
    if (!this.registry || this.registry === "docker.io") {
      return `${this.account}/${this.repository}`;
    }
    return `${this.registry}/${this.account}/${this.repository}`;
  }

  /** Full image reference for a specific tag. */
  taggedAs(tag: string): string {
    return `${this.imagePath}:${tag}`;
  }
}
