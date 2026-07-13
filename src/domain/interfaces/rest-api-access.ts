/**
 * Domain port for parameterized REST access.
 *
 * Consumers describe a call with a {@link RestApiRequest}; the implementation
 * in `infrastructure/data/api-repositories` owns execution, retries, and
 * error mapping.
 */
import type { RestApiRequest, RestApiResponse } from "../models/rest-api";

export interface RestApiAccess {
  request<T>(request: RestApiRequest): Promise<RestApiResponse<T>>;
}
