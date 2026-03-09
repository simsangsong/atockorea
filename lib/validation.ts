/**
 * Shared validation helpers for API routes.
 */

/**
 * Returns keys that are missing or empty in body (null, undefined, or '').
 * Use with ErrorResponses.validationError() to keep consistent response shape.
 */
export function getMissingRequiredFields(
  body: Record<string, unknown>,
  keys: string[]
): string[] {
  return keys.filter((k) => {
    const v = body[k];
    return v == null || v === '';
  });
}
