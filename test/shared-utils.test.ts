import assert from "node:assert/strict";
import { test } from "node:test";
import { Placeholder } from "../src/domain/models/placeholder";
import { isValidVariableName, toEnvKey } from "../src/domain/shared-utils/env-key";
import { truncate } from "../src/domain/shared-utils/truncate";
import { buildUrl } from "../src/domain/shared-utils/url";

test("truncate leaves short values untouched", () => {
  assert.equal(truncate("short", 10), "short");
});

test("truncate cuts long values and appends an ellipsis", () => {
  assert.equal(truncate("abcdefgh", 5), "abcde…");
});

test("toEnvKey normalizes dots, hyphens, and case", () => {
  assert.equal(toEnvKey("my-app.name"), "MY_APP_NAME");
});

test("isValidVariableName accepts identifiers and rejects punctuation", () => {
  assert.equal(isValidVariableName("MY_VAR1"), true);
  assert.equal(isValidVariableName("1BAD"), false);
  assert.equal(isValidVariableName("my-app.name"), false);
});

test("buildUrl appends query params, skipping undefined and empty values", () => {
  assert.equal(
    buildUrl("https://api.example.com/things", { a: "1", b: undefined, c: "", d: 2 }),
    "https://api.example.com/things?a=1&d=2",
  );
});

test("Placeholder.findNext parses a bare placeholder", () => {
  const placeholder = Placeholder.findNext("image: ${IMAGE} rest");
  assert.equal(placeholder?.raw, "${IMAGE}");
  assert.equal(placeholder?.name, "IMAGE");
  assert.equal(placeholder?.fallback, "");
});

test("Placeholder.findNext parses an inline default", () => {
  const placeholder = Placeholder.findNext("port: ${HTTP_PORT:-8080}");
  assert.equal(placeholder?.name, "HTTP_PORT");
  assert.equal(placeholder?.fallback, "8080");
});

test("Placeholder.findNext returns null when nothing remains", () => {
  assert.equal(Placeholder.findNext("no placeholders here"), null);
});
