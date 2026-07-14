/**
 * Barrel for the shared application area: action runtime (logging, IO,
 * lifecycle) and reusable application services. Re-exports the shared error
 * kernel so consumers have one import surface.
 */
export * from "../../domain/shared-utils/errors";
export * from "./logger";
export * from "./inputs";
export * from "./outputs";
export * from "./run";
export * from "./stack-file-resolver";
