import assert from "node:assert/strict";
import { test } from "node:test";
import { ResolveActionsVersionUseCase } from "../src/application/github/use-cases/resolve-actions-version";
import { InvalidInputError, ReferencedWorkflow } from "../src/domain";
import type { WorkflowRunRepository } from "../src/domain";

/** In-memory fake of the workflow-run port. */
function fakeRuns(workflows: ReferencedWorkflow[] = []): WorkflowRunRepository {
  return { referencedWorkflows: async () => workflows };
}

const baseQuery = {
  runRepository: "OFA-Tech/SPAB",
  runId: "12345",
  actionsRepository: "OFA-Tech/.github",
  fallbackRef: "main",
};

test("referenced workflow exposes its repository and prefers sha for checkout", () => {
  const workflow = new ReferencedWorkflow(
    "OFA-Tech/.github/.github/workflows/ci-cd.yml@refs/heads/feat/x",
    "975ac29a63eda1a5bf1397cc9874f88f77c2f19e",
    "refs/heads/feat/x",
  );
  assert.equal(workflow.repository, "OFA-Tech/.github");
  assert.equal(workflow.belongsTo("ofa-tech/.GITHUB"), true);
  assert.equal(workflow.checkoutRef, "975ac29a63eda1a5bf1397cc9874f88f77c2f19e");
});

test("referenced workflow falls back to the symbolic ref when sha is missing", () => {
  const workflow = new ReferencedWorkflow(
    "OFA-Tech/.github/.github/workflows/ci-cd.yml@refs/heads/main",
    "",
    "refs/heads/main",
  );
  assert.equal(workflow.checkoutRef, "refs/heads/main");
});

test("resolves the sha of the referenced actions repository workflow", async () => {
  const useCase = new ResolveActionsVersionUseCase(
    fakeRuns([
      new ReferencedWorkflow(
        "Other-Org/tools/.github/workflows/shared.yml@refs/heads/main",
        "aaa111",
        "refs/heads/main",
      ),
      new ReferencedWorkflow(
        "OFA-Tech/.github/.github/workflows/ci-cd.yml@refs/heads/feat/x",
        "bbb222",
        "refs/heads/feat/x",
      ),
    ]),
  );

  const result = await useCase.execute(baseQuery);
  assert.deepEqual(result, { ref: "bbb222", matched: true });
});

test("falls back when the run references nothing from the actions repository", async () => {
  const useCase = new ResolveActionsVersionUseCase(
    fakeRuns([
      new ReferencedWorkflow(
        "Other-Org/tools/.github/workflows/shared.yml@refs/heads/main",
        "aaa111",
      ),
    ]),
  );

  const result = await useCase.execute(baseQuery);
  assert.deepEqual(result, { ref: "main", matched: false });
});

test("falls back when the run references no workflows at all", async () => {
  const useCase = new ResolveActionsVersionUseCase(fakeRuns());

  const result = await useCase.execute({ ...baseQuery, fallbackRef: "v1" });
  assert.deepEqual(result, { ref: "v1", matched: false });
});

test("skips referenced entries that carry neither sha nor ref", async () => {
  const useCase = new ResolveActionsVersionUseCase(
    fakeRuns([
      new ReferencedWorkflow("OFA-Tech/.github/.github/workflows/ci-cd.yml@refs/heads/main"),
    ]),
  );

  const result = await useCase.execute(baseQuery);
  assert.deepEqual(result, { ref: "main", matched: false });
});

test("rejects missing run coordinates", async () => {
  const useCase = new ResolveActionsVersionUseCase(fakeRuns());

  await assert.rejects(
    useCase.execute({ ...baseQuery, runId: "" }),
    InvalidInputError,
  );
  await assert.rejects(
    useCase.execute({ ...baseQuery, runRepository: "" }),
    InvalidInputError,
  );
  await assert.rejects(
    useCase.execute({ ...baseQuery, actionsRepository: "" }),
    InvalidInputError,
  );
});
