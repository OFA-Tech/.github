/**
 * Named API client for Portainer.
 *
 * Owns only what is Portainer-specific — base URL normalization, the
 * `X-API-Key` auth header, secret masking, and which calls are idempotent —
 * and delegates all transport mechanics to the {@link RestApiAccess} port
 * (fetch-based implementation by default).
 */
import { logger } from "../../../../application/core/logger";
import type {
  ApiRequestMethod,
  QueryParameters,
  RestApiAccess,
  RestApiRequest,
} from "../../../../domain";
import { FetchRestApiAccess } from "../rest-api-access";

export interface PortainerClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Max attempts for idempotent requests (GET). Default 3. */
  maxRetries?: number;
  /** Base backoff in ms between retries. Default 500. */
  retryDelayMs?: number;
}

export class PortainerClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly api: RestApiAccess;

  constructor(options: PortainerClientOptions, api?: RestApiAccess) {
    // Trailing slashes break path concatenation against the Portainer API.
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.api =
      api ??
      new FetchRestApiAccess({
        name: "Portainer",
        maxRetries: options.maxRetries,
        retryDelayMs: options.retryDelayMs,
      });
    logger.mask(this.apiKey);
  }

  async get<T>(path: string, query?: QueryParameters): Promise<T> {
    return this.send<T>({ method: "GET", path, query, retryable: true });
  }

  async post<T>(path: string, body: unknown, query?: QueryParameters): Promise<T> {
    return this.send<T>({ method: "POST", path, query, body });
  }

  async put<T>(path: string, body: unknown, query?: QueryParameters): Promise<T> {
    return this.send<T>({ method: "PUT", path, query, body });
  }

  private async send<T>(options: {
    method: ApiRequestMethod;
    path: string;
    query?: QueryParameters;
    body?: unknown;
    retryable?: boolean;
  }): Promise<T> {
    const request: RestApiRequest = {
      method: options.method,
      url: `${this.baseUrl}${options.path}`,
      query: options.query,
      headers: { "X-API-Key": this.apiKey },
      body: options.body,
      retryable: options.retryable,
    };
    const response = await this.api.request<T>(request);
    return response.data;
  }
}
