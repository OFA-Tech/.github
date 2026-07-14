/**
 * Filesystem repository implementing the {@link WorkspaceFileReader} port.
 *
 * Owns the workspace-specific rule (`GITHUB_WORKSPACE` with a cwd fallback)
 * and delegates path resolution and the actual disk read to the shared
 * {@link FileSystemAccess} service.
 */
import type { FileSystemAccess } from "../../../domain/interfaces/file-system-access";
import type { WorkspaceFileReader } from "../../../domain/interfaces/workspace-file-reader";
import type { VariableSource } from "../../../domain/models/scoped-variables";
import { NodeFileSystemAccess } from "./file-system-access";

export class NodeWorkspaceFileReader implements WorkspaceFileReader {
  constructor(
    private readonly env: VariableSource = process.env,
    private readonly files: FileSystemAccess = new NodeFileSystemAccess(),
  ) {}

  read(filePath: string): string {
    const workspace = this.env.GITHUB_WORKSPACE ?? process.cwd();
    return this.files.readText(this.files.resolvePath(workspace, filePath));
  }
}
