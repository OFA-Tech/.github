import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidInputError, PreconditionError } from "../src/domain";
import { DeployStackUseCase } from "../src/application/portainer/use-cases/deploy-stack";
import { FindStackUseCase } from "../src/application/portainer/use-cases/find-stack";
import { RollbackStackUseCase } from "../src/application/portainer/use-cases/rollback-stack";
import { UpdateStackUseCase } from "../src/application/portainer/use-cases/update-stack";
import type {
  CreateStackCommand,
  GitRedeployCommand,
  RollbackCommand,
  StackRepository,
  UpdateStackFileCommand,
} from "../src/domain";
import { Stack, type StackProps } from "../src/domain";
import { StackEnvironment } from "../src/domain";

function stack(overrides: Partial<StackProps> = {}): Stack {
  return Stack.create({
    id: "42",
    name: "app",
    type: "swarm",
    endpointId: "1",
    isGitBacked: false,
    ...overrides,
  });
}

/** In-memory fake of the domain port, recording the commands it receives. */
class FakeStackRepository implements StackRepository {
  stacks: Stack[] = [];
  stackFileContent = "";
  createCommands: CreateStackCommand[] = [];
  redeployCommands: GitRedeployCommand[] = [];
  updateCommands: UpdateStackFileCommand[] = [];
  rollbackCommands: RollbackCommand[] = [];

  async findById(stackId: string): Promise<Stack | null> {
    return this.stacks.find((candidate) => candidate.id === stackId) ?? null;
  }

  async getById(stackId: string): Promise<Stack> {
    const found = await this.findById(stackId);
    if (!found) {
      throw new PreconditionError(`Unable to resolve stack ID for stack '${stackId}'`);
    }
    return found;
  }

  async findByName(name: string, endpointId?: string): Promise<Stack | null> {
    return (
      this.stacks.find(
        (candidate) =>
          candidate.name === name &&
          (endpointId === undefined || candidate.endpointId === endpointId),
      ) ?? null
    );
  }

  async getStackFileContent(): Promise<string> {
    return this.stackFileContent;
  }

  async create(command: CreateStackCommand): Promise<string> {
    this.createCommands.push(command);
    return "100";
  }

  async redeployFromGit(command: GitRedeployCommand): Promise<string> {
    this.redeployCommands.push(command);
    return command.stackId;
  }

  async updateFile(command: UpdateStackFileCommand): Promise<string> {
    this.updateCommands.push(command);
    return command.stackId;
  }

  async rollback(command: RollbackCommand): Promise<void> {
    this.rollbackCommands.push(command);
  }
}

test("FindStackUseCase finds by id", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "42", name: "app" })];
  const result = await new FindStackUseCase(repo).execute({ stackId: "42" });
  assert.equal(result.exists, true);
  assert.equal(result.stackId, "42");
  assert.equal(result.stackName, "app");
});

test("FindStackUseCase reports a missing id as not found", async () => {
  const result = await new FindStackUseCase(new FakeStackRepository()).execute({ stackId: "9" });
  assert.equal(result.exists, false);
});

test("FindStackUseCase finds by name scoped to an endpoint", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "1", name: "app", endpointId: "1" }), stack({ id: "2", name: "app", endpointId: "2" })];
  const result = await new FindStackUseCase(repo).execute({ stackName: "app", endpointId: "2" });
  assert.equal(result.stackId, "2");
});

test("FindStackUseCase requires stack-id or stack-name", async () => {
  await assert.rejects(
    () => new FindStackUseCase(new FakeStackRepository()).execute({}),
    InvalidInputError,
  );
});

test("DeployStackUseCase requires swarm-id for swarm deploys", async () => {
  await assert.rejects(
    () =>
      new DeployStackUseCase(new FakeStackRepository()).execute({
        endpointId: "1",
        stackType: "swarm",
        stackName: "app",
        stackFileContent: "services: {}",
        env: StackEnvironment.none(),
      }),
    InvalidInputError,
  );
});

test("DeployStackUseCase creates the stack and reports the new id", async () => {
  const repo = new FakeStackRepository();
  const result = await new DeployStackUseCase(repo).execute({
    endpointId: "1",
    stackType: "standalone",
    stackName: "app",
    stackFileContent: "services: {}",
    env: StackEnvironment.none(),
  });
  assert.deepEqual(result, { stackId: "100", operation: "deploy" });
  assert.equal(repo.createCommands.length, 1);
  assert.equal(repo.createCommands[0].name, "app");
});

test("UpdateStackUseCase prefers git redeploy for git-backed stacks", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "42", isGitBacked: true })];
  const result = await new UpdateStackUseCase(repo).execute({
    endpointId: "1",
    stackId: "42",
    stackFileContent: "",
    prune: true,
    repull: true,
    preferGitRedeploy: true,
    env: StackEnvironment.none(),
  });
  assert.deepEqual(result, { stackId: "42", operation: "update" });
  assert.equal(repo.redeployCommands.length, 1);
  assert.equal(repo.updateCommands.length, 0);
});

test("UpdateStackUseCase falls back to the current stack file when no content is given", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "42", isGitBacked: false })];
  repo.stackFileContent = "services: {current}";
  await new UpdateStackUseCase(repo).execute({
    endpointId: "1",
    stackId: "42",
    stackFileContent: "",
    prune: false,
    repull: false,
    preferGitRedeploy: true,
    env: StackEnvironment.none(),
  });
  assert.equal(repo.updateCommands[0].fileContent, "services: {current}");
});

test("UpdateStackUseCase fails when no content is given and none can be fetched", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "42", isGitBacked: false })];
  await assert.rejects(
    () =>
      new UpdateStackUseCase(repo).execute({
        endpointId: "1",
        stackId: "42",
        stackFileContent: "",
        prune: false,
        repull: false,
        preferGitRedeploy: false,
        env: StackEnvironment.none(),
      }),
    PreconditionError,
  );
});

test("RollbackStackUseCase defaults the target to the previous version", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "42", name: "app", endpointId: "1", version: 5 })];
  const result = await new RollbackStackUseCase(repo).execute({
    endpointId: "1",
    stackName: "app",
    prune: false,
    repull: false,
  });
  assert.deepEqual(result, { stackId: "42", rollbackTo: "4" });
  assert.equal(repo.rollbackCommands[0].target.version, 4);
});

test("RollbackStackUseCase honors an explicit target version", async () => {
  const repo = new FakeStackRepository();
  repo.stacks = [stack({ id: "42", name: "app", endpointId: "1", version: 5 })];
  const result = await new RollbackStackUseCase(repo).execute({
    endpointId: "1",
    stackName: "app",
    rollbackTo: "2",
    prune: false,
    repull: false,
  });
  assert.equal(result.rollbackTo, "2");
});

test("RollbackStackUseCase fails when the stack is missing", async () => {
  await assert.rejects(
    () =>
      new RollbackStackUseCase(new FakeStackRepository()).execute({
        endpointId: "1",
        stackName: "ghost",
        prune: false,
        repull: false,
      }),
    PreconditionError,
  );
});
