/**
 * Domain port for reading files from the action workspace.
 * Implemented by `infrastructure/data/file-system-repository`.
 */
export interface WorkspaceFileReader {
  /** Read a workspace file's text content; throws when it cannot be read. */
  read(filePath: string): string;
}
