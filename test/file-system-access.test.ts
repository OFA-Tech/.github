import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { InvalidInputError } from "../src/domain";
import { NodeFileSystemAccess } from "../src/infrastructure/data/file-system-repository/file-system-access";
import { NodeWorkspaceFileReader } from "../src/infrastructure/data/file-system-repository/workspace-file-reader";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "fs-access-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("resolvePath keeps absolute paths and joins relative ones", () => {
  const files = new NodeFileSystemAccess();
  assert.equal(files.resolvePath("/base", "sub/file.yml"), join("/base", "sub/file.yml"));
  const absolute = join(tmpdir(), "stack.yml");
  assert.equal(files.resolvePath("/base", absolute), absolute);
});

test("readText returns file content", () => {
  withTempDir((dir) => {
    const file = join(dir, "stack.yml");
    writeFileSync(file, "image: app", "utf8");
    assert.equal(new NodeFileSystemAccess().readText(file), "image: app");
  });
});

test("readText throws InvalidInputError with the resolved path when missing", () => {
  const missing = join(tmpdir(), "does-not-exist.yml");
  assert.throws(
    () => new NodeFileSystemAccess().readText(missing),
    (error: unknown) => {
      assert.ok(error instanceof InvalidInputError);
      assert.equal(error.message, `File not found: ${missing}`);
      return true;
    },
  );
});

test("NodeWorkspaceFileReader resolves relative paths against GITHUB_WORKSPACE", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "stack.yml"), "image: app", "utf8");
    const reader = new NodeWorkspaceFileReader({ GITHUB_WORKSPACE: dir });
    assert.equal(reader.read("stack.yml"), "image: app");
  });
});
