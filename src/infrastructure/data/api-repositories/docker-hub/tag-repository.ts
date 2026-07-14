/**
 * API repository implementing the {@link ImageTagRepository} domain port
 * against Docker Hub.
 *
 * Mirrors the old shell behaviour (`docker_fetch_latest_semver` /
 * `docker_tag_exists_dockerhub`): without credentials, or when the API call
 * fails, it reports "nothing published" instead of failing the build.
 */
import type { ImageCoordinates, ImageTagRepository } from "../../../../domain";
import type { DockerHubTagListDto } from "./api-types";
import type { DockerHubClient } from "./client";

export class DockerHubTagRepository implements ImageTagRepository {
  constructor(private readonly client: DockerHubClient) {}

  async listTags(coordinates: ImageCoordinates): Promise<string[]> {
    if (!this.client.hasCredentials) {
      return [];
    }
    try {
      const list = await this.client.get<DockerHubTagListDto>(
        `/repositories/${coordinates.account}/${coordinates.repository}/tags`,
        { page_size: 100 },
      );
      return (list.results ?? [])
        .map((tag) => tag.name ?? "")
        .filter((name) => name !== "");
    } catch {
      // Best effort: an unreachable registry means "no baseline", not a failure.
      return [];
    }
  }

  async tagExists(coordinates: ImageCoordinates, tag: string): Promise<boolean> {
    if (!this.client.hasCredentials) {
      return false;
    }
    try {
      await this.client.get(
        `/repositories/${coordinates.account}/${coordinates.repository}/tags/${tag}/`,
      );
      return true;
    } catch {
      return false;
    }
  }
}
