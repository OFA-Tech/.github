/**
 * Application service: resolve stack/compose file content from either inline
 * text or a workspace file path, then interpolate placeholders.
 *
 * Port of `common_resolve_content_or_file` — orchestration only: the file
 * side effect sits behind the {@link WorkspaceFileReader} port and the
 * interpolation rules live in the domain.
 */
import { ScopedVariables, Template, type VariableSource } from "../../domain";
import { InvalidInputError } from "../../domain";
import type { WorkspaceFileReader } from "../../domain";

export class StackFileResolver {
  constructor(private readonly files: WorkspaceFileReader) {}

  /**
   * Returns interpolated stack content. Prefers inline `content`; falls back
   * to reading `filePath` from the workspace. Throws when neither yields
   * content.
   */
  resolve(content: string, filePath: string, env: VariableSource = process.env): string {
    let resolved = content;
    if (!resolved && filePath) {
      resolved = this.files.read(filePath);
    }
    if (!resolved) {
      throw new InvalidInputError("Either stack-file-content or stack-file-path is required");
    }
    return new Template(resolved).render(new ScopedVariables(env));
  }
}
