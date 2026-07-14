/**
 * Domain port for stack persistence/transport.
 *
 * Describes what the application layer needs from a stack backend in domain
 * vocabulary. The API repository in `infrastructure/data/api-repositories`
 * implements it; use cases depend only on this interface, so they can be unit
 * tested with an in-memory fake.
 */
import type { Stack } from "../entities/stack";
import type { StackType } from "../enums/stack-type";
import type { RollbackTarget } from "../models/rollback-target";
import type { StackEnvironment } from "../models/stack-environment";

export interface CreateStackCommand {
  endpointId: string;
  type: StackType;
  name: string;
  fileContent: string;
  swarmId?: string;
  env: StackEnvironment;
}

export interface GitRedeployCommand {
  endpointId: string;
  stackId: string;
  prune: boolean;
  repullImage: boolean;
}

export interface UpdateStackFileCommand {
  endpointId: string;
  stackId: string;
  fileContent: string;
  prune: boolean;
  repullImage: boolean;
  env: StackEnvironment;
}

export interface RollbackCommand {
  endpointId: string;
  stackId: string;
  target: RollbackTarget;
  prune: boolean;
  repullImage: boolean;
}

export interface StackRepository {
  /** Look a stack up by id. A missing id is "not found", not a failure. */
  findById(stackId: string): Promise<Stack | null>;
  /** Fetch a stack by id, failing loudly when it cannot be retrieved. */
  getById(stackId: string): Promise<Stack>;
  /** Find a stack by name, optionally scoped to an endpoint. */
  findByName(name: string, endpointId?: string): Promise<Stack | null>;
  /** Current deployed stack file content ("" when unavailable). */
  getStackFileContent(stackId: string): Promise<string>;
  /** Create a new stack; resolves to the new stack's id. */
  create(command: CreateStackCommand): Promise<string>;
  /** Redeploy a Git-backed stack; resolves to the stack's id. */
  redeployFromGit(command: GitRedeployCommand): Promise<string>;
  /** Update a stack from file content; resolves to the stack's id. */
  updateFile(command: UpdateStackFileCommand): Promise<string>;
  /** Roll a stack back to a previous file version. */
  rollback(command: RollbackCommand): Promise<void>;
}
