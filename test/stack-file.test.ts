import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkspaceFileReader } from "../src/domain";
import { StackFileResolver } from "../src/application/core/stack-file-resolver";
import { InvalidInputError } from "../src/domain";

class FakeFileReader implements WorkspaceFileReader {
  reads: string[] = [];

  constructor(private readonly files: Record<string, string> = {}) {}

  read(filePath: string): string {
    this.reads.push(filePath);
    const content = this.files[filePath];
    if (content === undefined) {
      throw new InvalidInputError(`File not found: ${filePath}`);
    }
    return content;
  }
}

test("prefers inline content and never touches the file port", () => {
  const files = new FakeFileReader({ "stack.yml": "from-file" });
  const resolver = new StackFileResolver(files);
  assert.equal(resolver.resolve("inline", "stack.yml", {}), "inline");
  assert.deepEqual(files.reads, []);
});

test("falls back to reading the workspace file", () => {
  const files = new FakeFileReader({ "stack.yml": "image: app" });
  const resolver = new StackFileResolver(files);
  assert.equal(resolver.resolve("", "stack.yml", {}), "image: app");
  assert.deepEqual(files.reads, ["stack.yml"]);
});

test("interpolates placeholders in the resolved content", () => {
  const files = new FakeFileReader({ "stack.yml": "image: ${IMAGE}" });
  const resolver = new StackFileResolver(files);
  const env = { WF_OUTPUT_IMAGE: "acme/app:1.2.3" };
  assert.equal(resolver.resolve("", "stack.yml", env), "image: acme/app:1.2.3");
});

test("fails when neither content nor file path is provided", () => {
  const resolver = new StackFileResolver(new FakeFileReader());
  assert.throws(() => resolver.resolve("", "", {}), InvalidInputError);
});
