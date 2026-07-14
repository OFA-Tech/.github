/**
 * Action entrypoint: Resolve OFA-Tech Actions Version.
 *
 * Thin orchestration around the resolve-actions-version use case: read the
 * run coordinates from the runner environment, resolve which version of the
 * actions repository this run references, and publish it as the `ref`
 * output for a follow-up checkout step.
 */
import { createGitHubWorkflowRuns } from "../../../infrastructure/cross-cutting/dependency-injections";
import { getRequired, getString, logger, runAction, setOutputs } from "../../core";

async function resolveActionsVersion(): Promise<void> {
  const token = getRequired("token");
  const actionsRepository = getString("actions-repository", "OFA-Tech/.github");
  const fallbackRef = getString("fallback-ref", "main");
  const runRepository = getString("run-repository", process.env.GITHUB_REPOSITORY ?? "");
  const runId = getString("run-id", process.env.GITHUB_RUN_ID ?? "");

  const github = createGitHubWorkflowRuns({ token });
  const result = await github.resolveActionsVersion.execute({
    runRepository,
    runId,
    actionsRepository,
    fallbackRef,
  });

  logger.info("Resolved actions version", {
    actionsRepository,
    ref: result.ref,
    matched: result.matched,
  });

  setOutputs({
    ref: result.ref,
    matched: result.matched,
  });
}

void runAction({ name: "github-resolve-actions-version" }, resolveActionsVersion);
