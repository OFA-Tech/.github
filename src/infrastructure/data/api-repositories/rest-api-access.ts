/**
 * Fetch-based implementation of the {@link RestApiAccess} domain port — the
 * one place HTTP execution happens.
 *
 * Owns everything protocol-level once, for every API repository: URL and
 * query-string assembly, headers and authentication, JSON encoding/decoding,
 * request timeout, a bounded retry policy for idempotent requests, and the
 * mapping of failures to {@link UpstreamError}/{@link TimeoutError}.
 *
 * Named API clients (Portainer, Docker Hub, any future area) only build a
 * {@link RestApiRequest} describing *what* to call and delegate the *how*
 * here — they must not re-implement fetch/retry/error handling per repository.
 */
import { logger } from "../../../application/core/logger";
import type { RestApiAccess } from "../../../domain/interfaces/rest-api-access";
import type { RestApiRequest, RestApiResponse } from "../../../domain/models/rest-api";
import { TimeoutError, UpstreamError } from "../../../domain/shared-utils/errors";
import { sleep } from "../../../domain/shared-utils/sleep";
import { truncate } from "../../../domain/shared-utils/truncate";
import { buildUrl } from "../../../domain/shared-utils/url";

export interface RestApiAccessOptions {
  /** Service name used in error messages and logs. Default "API". */
  name?: string;
  /** Max attempts for retryable requests. Default 3. */
  maxRetries?: number;
  /** Base backoff in ms between retries. Default 500. */
  retryDelayMs?: number;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class FetchRestApiAccess implements RestApiAccess {
  private readonly name: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: RestApiAccessOptions = {}) {
    this.name = options.name ?? "API";
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  async request<T>(request: RestApiRequest): Promise<RestApiResponse<T>> {
    const url = buildUrl(request.url, request.query);
    const maxAttempts = request.retryable ? this.maxRetries : 1;

    let lastError: UpstreamError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.execute<T>(url, request);
      } catch (error) {
        if (!(error instanceof UpstreamError)) {
          throw error;
        }
        lastError = error;
        const retriable = error.status !== undefined && RETRYABLE_STATUS.has(error.status);
        if (!retriable || attempt === maxAttempts) {
          throw error;
        }
        const delay = this.retryDelayMs * attempt;
        logger.warn(`${this.name} request failed, retrying`, {
          url,
          method: request.method,
          status: error.status,
          attempt,
          nextDelayMs: delay,
        });
        await sleep(delay);
      }
    }
    // Unreachable, but satisfies the type checker.
    throw lastError ?? new UpstreamError(`${this.name} request failed`);
  }

  private async execute<T>(url: string, request: RestApiRequest): Promise<RestApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...request.headers,
    };
    if (request.authentication) {
      headers.Authorization = `${request.authentication.scheme} ${request.authentication.value}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal:
          request.timeoutMs !== undefined ? AbortSignal.timeout(request.timeoutMs) : undefined,
      });
    } catch (error) {
      if (isAbort(error)) {
        throw new TimeoutError(
          `${this.name} request timed out after ${request.timeoutMs}ms`,
          { url, method: request.method },
        );
      }
      throw error;
    }

    const text = await response.text();

    if (!response.ok) {
      throw new UpstreamError(`${this.name} API error (${response.status})`, {
        status: response.status,
        method: request.method,
        url,
        responseBody: truncate(text),
      });
    }

    return {
      statusCode: response.status,
      message: response.statusText,
      data: this.parse<T>(text, url),
      headers: collectHeaders(response),
    };
  }

  private parse<T>(text: string, url: string): T {
    if (!text) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new UpstreamError(`${this.name} returned a non-JSON response`, {
        url,
        responseBody: truncate(text),
      });
    }
  }
}

function collectHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
