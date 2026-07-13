/**
 * Action entrypoint: Portainer Stack Exists.
 *
 * Thin orchestration around the find-stack use case: resolve inputs, publish
 * the lookup result as outputs, and let the lookup model enforce the optional
 * expected-type rule.
 */
import { createPortainerStacks } from "../../../infrastructure/cross-cutting/dependency-injections";
import {
  getBoolean,
  getString,
  PreconditionError,
  runAction,
  setOutputs,
} from "../../core";

async function stackExists(): Promise<void> {
  const baseUrl = getString("portainer-url");
  const apiKey = getString("api-key");
  const endpointId = getString("endpoint-id");
  const stackId = getString("stack-id");
  const stackName = getString("stack-name");
  const expectedType = getString("stack-type");
  const failIfMissing = getBoolean("fail-if-missing", false);

  const portainer = createPortainerStacks({ baseUrl, apiKey });
  const result = await portainer.findStack.execute({ stackId, stackName, endpointId });

  if (!result.exists) {
    setOutputs({
      exists: false,
      "stack-id": "",
      "stack-name": "",
      "stack-type-resolved": "unknown",
    });
    if (failIfMissing) {
      throw new PreconditionError("Stack not found");
    }
    return;
  }

  result.ensureType(expectedType);

  setOutputs({
    exists: true,
    "stack-id": result.stackId,
    "stack-name": result.stackName,
    "stack-type-resolved": result.type,
  });
}

void runAction({ name: "portainer-stack-exists" }, stackExists);
