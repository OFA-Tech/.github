/**
 * Composition root: the only place infrastructure implementations are wired
 * into domain/application ports. Action entrypoints import factories from
 * here and never construct adapters directly.
 */
export * from "./portainer";
export * from "./stack-file";
export * from "./docker";
export * from "./github";
