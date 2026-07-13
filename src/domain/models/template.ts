/**
 * Value object for a piece of text containing `${...}` placeholders.
 *
 * Rendering expands every {@link Placeholder} against a
 * {@link ScopedVariables} source. Resolution is iterative so values that
 * themselves contain placeholders are expanded too.
 */
import { Placeholder } from "./placeholder";
import type { ScopedVariables } from "./scoped-variables";

export class Template {
  constructor(private readonly content: string) {}

  render(variables: ScopedVariables): string {
    let result = this.content;
    // Bound iterations to avoid pathological self-referential loops.
    let guard = 0;
    const maxIterations = 10_000;

    let placeholder = Placeholder.findNext(result);
    while (placeholder && guard < maxIterations) {
      guard += 1;
      const replacement = variables.resolve(placeholder.name, placeholder.fallback);
      result = result.split(placeholder.raw).join(replacement);
      placeholder = Placeholder.findNext(result);
    }

    return result;
  }
}
