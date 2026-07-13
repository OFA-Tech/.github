/** Truncate `value` to at most `max` characters, appending an ellipsis. */
export function truncate(value: string, max = 2000): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
