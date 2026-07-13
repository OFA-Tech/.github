import assert from "node:assert/strict";
import { test } from "node:test";
import { ScopedVariables } from "../src/domain";
import { Template } from "../src/domain";

function render(content: string, env: Record<string, string | undefined>): string {
  return new Template(content).render(new ScopedVariables(env));
}

test("expands a workflow output placeholder", () => {
  const env = { WF_OUTPUT_DOCKER_IMAGE: "acme/app:1.2.3" };
  assert.equal(render("image: ${DOCKER_IMAGE}", env), "image: acme/app:1.2.3");
});

test("honors scope precedence (WF_OUTPUT over SECRET over ENV)", () => {
  const env = {
    WF_OUTPUT_TOKEN: "from-wf",
    SECRET_TOKEN: "from-secret",
    ENV_TOKEN: "from-env",
  };
  assert.equal(new ScopedVariables(env).resolve("TOKEN", "fallback"), "from-wf");
});

test("uses inline default when unresolved", () => {
  assert.equal(render("port: ${HTTP_PORT:-8080}", {}), "port: 8080");
});

test("normalizes dotted/hyphenated names to scoped env keys", () => {
  const env = { VAR_MY_APP_NAME: "billing" };
  assert.equal(render("name: ${my-app.name}", env), "name: billing");
});

test("expands multiple occurrences", () => {
  const env = { ENV_REGION: "us-east-1" };
  assert.equal(render("${REGION}-${REGION}", env), "us-east-1-us-east-1");
});
