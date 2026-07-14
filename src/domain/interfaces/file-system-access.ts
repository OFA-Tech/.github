/**
 * Domain port for parameterized filesystem access.
 * Implemented by `infrastructure/data/file-system-repository`.
 */
export interface FileSystemAccess {
  /** Resolve a possibly-relative path against a base directory. */
  resolvePath(baseDir: string, filePath: string): string;
  /** Read a text file; throws when it cannot be read. */
  readText(filePath: string): string;
}
