/**
 * Value object for the organization's image tag scheme:
 * `[dev-|stg-]<major>.<minor>.<point>-<yyyymmdd>`.
 *
 * Owns parsing of existing registry tags and the baseline math previously in
 * `docker_fetch_latest_semver`: the highest `major.minor.point` triplet seen
 * plus the highest point value across every matching tag.
 */
const TAG_GRAMMAR = /^(dev-|stg-)?([0-9]+)\.([0-9]+)\.([0-9]+)-([0-9]{8})$/;

export class SemverDateTag {
  private constructor(
    readonly prefix: string,
    readonly major: number,
    readonly minor: number,
    readonly point: number,
    readonly date: string,
  ) {}

  /** Parse a registry tag; returns null when it does not follow the scheme. */
  static parse(tag: string): SemverDateTag | null {
    const match = TAG_GRAMMAR.exec(tag);
    if (!match) {
      return null;
    }
    return new SemverDateTag(
      match[1] ?? "",
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      match[5],
    );
  }

  static of(prefix: string, major: number, minor: number, point: number, date: string): SemverDateTag {
    return new SemverDateTag(prefix, major, minor, point, date);
  }

  /** Same version with a different point value (used for collision bumps). */
  withPoint(point: number): SemverDateTag {
    return new SemverDateTag(this.prefix, this.major, this.minor, point, this.date);
  }

  toString(): string {
    return `${this.prefix}${this.major}.${this.minor}.${this.point}-${this.date}`;
  }
}

/** Highest published version triplet plus the highest point seen overall. */
export interface SemverBaseline {
  major: number;
  minor: number;
  /** Max point value across all matching tags, regardless of major/minor. */
  maxPoint: number;
}

export function latestSemverBaseline(tags: string[]): SemverBaseline {
  let major = 0;
  let minor = 0;
  let point = 0;
  let maxPoint = 0;

  for (const raw of tags) {
    const tag = SemverDateTag.parse(raw);
    if (!tag) {
      continue;
    }
    if (
      tag.major > major ||
      (tag.major === major && tag.minor > minor) ||
      (tag.major === major && tag.minor === minor && tag.point > point)
    ) {
      major = tag.major;
      minor = tag.minor;
      point = tag.point;
    }
    if (tag.point > maxPoint) {
      maxPoint = tag.point;
    }
  }

  return { major, minor, maxPoint };
}
