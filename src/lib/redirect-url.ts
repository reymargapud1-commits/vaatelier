/**
 * Builds a redirect URL using the same public host/protocol the visitor's
 * browser actually used, instead of trusting the incoming Request's own
 * `.url`.
 *
 * Behind a reverse proxy (like the one Railway puts in front of every app),
 * a route handler's raw `req.url` can end up reflecting the app's *internal*
 * address (e.g. "http://localhost:8080", the port the app listens on inside
 * its own container) rather than the public address the visitor typed (e.g.
 * "https://vaatelier.online"). A redirect built from `req.url` in that case
 * sends a real visitor's browser to an internal address it can never reach -
 * they see "This site can't be reached" instead of the page they expected.
 *
 * The standard fix: prefer the forwarded host/protocol headers a reverse
 * proxy sets (or the plain Host header as a fallback) over the request's own
 * computed URL. Use this for every redirect in an API route instead of
 * `new URL(path, req.url)`.
 */
export function redirectUrl(req: Request, path: string): URL {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
    return new URL(path, `${proto}://${host}`);
  }
  // No Host header at all (shouldn't normally happen) - fall back to the
  // request's own URL, the previous behavior.
  return new URL(path, req.url);
}
