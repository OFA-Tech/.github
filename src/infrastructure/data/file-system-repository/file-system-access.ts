/**
 * Node implementation of the {@link FileSystemAccess} domain port —
 * the filesystem counterpart of the REST access service.
 *
 * Owns path resolution and disk reads once, so repositories describe *which*
 * file they need and never touch `node:fs` directly.
 */
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { FileSystemAccess } from "../../../domain/interfaces/file-system-access";
import { InvalidInputError } from "../../../domain/shared-utils/errors";

export class NodeFileSystemAccess implements FileSystemAccess {
  resolvePath(baseDir: string, filePath: string): string {
    return isAbsolute(filePath) ? filePath : join(baseDir, filePath);
  }

  readText(filePath: string): string {
    try {
      return readFileSync(filePath, "utf8");
    } catch {
      throw new InvalidInputError(`File not found: ${filePath}`);
    }
  }
}
