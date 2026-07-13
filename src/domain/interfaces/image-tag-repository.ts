/**
 * Domain port for querying published tags of an image repository (Docker Hub
 * today). Implementations degrade gracefully: without credentials or on API
 * failure they report "nothing published" rather than failing the build.
 */
import type { ImageCoordinates } from "../models/image-coordinates";

export interface ImageTagRepository {
  /** All known tag names for the repository (best effort; may be empty). */
  listTags(coordinates: ImageCoordinates): Promise<string[]>;
  /** True when the tag is known to exist (best effort; false on failure). */
  tagExists(coordinates: ImageCoordinates, tag: string): Promise<boolean>;
}
