import assert from "node:assert/strict";
import { test } from "node:test";
import type { RestApiAccess, RestApiRequest } from "../src/domain";
import { PortainerClient } from "../src/infrastructure/data/api-repositories/portainer/client";

/** Fake of the REST access port recording the requests it receives. */
function fakeAccess(data: unknown = {}) {
  const requests: RestApiRequest[] = [];
  const access: RestApiAccess = {
    request: async <T>(request: RestApiRequest) => {
      requests.push(request);
      return { statusCode: 200, message: "OK", data: data as T, headers: {} };
    },
  };
  return { access, requests };
}

test("get builds a Portainer request: normalized URL, API key, retryable", async () => {
  const { access, requests } = fakeAccess([{ Id: 1 }]);
  const client = new PortainerClient(
    { baseUrl: "https://portainer.example.com///", apiKey: "secret" },
    access,
  );
  const result = await client.get<Array<{ Id: number }>>("/api/stacks", { endpointId: "2" });

  assert.deepEqual(result, [{ Id: 1 }]);
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].url, "https://portainer.example.com/api/stacks");
  assert.deepEqual(requests[0].query, { endpointId: "2" });
  assert.deepEqual(requests[0].headers, { "X-API-Key": "secret" });
  assert.equal(requests[0].retryable, true);
});

test("post and put are not retryable and carry the body", async () => {
  const { access, requests } = fakeAccess({ Id: 5 });
  const client = new PortainerClient(
    { baseUrl: "https://portainer.example.com", apiKey: "secret" },
    access,
  );
  await client.post("/api/stacks/create/standalone/string", { Name: "app" });
  await client.put("/api/stacks/5", { Prune: true });

  assert.equal(requests[0].method, "POST");
  assert.deepEqual(requests[0].body, { Name: "app" });
  assert.notEqual(requests[0].retryable, true);
  assert.equal(requests[1].method, "PUT");
  assert.deepEqual(requests[1].body, { Prune: true });
  assert.notEqual(requests[1].retryable, true);
});
