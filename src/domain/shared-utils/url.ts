/** Query parameters accepted by URL building; `undefined`/empty are skipped. */
export type QueryParameters = Record<string, string | number | undefined>;

/** Append query parameters to a base URL, skipping undefined and empty values. */
export function buildUrl(base: string, query?: QueryParameters): string {
  const url = new URL(base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}
