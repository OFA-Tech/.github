/**
 * Type-safe action output writer.
 *
 * Wraps `core.setOutput` so an action declares its full output contract as a
 * single typed object, keeping the inter-step contract explicit and reviewable.
 */
import * as core from "@actions/core";
import { logger } from "./logger";

export function setOutputs(outputs: Record<string, string | number | boolean>): void {
  for (const [key, value] of Object.entries(outputs)) {
    core.setOutput(key, value);
    logger.debug("Set output", { key, value });
  }
}
