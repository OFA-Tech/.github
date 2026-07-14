/**
 * Action entrypoint: Docker Image Metadata.
 *
 * Orchestration only — input parsing and the output contract for the
 * metadata step of `actions/docker/build-image` (and the standalone
 * `actions/docker/metadata` action). Resolution rules live in `src/domain`,
 * the use case in `../use-cases`, side effects in `src/infrastructure/data`;
 * wiring comes from the dependency-injection factories.
 */
import { createImageMetadataResolver } from "../../../infrastructure/cross-cutting/dependency-injections";
import { getString, logger, runAction, setOutputs } from "../../core";

async function resolveMetadata(): Promise<void> {
  const registry = getString("registry", "docker.io");
  const namespace = getString("namespace");
  const repository = getString("repository");
  const tag = getString("tag");
  const environment = getString("environment");
  const token = getString("token");

  // Same defaulting the composite previously did in shell: an explicit
  // username wins, otherwise the repository owner is used for Docker Hub
  // lookups and as an account candidate.
  const username =
    getString("username") || (process.env.GITHUB_REPOSITORY_OWNER ?? "").toLowerCase();
  logger.info("Resolving docker image metadata", {
    registry,
    username,
    namespace: namespace || username,
  });

  const metadata = await createImageMetadataResolver({ username, token }).execute({
    registry,
    namespace,
    repository,
    tag,
    environment,
    username,
  });

  setOutputs({
    registry: metadata.registry,
    account: metadata.account,
    "image-name": metadata.imageName,
    image: metadata.image,
    version: metadata.version,
    "image-version-tag": metadata.imageVersionTag,
    "image-latest-tag": metadata.imageLatestTag,
  });
}

void runAction({ name: "docker-metadata" }, resolveMetadata);
