/**
 * Domain port for checking whether an image reference already exists in a
 * remote registry (implemented with `docker manifest inspect`). Best effort:
 * failures report "does not exist".
 */
export interface ImageManifestAccess {
  manifestExists(imageReference: string): Promise<boolean>;
}
