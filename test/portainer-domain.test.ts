import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidInputError, PreconditionError } from "../src/domain";
import { RollbackTarget } from "../src/domain";
import { Stack, StackLookup } from "../src/domain";
import { StackEnvironment } from "../src/domain";

function stack(overrides: Partial<Parameters<typeof Stack.create>[0]> = {}): Stack {
  return Stack.create({
    id: "42",
    name: "app",
    type: "swarm",
    endpointId: "1",
    isGitBacked: false,
    ...overrides,
  });
}

test("Stack.create rejects a missing id", () => {
  assert.throws(() => stack({ id: "" }), PreconditionError);
});

test("StackEnvironment.fromJson returns 'none' for empty input", () => {
  const env = StackEnvironment.fromJson("");
  assert.equal(env.isDefined, false);
  assert.deepEqual(env.toArray(), []);
});

test("StackEnvironment.fromJson parses a valid array", () => {
  const env = StackEnvironment.fromJson('[{"name":"A","value":"B"}]');
  assert.equal(env.isDefined, true);
  assert.deepEqual(env.toArray(), [{ name: "A", value: "B" }]);
});

test("StackEnvironment.fromJson rejects invalid JSON", () => {
  assert.throws(() => StackEnvironment.fromJson("{not json"), InvalidInputError);
});

test("StackEnvironment.fromJson rejects non-array JSON", () => {
  assert.throws(() => StackEnvironment.fromJson('{"name":"A"}'), InvalidInputError);
});

test("RollbackTarget.fromInput accepts a numeric version", () => {
  assert.equal(RollbackTarget.fromInput("7").version, 7);
});

test("RollbackTarget.fromInput rejects non-numeric input", () => {
  assert.throws(() => RollbackTarget.fromInput("v7"), InvalidInputError);
});

test("RollbackTarget.previousOf computes current minus one", () => {
  assert.equal(RollbackTarget.previousOf(stack({ version: 5 })).version, 4);
});

test("RollbackTarget.previousOf requires a known stack version", () => {
  assert.throws(() => RollbackTarget.previousOf(stack({ version: undefined })), InvalidInputError);
});

test("RollbackTarget.previousOf rejects versions without a predecessor", () => {
  assert.throws(() => RollbackTarget.previousOf(stack({ version: 1 })), PreconditionError);
});

test("StackLookup exposes empty fields when not found", () => {
  const lookup = StackLookup.notFound();
  assert.equal(lookup.exists, false);
  assert.equal(lookup.stackId, "");
  assert.equal(lookup.stackName, "");
  assert.equal(lookup.type, "unknown");
});

test("StackLookup.ensureType passes on match or when no expectation is set", () => {
  const lookup = StackLookup.of(stack({ type: "swarm" }));
  lookup.ensureType("");
  lookup.ensureType("swarm");
});

test("StackLookup.ensureType throws on mismatch", () => {
  const lookup = StackLookup.of(stack({ type: "standalone" }));
  assert.throws(() => lookup.ensureType("swarm"), PreconditionError);
});
