/**
 * Builds an absolute URL for NextResponse.redirect() from a relative path.
 *
 * Needed because NextResponse.redirect() requires an absolute URL, but every
 * admin form-post route in this app (trips, clients, customers, billing,
 * staff) only knows the relative path it wants to send the browser back to.
 *
 * This prefers the X-Forwarded-Host / X-Forwarded-Proto headers that
 * Railway's (and any standard) reverse proxy sets to the ORIGINAL public
 * request (e.g. "vaatelier.online", "https") over the request's own
 * `req.url`. Behind a proxy, `req.url` can reflect the proxy's internal
 * address to the container instead of the public domain - on Railway this
 * showed up as every admin "Save"/"Delete" button redirecting the browser to
 * "http://localhost:8080/..." (connection refused) instead of back to
 * vaatelier.online. Falls back to `req.url` (correct for local dev, where
 * there's no proxy in front) when those headers aren't present.
 */
export function redirectUrl(req: Request, path: string): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }
  return new URL(path, req.url);
}
