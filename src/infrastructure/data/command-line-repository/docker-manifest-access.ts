/**
 * CLI adapter implementing the {@link ImageManifestAccess} domain port with
 * `docker manifest inspect` via `@actions/exec`.
 *
 * Best effort, like the old `docker_tag_exists_remote` helper: any failure
 * (missing docker binary, auth, unknown manifest) reports "does not exist".
 */
import { exec } from "@actions/exec";
import type { ImageManifestAccess } from "../../../domain";

export class DockerCliManifestAccess implements ImageManifestAccess {
  async manifestExists(imageReference: string): Promise<boolean> {
    try {
      const exitCode = await exec("docker", ["manifest", "inspect", imageReference], {
        silent: true,
        ignoreReturnCode: true,
      });
      return exitCode === 0;
    } catch {
      return false;
    }
  }
}
