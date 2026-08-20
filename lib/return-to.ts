// Shared "come back to exactly where you were" navigation helper, used by
// every CRM detail page's Back button (Lead/Account/Contact/Opportunity,
// and any future one). A list page passes its own full URL (pathname +
// current filter/search/page query string) as ?returnTo=... when linking
// into a detail page; the detail page's Back button reads it back here.

// Only ever follow returnTo into our own app -- rejects absolute URLs,
// protocol-relative ("//host/...") URLs, and anything else that isn't a
// plain in-app path.
export function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

// Builds the value a list page should pass as ?returnTo= -- its own path
// plus whatever filters/search/page are currently in the URL.
export function buildReturnTo(pathname: string, searchParams: { toString(): string }): string {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// What a detail page's Back button should navigate to: the validated
// returnTo from the URL, or the given fallback (its own plain list page)
// if there isn't one (direct link/bookmark, or the linking page never set it).
export function resolveReturnTo(searchParams: { get(name: string): string | null }, fallback: string): string {
  const returnTo = searchParams.get("returnTo");
  return returnTo && isSafeInternalPath(returnTo) ? returnTo : fallback;
}
