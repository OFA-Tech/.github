/**
 * Composition root for the Portainer bounded context: wires the HTTP adapter
 * into the domain port and hands back ready-to-run use cases.
 */
import {
  DeployStackUseCase,
  FindStackUseCase,
  RollbackStackUseCase,
  UpdateStackUseCase,
} from "../../../application/portainer/use-cases";
import { PortainerClient, type PortainerClientOptions } from "../../data/api-repositories/portainer/client";
import { PortainerStackRepository } from "../../data/api-repositories/portainer/stack-repository";

/** The wired use cases an action entrypoint works with. */
export interface PortainerStacks {
  findStack: FindStackUseCase;
  deployStack: DeployStackUseCase;
  updateStack: UpdateStackUseCase;
  rollbackStack: RollbackStackUseCase;
}

export function createPortainerStacks(options: PortainerClientOptions): PortainerStacks {
  const repository = new PortainerStackRepository(new PortainerClient(options));
  return {
    findStack: new FindStackUseCase(repository),
    deployStack: new DeployStackUseCase(repository),
    updateStack: new UpdateStackUseCase(repository),
    rollbackStack: new RollbackStackUseCase(repository),
  };
}
