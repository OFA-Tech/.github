/**
 * Action entrypoint: Portainer Stack Rollback.
 *
 * Thin orchestration around the rollback-stack use case: resolve inputs,
 * execute the rollback (explicit target or "current minus one"), and publish
 * the result as outputs. Business rules live in `src/domain`
 * (`RollbackTarget`), the use case in `../use-cases`, and the API adapter in
 * `src/infrastructure/data`.
 */
import { createPortainerStacks } from "../../../infrastructure/cross-cutting/dependency-injections";
import { getBoolean, getRequired, getString, runAction, setOutputs } from "../../core";

async function rollback(): Promise<void> {
  const baseUrl = getRequired("portainer-url");
  const apiKey = getRequired("api-key");
  const endpointId = getRequired("endpoint-id");
  const stackName = getRequired("stack-name");
  const rollbackTo = getString("rollback-to");
  const prune = getBoolean("prune", false);
  const repull = getBoolean("repull-image-and-redeploy", true);

  const portainer = createPortainerStacks({ baseUrl, apiKey });
  const result = await portainer.rollbackStack.execute({
    endpointId,
    stackName,
    rollbackTo: rollbackTo || undefined,
    prune,
    repull,
  });

  setOutputs({ "stack-id": result.stackId, "rollback-to": result.rollbackTo });
}

void runAction({ name: "portainer-rollback" }, rollback);
