/**
 * Named API client for the GitHub REST API.
 *
 * Owns only what is GitHub-specific — the base URL (honouring
 * `GITHUB_API_URL` so GHES works), Bearer authentication, the API version
 * header, secret masking, and the fact that its lookups are idempotent —
 * and delegates all transport mechanics to the {@link RestApiAccess} port.
 */
import { logger } from "../../../../application/core/logger";
import type { QueryParameters, RestApiAccess } from "../../../../domain";
import { FetchRestApiAccess } from "../rest-api-access";

export interface GitHubClientOptions {
  token: string;
  /** Override for tests/GHES; defaults to `GITHUB_API_URL` or the public API. */
  baseUrl?: string;
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly api: RestApiAccess;

  constructor(options: GitHubClientOptions, api?: RestApiAccess) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.GITHUB_API_URL ??
      "https://api.github.com"
    ).replace(/\/+$/, "");
    this.token = options.token;
    this.api = api ?? new FetchRestApiAccess({ name: "GitHub" });
    logger.mask(this.token);
  }

  async get<T>(path: string, query?: QueryParameters): Promise<T> {
    const response = await this.api.request<T>({
      method: "GET",
      url: `${this.baseUrl}${path}`,
      query,
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
      authentication: { scheme: "Bearer", value: this.token },
      retryable: true,
    });
    return response.data;
  }
}
