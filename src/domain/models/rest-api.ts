/**
 * Request/response models for the REST access contract.
 *
 * These describe *what* an API call is — method, target, parameters,
 * authentication, body — independent of how it is executed. The execution
 * (fetch, retries, error mapping) lives in infrastructure.
 */
import type { ApiRequestMethod } from "../enums/api-request-method";
import type { QueryParameters } from "../shared-utils/url";

/** Sets the standard `Authorization: <scheme> <value>` header. */
export interface ApiAuthentication {
  scheme: string;
  value: string;
}

export interface RestApiRequest {
  method: ApiRequestMethod;
  /** Absolute URL; entries from `query` are appended as search parameters. */
  url: string;
  /** Query parameters; `undefined` and empty values are skipped. */
  query?: QueryParameters;
  /** Extra headers (e.g. API-key headers) merged over the JSON defaults. */
  headers?: Record<string, string>;
  authentication?: ApiAuthentication;
  /** JSON-encoded into the request body when defined. */
  body?: unknown;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Retry on transient failure. Only safe for idempotent calls. */
  retryable?: boolean;
}

export interface RestApiResponse<T> {
  statusCode: number;
  /** HTTP reason phrase. */
  message: string;
  data: T;
  headers: Record<string, string>;
}
