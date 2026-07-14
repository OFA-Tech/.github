/**
 * Central action entrypoint wrapper.
 *
 * Every TypeScript action's `index.ts` delegates to {@link runAction}. This is
 * the one place that owns cross-cutting concerns: timing, structured failure
 * rendering, exit-code translation, and `core.setFailed` reporting. Action
 * bodies stay focused on their domain logic and simply throw on failure.
 */
import * as core from "@actions/core";
import { ExitCode, toActionError } from "../../domain/shared-utils/errors";
import { logger } from "./logger";

export interface RunOptions {
  /** Human-readable action name used in observability output. */
  name: string;
}

/**
 * Execute an action body with centralized error handling and observability.
 *
 * On success the process exits 0. On failure the error is normalized to an
 * {@link ActionError}, logged with its structured details, reported via
 * `core.setFailed`, and the process exits with the error's {@link ExitCode}.
 */
export async function runAction(
  options: RunOptions,
  body: () => Promise<void>,
): Promise<void> {
  const startedAt = Date.now();
  logger.debug(`Starting action`, { action: options.name });

  try {
    await body();
    logger.info(`Action completed`, {
      action: options.name,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const actionError = toActionError(error);
    logger.error(actionError.message, {
      action: options.name,
      exitCode: actionError.exitCode,
      durationMs: Date.now() - startedAt,
      ...actionError.details,
    });
    if (actionError.stack) {
      core.debug(actionError.stack);
    }
    core.setFailed(actionError.message);
    process.exitCode = actionError.exitCode || ExitCode.Failure;
  }
}
