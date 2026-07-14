/**
 * Named API client for Docker Hub.
 *
 * Owns only what is Docker-Hub-specific — the base URL, HTTP Basic
 * authentication, secret masking, and the fact that its lookups are
 * idempotent — and delegates all transport mechanics to the
 * {@link RestApiAccess} port (fetch-based implementation by default).
 */
import { logger } from "../../../../application/core/logger";
import type { QueryParameters, RestApiAccess } from "../../../../domain";
import { FetchRestApiAccess } from "../rest-api-access";

export interface DockerHubClientOptions {
  username: string;
  token: string;
  /** Override for tests; defaults to the public Docker Hub API. */
  baseUrl?: string;
}

export class DockerHubClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly token: string;
  private readonly api: RestApiAccess;

  constructor(options: DockerHubClientOptions, api?: RestApiAccess) {
    this.baseUrl = (options.baseUrl ?? "https://hub.docker.com/v2").replace(/\/+$/, "");
    this.username = options.username;
    this.token = options.token;
    this.api = api ?? new FetchRestApiAccess({ name: "Docker Hub" });
    logger.mask(this.token);
  }

  /** Tag queries only make sense with credentials; callers degrade without them. */
  get hasCredentials(): boolean {
    return Boolean(this.username && this.token);
  }

  async get<T>(path: string, query?: QueryParameters): Promise<T> {
    const response = await this.api.request<T>({
      method: "GET",
      url: `${this.baseUrl}${path}`,
      query,
      authentication: {
        scheme: "Basic",
        value: Buffer.from(`${this.username}:${this.token}`).toString("base64"),
      },
      retryable: true,
    });
    return response.data;
  }
}
