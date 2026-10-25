/**
 * Builds an absolute URL for NextResponse.redirect() from a relative path,
 * resolved against the incoming request's own URL. Needed because
 * NextResponse.redirect() requires an absolute URL, but every admin
 * form-post route in this app (trips, clients, customers, billing) only
 * knows the relative path it wants to send the browser back to - this way
 * none of them have to hardcode NEXT_PUBLIC_SITE_URL or guess the host.
 */
export function redirectUrl(req: Request, path: string): URL {
  return new URL(path, req.url);
}
