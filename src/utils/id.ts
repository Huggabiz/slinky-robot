/**
 * Generate a stable internal id. crypto.randomUUID is available in
 * all modern browsers in a secure context; the fallback exists only
 * so unit tests or very old runtimes don't throw.
 */
export function makeId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return (
    'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}
