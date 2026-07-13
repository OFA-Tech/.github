/**
 * Value object for a single `${NAME}` / `${NAME:-default}` placeholder
 * occurrence inside template content.
 */

const PLACEHOLDER = /\$\{([^}]+)\}/;
const WITH_DEFAULT = /^([^:]+):-(.*)$/;

export class Placeholder {
  private constructor(
    /** The full `${...}` text as it appears in the content. */
    readonly raw: string,
    readonly name: string,
    readonly fallback: string,
  ) {}

  /** Find the next placeholder in `content`, or `null` when none remain. */
  static findNext(content: string): Placeholder | null {
    const match = PLACEHOLDER.exec(content);
    if (!match) {
      return null;
    }
    const spec = match[1];
    const withDefault = WITH_DEFAULT.exec(spec);
    if (withDefault) {
      return new Placeholder(match[0], withDefault[1], withDefault[2]);
    }
    return new Placeholder(match[0], spec, "");
  }
}
