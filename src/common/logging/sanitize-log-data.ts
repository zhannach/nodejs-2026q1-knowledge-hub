const SENSITIVE_KEY_PATTERN =
  /(password|token|authorization|api[-_]?key|secret)/i;

export function sanitizeForLogging(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogging(item));
  }

  if (value instanceof Date || value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((accumulator, [key, nestedValue]) => {
    accumulator[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : sanitizeForLogging(nestedValue);

    return accumulator;
  }, {});
}
