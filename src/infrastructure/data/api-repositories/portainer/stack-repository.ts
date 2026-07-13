/**
 * API repository implementing the {@link StackRepository} domain port.
 *
 * Owns the Portainer API surface — which paths to call and which request
 * bodies to send. DTO → domain mapping lives in `stack-mapper.ts`; transport
 * mechanics live in the shared REST access service behind the client.
 */
import {
  PreconditionError,
  type CreateStackCommand,
  type GitRedeployCommand,
  type RollbackCommand,
  type Stack,
  type StackRepository,
  type UpdateStackFileCommand,
} from "../../../../domain";
import type { PortainerStackDto, StackFileResponseDto } from "./api-types";
import type { PortainerClient } from "./client";
import { dtoId, toStack } from "./stack-mapper";

export class PortainerStackRepository implements StackRepository {
  constructor(private readonly client: PortainerClient) {}

  async findById(stackId: string): Promise<Stack | null> {
    try {
      const dto = await this.client.get<PortainerStackDto>(`/api/stacks/${stackId}`);
      return toStack(dto);
    } catch {
      // A missing id is a "not found", not a hard failure.
      return null;
    }
  }

  async getById(stackId: string): Promise<Stack> {
    const dto = await this.client.get<PortainerStackDto>(`/api/stacks/${stackId}`);
    const stack = toStack(dto, stackId);
    if (!stack) {
      throw new PreconditionError(`Unable to resolve stack ID for stack '${stackId}'`);
    }
    return stack;
  }

  async findByName(name: string, endpointId?: string): Promise<Stack | null> {
    const dtos = await this.client.get<PortainerStackDto[]>("/api/stacks");
    const match = dtos.find((dto) => {
      if (dto.Name !== name) {
        return false;
      }
      if (endpointId === undefined) {
        return true;
      }
      return String(dto.EndpointId ?? dto.EndpointID ?? "") === endpointId;
    });
    return match ? toStack(match) : null;
  }

  async getStackFileContent(stackId: string): Promise<string> {
    const file = await this.client.get<StackFileResponseDto>(`/api/stacks/${stackId}/file`);
    return file.StackFileContent ?? "";
  }

  async create(command: CreateStackCommand): Promise<string> {
    const path =
      command.type === "standalone"
        ? "/api/stacks/create/standalone/string"
        : "/api/stacks/create/swarm/string";
    const body: Record<string, unknown> = {
      Name: command.name,
      StackFileContent: command.fileContent,
      Env: command.env.toArray(),
    };
    if (command.type === "swarm") {
      body.SwarmID = command.swarmId;
    }

    const dto = await this.client.post<PortainerStackDto>(path, body, {
      endpointId: command.endpointId,
    });
    const id = dtoId(dto);
    if (id === undefined) {
      throw new PreconditionError("Unable to read created stack ID from Portainer response");
    }
    return id;
  }

  async redeployFromGit(command: GitRedeployCommand): Promise<string> {
    const dto = await this.client.put<PortainerStackDto>(
      `/api/stacks/${command.stackId}/git/redeploy`,
      { Prune: command.prune, RepullImageAndRedeploy: command.repullImage },
      { endpointId: command.endpointId },
    );
    return dtoId(dto) ?? command.stackId;
  }

  async updateFile(command: UpdateStackFileCommand): Promise<string> {
    const body: Record<string, unknown> = {
      StackFileContent: command.fileContent,
      Prune: command.prune,
      RepullImageAndRedeploy: command.repullImage,
    };
    if (command.env.isDefined) {
      body.Env = command.env.toArray();
    }

    const dto = await this.client.put<PortainerStackDto>(
      `/api/stacks/${command.stackId}`,
      body,
      { endpointId: command.endpointId },
    );
    return dtoId(dto) ?? command.stackId;
  }

  async rollback(command: RollbackCommand): Promise<void> {
    await this.client.put(
      `/api/stacks/${command.stackId}/rollback`,
      {
        RollbackTo: command.target.version,
        Prune: command.prune,
        RepullImageAndRedeploy: command.repullImage,
      },
      { endpointId: command.endpointId },
    );
  }
}
