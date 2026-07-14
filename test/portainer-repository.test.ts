import assert from "node:assert/strict";
import { test } from "node:test";
import { PreconditionError } from "../src/domain";
import { RollbackTarget } from "../src/domain";
import { StackEnvironment } from "../src/domain";
import type { PortainerClient } from "../src/infrastructure/data/api-repositories/portainer/client";
import {
  resolveStackType,
  toStack,
} from "../src/infrastructure/data/api-repositories/portainer/stack-mapper";
import { PortainerStackRepository } from "../src/infrastructure/data/api-repositories/portainer/stack-repository";

interface RecordedRequest {
  method: string;
  path: string;
  body?: unknown;
  query?: unknown;
}

/** Stub of the HTTP client that replays canned responses per path. */
function stubClient(responses: Record<string, unknown>) {
  const requests: RecordedRequest[] = [];
  const respond = (path: string) => {
    if (!(path in responses)) {
      throw new Error(`Unexpected request: ${path}`);
    }
    return Promise.resolve(responses[path]);
  };
  const client = {
    get: (path: string, query?: unknown) => {
      requests.push({ method: "GET", path, query });
      return respond(path);
    },
    post: (path: string, body: unknown, query?: unknown) => {
      requests.push({ method: "POST", path, body, query });
      return respond(path);
    },
    put: (path: string, body: unknown, query?: unknown) => {
      requests.push({ method: "PUT", path, body, query });
      return respond(path);
    },
  };
  return { client: client as unknown as PortainerClient, requests };
}

test("resolveStackType detects swarm via SwarmID", () => {
  assert.equal(resolveStackType({ SwarmID: "abc123" }), "swarm");
});

test("resolveStackType detects swarm via Type=1", () => {
  assert.equal(resolveStackType({ Type: 1 }), "swarm");
});

test("resolveStackType detects standalone via Type=2", () => {
  assert.equal(resolveStackType({ Type: 2 }), "standalone");
});

test("resolveStackType returns unknown when ambiguous", () => {
  assert.equal(resolveStackType({}), "unknown");
});

test("toStack normalizes duplicate wire casings", () => {
  const stack = toStack({ ID: 7, Name: "app", EndpointID: 3, Type: 2, GitConfig: {} });
  assert.equal(stack?.id, "7");
  assert.equal(stack?.endpointId, "3");
  assert.equal(stack?.type, "standalone");
  assert.equal(stack?.isGitBacked, true);
});

test("toStack returns null when no id can be resolved", () => {
  assert.equal(toStack({ Name: "app" }), null);
});

test("findByName filters by name and endpoint", async () => {
  const { client } = stubClient({
    "/api/stacks": [
      { Id: 1, Name: "app", EndpointId: 1 },
      { Id: 2, Name: "app", EndpointId: 2 },
    ],
  });
  const repo = new PortainerStackRepository(client);
  const match = await repo.findByName("app", "2");
  assert.equal(match?.id, "2");
});

test("findById treats a failed lookup as not found", async () => {
  const { client } = stubClient({});
  const repo = new PortainerStackRepository(client);
  assert.equal(await repo.findById("9"), null);
});

test("create posts to the standalone endpoint without SwarmID", async () => {
  const { client, requests } = stubClient({
    "/api/stacks/create/standalone/string": { Id: 10 },
  });
  const id = await new PortainerStackRepository(client).create({
    endpointId: "1",
    type: "standalone",
    name: "app",
    fileContent: "services: {}",
    env: StackEnvironment.none(),
  });
  assert.equal(id, "10");
  assert.deepEqual(requests[0].body, {
    Name: "app",
    StackFileContent: "services: {}",
    Env: [],
  });
  assert.deepEqual(requests[0].query, { endpointId: "1" });
});

test("create posts to the swarm endpoint with SwarmID", async () => {
  const { client, requests } = stubClient({
    "/api/stacks/create/swarm/string": { Id: 11 },
  });
  await new PortainerStackRepository(client).create({
    endpointId: "1",
    type: "swarm",
    name: "app",
    fileContent: "services: {}",
    swarmId: "sw1",
    env: StackEnvironment.fromJson('[{"name":"A","value":"B"}]'),
  });
  assert.deepEqual(requests[0].body, {
    Name: "app",
    StackFileContent: "services: {}",
    Env: [{ name: "A", value: "B" }],
    SwarmID: "sw1",
  });
});

test("create fails when the response carries no stack id", async () => {
  const { client } = stubClient({ "/api/stacks/create/standalone/string": {} });
  await assert.rejects(
    () =>
      new PortainerStackRepository(client).create({
        endpointId: "1",
        type: "standalone",
        name: "app",
        fileContent: "services: {}",
        env: StackEnvironment.none(),
      }),
    PreconditionError,
  );
});

test("updateFile omits Env when no environment was supplied", async () => {
  const { client, requests } = stubClient({ "/api/stacks/42": { Id: 42 } });
  await new PortainerStackRepository(client).updateFile({
    endpointId: "1",
    stackId: "42",
    fileContent: "services: {}",
    prune: true,
    repullImage: false,
    env: StackEnvironment.none(),
  });
  assert.deepEqual(requests[0].body, {
    StackFileContent: "services: {}",
    Prune: true,
    RepullImageAndRedeploy: false,
  });
});

test("updateFile falls back to the requested id when the response omits it", async () => {
  const { client } = stubClient({ "/api/stacks/42": {} });
  const id = await new PortainerStackRepository(client).updateFile({
    endpointId: "1",
    stackId: "42",
    fileContent: "services: {}",
    prune: false,
    repullImage: false,
    env: StackEnvironment.none(),
  });
  assert.equal(id, "42");
});

test("rollback puts the numeric target version", async () => {
  const { client, requests } = stubClient({ "/api/stacks/42/rollback": undefined });
  const repo = new PortainerStackRepository(client);
  await repo.rollback({
    endpointId: "1",
    stackId: "42",
    target: RollbackTarget.fromInput("3"),
    prune: false,
    repullImage: true,
  });
  assert.deepEqual(requests[0].body, {
    RollbackTo: 3,
    Prune: false,
    RepullImageAndRedeploy: true,
  });
});
