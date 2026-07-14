/**
 * Centralized error model and process exit codes.
 *
 * Every failure path in the action library should surface as an {@link ActionError}
 * (or a subclass) so that the {@link runAction} wrapper can render a consistent,
 * observable message and translate the failure into a deterministic exit code.
 */

/**
 * Stable exit codes shared across every TypeScript action.
 *
 * Keep these aligned with the documented contract in CONTRIBUTING.md — consumer
 * repositories and dashboards may branch on the numeric value.
 */
export enum ExitCode {
  Success = 0,
  /** Generic, uncategorized failure. */
  Failure = 1,
  /** Caller supplied invalid or conflicting inputs. */
  InvalidInput = 2,
  /** A downstream HTTP/API dependency returned an error. */
  UpstreamError = 3,
  /** A required precondition (resource, command, permission) was not met. */
  PreconditionFailed = 4,
  /** The operation timed out or exhausted its retry budget. */
  Timeout = 5,
}

/** Base error carrying an {@link ExitCode} and optional structured details. */
export class ActionError extends Error {
  readonly exitCode: ExitCode;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    exitCode: ExitCode = ExitCode.Failure,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
    this.details = details;
  }
}

/** Caller supplied invalid, missing, or mutually exclusive inputs. */
export class InvalidInputError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ExitCode.InvalidInput, details);
  }
}

/** A required precondition was not satisfied before the operation could run. */
export class PreconditionError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ExitCode.PreconditionFailed, details);
  }
}

/** A downstream HTTP API returned a non-success response. */
export class UpstreamError extends ActionError {
  readonly status?: number;

  constructor(
    message: string,
    details?: Record<string, unknown> & { status?: number },
  ) {
    super(message, ExitCode.UpstreamError, details);
    this.status = details?.status;
  }
}

/** The operation timed out before completing. */
export class TimeoutError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ExitCode.Timeout, details);
  }
}

/** Normalize an unknown thrown value into an {@link ActionError}. */
export function toActionError(error: unknown): ActionError {
  if (error instanceof ActionError) {
    return error;
  }
  if (error instanceof Error) {
    const wrapped = new ActionError(error.message);
    wrapped.stack = error.stack;
    return wrapped;
  }
  return new ActionError(String(error));
}
