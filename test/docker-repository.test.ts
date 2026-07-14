import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileSystemAccess, RestApiAccess, RestApiRequest } from "../src/domain";
import { ImageCoordinates, UpstreamError } from "../src/domain";
import { DockerHubClient } from "../src/infrastructure/data/api-repositories/docker-hub/client";
import { DockerHubTagRepository } from "../src/infrastructure/data/api-repositories/docker-hub/tag-repository";
import { GitHubSourceBranchAccess } from "../src/infrastructure/data/command-line-repository/source-branch-access";

const coordinates = ImageCoordinates.create("docker.io", "acme", "app");

/** Fake of the REST access port recording requests and replaying answers. */
function fakeAccess(handler: (request: RestApiRequest) => unknown) {
  const requests: RestApiRequest[] = [];
  const access: RestApiAccess = {
    request: async <T>(request: RestApiRequest) => {
      requests.push(request);
      return { statusCode: 200, message: "OK", data: handler(request) as T, headers: {} };
    },
  };
  return { access, requests };
}

function client(access: RestApiAccess) {
  return new DockerHubClient({ username: "user", token: "token" }, access);
}

test("listTags queries the hub tags endpoint with basic auth and page size", async () => {
  const { access, requests } = fakeAccess(() => ({
    results: [{ name: "1.0.1-20260101" }, { name: "latest" }, {}],
  }));
  const tags = await new DockerHubTagRepository(client(access)).listTags(coordinates);

  assert.deepEqual(tags, ["1.0.1-20260101", "latest"]);
  assert.equal(requests[0].url, "https://hub.docker.com/v2/repositories/acme/app/tags");
  assert.deepEqual(requests[0].query, { page_size: 100 });
  assert.equal(requests[0].authentication?.scheme, "Basic");
  assert.equal(
    requests[0].authentication?.value,
    Buffer.from("user:token").toString("base64"),
  );
  assert.equal(requests[0].retryable, true);
});

test("listTags degrades to an empty list without credentials or on API failure", async () => {
  const { access } = fakeAccess(() => ({ results: [{ name: "1.0.0-20260101" }] }));
  const noCredentials = new DockerHubClient({ username: "", token: "" }, access);
  assert.deepEqual(await new DockerHubTagRepository(noCredentials).listTags(coordinates), []);

  const failing: RestApiAccess = {
    request: async () => {
      throw new UpstreamError("Docker Hub API error (500)", { status: 500 });
    },
  };
  assert.deepEqual(await new DockerHubTagRepository(client(failing)).listTags(coordinates), []);
});

test("tagExists is true on a successful lookup and false on failure", async () => {
  const { access, requests } = fakeAccess(() => ({}));
  const repository = new DockerHubTagRepository(client(access));
  assert.equal(await repository.tagExists(coordinates, "1.0.1-20260101"), true);
  assert.equal(
    requests[0].url,
    "https://hub.docker.com/v2/repositories/acme/app/tags/1.0.1-20260101/",
  );

  const failing: RestApiAccess = {
    request: async () => {
      throw new UpstreamError("Docker Hub API error (404)", { status: 404 });
    },
  };
  assert.equal(
    await new DockerHubTagRepository(client(failing)).tagExists(coordinates, "1.0.1-20260101"),
    false,
  );
});

function fakeFiles(contents: Record<string, string>): FileSystemAccess {
  return {
    resolvePath: (_base, filePath) => filePath,
    readText: (filePath) => {
      const content = contents[filePath];
      if (content === undefined) {
        throw new Error(`File not found: ${filePath}`);
      }
      return content;
    },
  };
}

test("source branch detection prefers GITHUB_HEAD_REF", async () => {
  const access = new GitHubSourceBranchAccess(
    { GITHUB_HEAD_REF: "feature/login", GITHUB_EVENT_PATH: "/event.json" },
    fakeFiles({ "/event.json": '{"pull_request":{"head":{"ref":"other"}}}' }),
  );
  assert.equal(await access.detect(), "feature/login");
});

test("source branch detection falls back to the event payload", async () => {
  const access = new GitHubSourceBranchAccess(
    { GITHUB_EVENT_PATH: "/event.json" },
    fakeFiles({ "/event.json": '{"pull_request":{"head":{"ref":"fix/crash"}}}' }),
  );
  assert.equal(await access.detect(), "fix/crash");

  const bare = new GitHubSourceBranchAccess(
    { GITHUB_EVENT_PATH: "/event.json" },
    fakeFiles({ "/event.json": '{"head_ref":"feat/api"}' }),
  );
  assert.equal(await bare.detect(), "feat/api");
});

test("source branch detection tolerates a missing or malformed event payload", async () => {
  const malformed = new GitHubSourceBranchAccess(
    { GITHUB_HEAD_REF: "", GITHUB_EVENT_PATH: "/event.json" },
    fakeFiles({ "/event.json": "not json" }),
  );
  // Falls through to the commit-subject probe, which yields nothing useful here.
  const branch = await malformed.detect();
  assert.equal(typeof branch, "string");
});
