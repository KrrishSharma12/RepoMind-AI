/**
 * Extra CSRF protection for POST routes. Browsers always send an Origin header
 * on POST requests, so a missing or different Origin is rejected.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new URL(process.env.BETTER_AUTH_URL ?? new URL(request.url).origin).origin;
  return origin === allowed;
}