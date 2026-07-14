/**
 * Structured logging built on @actions/core.
 *
 * Wraps the GitHub Actions logging primitives (groups, debug, notice, warning,
 * error, secret masking) so action code has a single, consistent observability
 * surface instead of scattered `echo`/`console.log` calls.
 */
import * as core from "@actions/core";

export interface LogFields {
  [key: string]: unknown;
}

function format(message: string, fields?: LogFields): string {
  if (!fields || Object.keys(fields).length === 0) {
    return message;
  }
  const rendered = Object.entries(fields)
    .map(([key, value]) => `${key}=${stringify(value)}`)
    .join(" ");
  return `${message} | ${rendered}`;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    core.debug(format(message, fields));
  },

  info(message: string, fields?: LogFields): void {
    core.info(format(message, fields));
  },

  notice(message: string, fields?: LogFields): void {
    core.notice(format(message, fields));
  },

  warn(message: string, fields?: LogFields): void {
    core.warning(format(message, fields));
  },

  error(message: string, fields?: LogFields): void {
    core.error(format(message, fields));
  },

  /** Register a value to be masked from all subsequent log output. */
  mask(secret: string): void {
    if (secret) {
      core.setSecret(secret);
    }
  },

  /** Run `fn` inside a collapsible log group, even when it throws. */
  async group<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    return core.group(name, async () => fn());
  },
};

export type Logger = typeof logger;
