/**
 * User preference: debug/error logs are prefixed [DEBUG] and include the
 * originating scope, a timestamp, and relevant context so issues are
 * traceable from the browser console alone.
 */
export function logError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[DEBUG] ${scope}`, {
    timestamp: new Date().toISOString(),
    error,
    ...context,
  })
}
