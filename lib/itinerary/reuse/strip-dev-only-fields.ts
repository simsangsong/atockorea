/**
 * Dev-only request fields must not affect reusable signatures, persisted route identity,
 * or template/run matching. Strip them before passing `body` into `buildReusableRequestSignature`
 * or any snapshot that should match production identity.
 */
export function stripDevOnlyFields<T extends Record<string, unknown>>(body: T): Omit<T, 'debugNoReuse'> {
  const { debugNoReuse: _omit, ...rest } = body;
  return rest;
}
