/**
 * Boundary mapping between Portainer wire DTOs and the domain model.
 *
 * Lives in infrastructure because it consumes transport DTOs, which must not
 * leak past this layer. Normalizes the wire quirks (duplicate `Id`/`ID` and
 * endpoint casings, numeric type codes, raw `GitConfig` payloads) into the
 * {@link Stack} entity.
 */
import { Stack, type ResolvedStackType } from "../../../../domain";
import { PortainerStackKind, type PortainerStackDto } from "./api-types";

/** Derive the runtime type of a stack from its API representation. */
export function resolveStackType(dto: PortainerStackDto): ResolvedStackType {
  if (dto.SwarmID || dto.Type === PortainerStackKind.Swarm) {
    return "swarm";
  }
  if (dto.Type === PortainerStackKind.Compose) {
    return "standalone";
  }
  return "unknown";
}

/** Extract the stack id from either wire casing. */
export function dtoId(dto: PortainerStackDto): string | undefined {
  const id = dto.Id ?? dto.ID;
  return id !== undefined ? String(id) : undefined;
}

/** Map a wire DTO to the domain entity. `fallbackId` covers responses that omit the id. */
export function toStack(dto: PortainerStackDto, fallbackId?: string): Stack | null {
  const id = dtoId(dto) ?? fallbackId;
  if (id === undefined) {
    return null;
  }
  return Stack.create({
    id,
    name: dto.Name ?? "",
    type: resolveStackType(dto),
    endpointId: String(dto.EndpointId ?? dto.EndpointID ?? ""),
    version: dto.Version ?? undefined,
    isGitBacked: dto.GitConfig != null,
  });
}
