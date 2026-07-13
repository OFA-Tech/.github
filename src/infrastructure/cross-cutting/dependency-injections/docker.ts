/**
 * Composition root for the Docker bounded context: wires the Docker Hub API
 * adapter and the CLI adapters into the domain ports and hands back the
 * ready-to-run metadata use case.
 */
import { ResolveImageMetadataUseCase } from "../../../application/docker/use-cases";
import type { VariableSource } from "../../../domain";
import { DockerHubClient } from "../../data/api-repositories/docker-hub/client";
import { DockerHubTagRepository } from "../../data/api-repositories/docker-hub/tag-repository";
import { DockerCliManifestAccess } from "../../data/command-line-repository/docker-manifest-access";
import { GitHubSourceBranchAccess } from "../../data/command-line-repository/source-branch-access";

export interface DockerHubCredentials {
  username: string;
  token: string;
}

export function createImageMetadataResolver(
  credentials: DockerHubCredentials,
  env: VariableSource = process.env,
): ResolveImageMetadataUseCase {
  const client = new DockerHubClient(credentials);
  return new ResolveImageMetadataUseCase({
    tags: new DockerHubTagRepository(client),
    manifests: new DockerCliManifestAccess(),
    branches: new GitHubSourceBranchAccess(env),
    env,
  });
}
