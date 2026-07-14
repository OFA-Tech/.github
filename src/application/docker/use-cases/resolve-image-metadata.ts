/**
 * Use case: resolve the full metadata for a docker image build.
 *
 * TypeScript port of `docker_resolve_metadata` from `scripts/docker/common.sh`:
 * account/repository resolution with override → secret → env → GitHub-context
 * fallbacks, environment-prefixed version generation with branch-based
 * bumping, and a collision loop that advances the point version until the tag
 * is unpublished. The docker build/tag/push commands themselves stay in shell.
 */
import {
  BuildEnvironment,
  bumpForBranch,
  ImageCoordinates,
  latestSemverBaseline,
  nextVersion,
  PreconditionError,
  SemverDateTag,
  type ImageManifestAccess,
  type ImageTagRepository,
  type SourceBranchAccess,
  type VariableSource,
} from "../../../domain";
import { logger } from "../../core/logger";

export interface ResolveImageMetadataInput {
  /** Registry host; empty or `docker.io` means Docker Hub. */
  registry: string;
  /** Explicit account/namespace override. */
  namespace: string;
  /** Explicit repository (image name) override. */
  repository: string;
  /** Explicit version tag override; skips version generation entirely. */
  tag: string;
  /** Requested build environment (development, staging, production). */
  environment: string;
  /** Registry username; also an account fallback like the shell resolver. */
  username: string;
}

export interface ImageMetadata {
  registry: string;
  account: string;
  imageName: string;
  image: string;
  version: string;
  imageVersionTag: string;
  imageLatestTag: string;
}

export interface ResolveImageMetadataDependencies {
  tags: ImageTagRepository;
  manifests: ImageManifestAccess;
  branches: SourceBranchAccess;
  /** Environment snapshot; defaults to `process.env`. */
  env?: VariableSource;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

/** Safety bound for the collision loop; the shell version looped unbounded. */
const MAX_COLLISION_BUMPS = 1000;

export class ResolveImageMetadataUseCase {
  private readonly env: VariableSource;
  private readonly now: () => Date;

  constructor(private readonly deps: ResolveImageMetadataDependencies) {
    this.env = deps.env ?? process.env;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: ResolveImageMetadataInput): Promise<ImageMetadata> {
    const account = firstNonEmpty(
      input.namespace,
      input.username,
      this.env.DOCKER_ACCOUNT_SECRET,
      this.env.DOCKER_ACCOUNT,
      this.ownerFallback(),
    );
    const repository = firstNonEmpty(
      input.repository,
      this.env.DOCKER_IMAGE_NAME_SECRET,
      this.env.DOCKER_IMAGE_NAME,
      this.repositoryBasename(),
    );

    const coordinates = ImageCoordinates.create(input.registry, account, repository);
    const version = input.tag || (await this.generateVersion(coordinates, input.environment));

    return {
      registry: coordinates.registry,
      account: coordinates.account,
      imageName: coordinates.repository,
      image: coordinates.imagePath,
      version,
      imageVersionTag: coordinates.taggedAs(version),
      imageLatestTag: coordinates.taggedAs("latest"),
    };
  }

  private async generateVersion(
    coordinates: ImageCoordinates,
    requestedEnvironment: string,
  ): Promise<string> {
    const environment = BuildEnvironment.resolve(
      requestedEnvironment,
      this.env.GITHUB_REF_NAME ?? "",
    );
    const sourceBranch = (await this.deps.branches.detect()).toLowerCase();
    const bump = bumpForBranch(sourceBranch);

    const baseline = latestSemverBaseline(await this.deps.tags.listTags(coordinates));
    const { major, minor, point } = nextVersion(baseline, bump);
    const buildDate = formatUtcDate(this.now());

    let candidate = SemverDateTag.of(environment.tagPrefix, major, minor, point, buildDate);
    for (let bumps = 0; bumps < MAX_COLLISION_BUMPS; bumps += 1) {
      const version = candidate.toString();
      const published =
        (await this.deps.tags.tagExists(coordinates, version)) ||
        (await this.deps.manifests.manifestExists(coordinates.taggedAs(version)));
      if (!published) {
        logger.info("Resolved image version", {
          version,
          environment: environment.name,
          sourceBranch,
          bump,
        });
        return version;
      }
      candidate = candidate.withPoint(candidate.point + 1);
    }

    throw new PreconditionError(
      `Unable to find an unpublished version tag for ${coordinates.imagePath} after ${MAX_COLLISION_BUMPS} attempts`,
    );
  }

  private ownerFallback(): string {
    const owner = (this.env.GITHUB_REPOSITORY_OWNER ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return owner || "ofa-tech";
  }

  private repositoryBasename(): string {
    const repository = this.env.GITHUB_REPOSITORY ?? "";
    const basename = repository.split("/").pop() ?? "";
    return basename.toLowerCase();
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return "";
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
