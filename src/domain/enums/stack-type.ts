/** Stack runtime type as a domain concept. */
export type StackType = "swarm" | "standalone";

/** Runtime type including the case where the API response is ambiguous. */
export type ResolvedStackType = StackType | "unknown";
