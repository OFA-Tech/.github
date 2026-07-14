/**
 * Transport DTOs for the subset of the Portainer API the actions use.
 *
 * These mirror the wire format verbatim (inconsistent casings and all) and
 * never leave the infrastructure layer: `stack-repository.ts` maps them to the
 * normalized domain model at the boundary.
 */

/** Numeric stack type as returned by the Portainer API. */
export enum PortainerStackKind {
  Swarm = 1,
  Compose = 2,
}

/** Shape of a stack object returned by `GET /api/stacks` and `/api/stacks/{id}`. */
export interface PortainerStackDto {
  Id?: number;
  ID?: number;
  Name?: string;
  Type?: PortainerStackKind | number;
  SwarmID?: string;
  EndpointId?: number;
  EndpointID?: number;
  Version?: number;
  GitConfig?: unknown | null;
}

/** Response body of the stack file endpoint. */
export interface StackFileResponseDto {
  StackFileContent?: string;
}
