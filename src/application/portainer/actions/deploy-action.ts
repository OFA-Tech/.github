/**
 * Action entrypoint: Portainer Stack Deploy/Update.
 *
 * Orchestration only — input parsing, branching between deploy/update, and
 * output contract. Business rules live in `src/domain`, use cases in
 * `../use-cases`, side effects in `src/infrastructure/data`; wiring comes
 * from the dependency-injection factories in infrastructure/cross-cutting.
 */
import { StackEnvironment } from "../../../domain";
import {
  createPortainerStacks,
  createStackFileResolver,
} from "../../../infrastructure/cross-cutting/dependency-injections";
import {
  getBoolean,
  getEnum,
  getRequired,
  getString,
  InvalidInputError,
  logger,
  runAction,
  setOutputs,
} from "../../core";

async function deployUpdate(): Promise<void> {
  const baseUrl = getRequired("portainer-url");
  const apiKey = getRequired("api-key");
  const endpointId = getRequired("endpoint-id");
  const stackType = getEnum("stack-type", ["swarm", "standalone"] as const);
  const operation = getEnum("operation", ["deploy", "update"] as const, "deploy");

  const stackId = getString("stack-id");
  const stackName = getString("stack-name");
  const swarmId = getString("swarm-id");
  const env = StackEnvironment.fromJson(getString("env-json"));
  const prune = getBoolean("prune", false);
  const repull = getBoolean("repull-image-and-redeploy", true);
  const preferGitRedeploy = getBoolean("prefer-git-redeploy", true);

  const rawContent = getString("stack-file-content");
  const filePath = getString("stack-file-path");

  const portainer = createPortainerStacks({ baseUrl, apiKey });

  let stackFileContent = "";
  if (rawContent || filePath) {
    stackFileContent = createStackFileResolver().resolve(rawContent, filePath);
    await logger.group("Stack file content (interpolated)", () => {
      logger.info(stackFileContent);
    });
  }

  if (operation === "deploy") {
    if (!stackName) {
      throw new InvalidInputError("stack-name is required for deploy");
    }
    if (!stackFileContent) {
      throw new InvalidInputError("stack-file-content or stack-file-path is required for deploy");
    }
    const result = await portainer.deployStack.execute({
      endpointId,
      stackType,
      stackName,
      stackFileContent,
      swarmId,
      env,
    });
    setOutputs({ "stack-id": result.stackId, operation: result.operation });
    return;
  }

  if (!stackId) {
    throw new InvalidInputError("stack-id is required for update");
  }
  const result = await portainer.updateStack.execute({
    endpointId,
    stackId,
    stackFileContent,
    prune,
    repull,
    preferGitRedeploy,
    env,
  });
  setOutputs({ "stack-id": result.stackId, operation: result.operation });
}

void runAction({ name: "portainer-deploy" }, deployUpdate);
