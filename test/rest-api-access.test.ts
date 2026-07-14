import assert from "node:assert/strict";
import { test } from "node:test";
import { TimeoutError, UpstreamError } from "../src/domain";
import { FetchRestApiAccess } from "../src/infrastructure/data/api-repositories/rest-api-access";

interface RecordedFetch {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/** Run `fn` with fetch stubbed to return canned responses in sequence. */
async function withFetch<T>(
  responses: Array<() => Response>,
  fn: (recorded: RecordedFetch[]) => Promise<T>,
): Promise<T> {
  const recorded: RecordedFetch[] = [];
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    recorded.push({
      url: String(url),
      method: init?.method,
      headers: init?.headers as Record<string, string>,
      body: init?.body,
    });
    const next = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return next();
  }) as typeof fetch;
  try {
    return await fn(recorded);
  } finally {
    globalThis.fetch = original;
  }
}

test("builds the URL from query params, skipping undefined and empty values", async () => {
  await withFetch([() => new Response("{}", { status: 200 })], async (recorded) => {
    await new FetchRestApiAccess().request({
      method: "GET",
      url: "https://api.example.com/things",
      query: { a: "1", b: undefined, c: "", d: 2 },
    });
    assert.equal(recorded[0].url, "https://api.example.com/things?a=1&d=2");
  });
});

test("sends JSON defaults, custom headers, authentication, and an encoded body", async () => {
  await withFetch([() => new Response("{}", { status: 200 })], async (recorded) => {
    await new FetchRestApiAccess().request({
      method: "POST",
      url: "https://api.example.com/things",
      headers: { "X-Custom": "yes" },
      authentication: { scheme: "Bearer", value: "token" },
      body: { Name: "app" },
    });
    assert.equal(recorded[0].method, "POST");
    assert.equal(recorded[0].headers?.["Content-Type"], "application/json");
    assert.equal(recorded[0].headers?.Accept, "application/json");
    assert.equal(recorded[0].headers?.["X-Custom"], "yes");
    assert.equal(recorded[0].headers?.Authorization, "Bearer token");
    assert.equal(recorded[0].body, '{"Name":"app"}');
  });
});

test("returns parsed data, status, reason phrase, and response headers", async () => {
  await withFetch(
    [
      () =>
        new Response('{"Id":7}', {
          status: 200,
          statusText: "OK",
          headers: { "x-request-id": "abc" },
        }),
    ],
    async () => {
      const response = await new FetchRestApiAccess().request<{ Id: number }>({
        method: "GET",
        url: "https://api.example.com/things/7",
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.message, "OK");
      assert.deepEqual(response.data, { Id: 7 });
      assert.equal(response.headers["x-request-id"], "abc");
    },
  );
});

test("returns undefined data for an empty body", async () => {
  await withFetch([() => new Response(null, { status: 204 })], async () => {
    const response = await new FetchRestApiAccess().request<undefined>({
      method: "GET",
      url: "https://api.example.com/empty",
    });
    assert.equal(response.data, undefined);
  });
});

test("maps a non-2xx response to UpstreamError with the service name and status", async () => {
  await withFetch([() => new Response("boom", { status: 500 })], async () => {
    await assert.rejects(
      () =>
        new FetchRestApiAccess({ name: "Portainer" }).request({
          method: "POST",
          url: "https://api.example.com/things",
        }),
      (error: unknown) => {
        assert.ok(error instanceof UpstreamError);
        assert.equal(error.message, "Portainer API error (500)");
        assert.equal(error.status, 500);
        return true;
      },
    );
  });
});

test("maps a non-JSON success body to UpstreamError", async () => {
  await withFetch([() => new Response("<html>", { status: 200 })], async () => {
    await assert.rejects(
      () =>
        new FetchRestApiAccess({ name: "Portainer" }).request({
          method: "GET",
          url: "https://api.example.com/things",
        }),
      (error: unknown) => {
        assert.ok(error instanceof UpstreamError);
        assert.equal(error.message, "Portainer returned a non-JSON response");
        return true;
      },
    );
  });
});

test("retries a retryable request on transient status until it succeeds", async () => {
  await withFetch(
    [
      () => new Response("busy", { status: 503 }),
      () => new Response('{"ok":true}', { status: 200 }),
    ],
    async (recorded) => {
      const response = await new FetchRestApiAccess({ retryDelayMs: 1 }).request<{ ok: boolean }>({
        method: "GET",
        url: "https://api.example.com/flaky",
        retryable: true,
      });
      assert.equal(recorded.length, 2);
      assert.deepEqual(response.data, { ok: true });
    },
  );
});

test("does not retry when the request is not marked retryable", async () => {
  await withFetch([() => new Response("busy", { status: 503 })], async (recorded) => {
    await assert.rejects(
      () =>
        new FetchRestApiAccess({ retryDelayMs: 1 }).request({
          method: "POST",
          url: "https://api.example.com/flaky",
        }),
      UpstreamError,
    );
    assert.equal(recorded.length, 1);
  });
});

test("does not retry non-transient statuses even when retryable", async () => {
  await withFetch([() => new Response("nope", { status: 400 })], async (recorded) => {
    await assert.rejects(
      () =>
        new FetchRestApiAccess({ retryDelayMs: 1 }).request({
          method: "GET",
          url: "https://api.example.com/bad",
          retryable: true,
        }),
      UpstreamError,
    );
    assert.equal(recorded.length, 1);
  });
});

test("maps an aborted request to TimeoutError", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    })) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        new FetchRestApiAccess({ name: "Portainer" }).request({
          method: "GET",
          url: "https://api.example.com/slow",
          timeoutMs: 10,
        }),
      (error: unknown) => {
        assert.ok(error instanceof TimeoutError);
        assert.equal(error.message, "Portainer request timed out after 10ms");
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
