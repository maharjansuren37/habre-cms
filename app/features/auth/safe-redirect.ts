const DEFAULT_DESTINATION = "/admin";

/**
 * Where to send someone after logging in. Only a path inside the admin area is
 * followed; anything else - another site, a protocol-relative `//host`, a
 * backslash some browsers read as a slash - falls back to `/admin`, so the
 * login page cannot be used to redirect people off the site.
 */
export function safeRedirect(destination: string | null | undefined): string {
  if (!destination) return DEFAULT_DESTINATION;
  const isAdminPath = /^\/admin(?:[/?#]|$)/.test(destination);
  const hasUnsafeCharacter = /[\\\s]/.test(destination);
  return isAdminPath && !hasUnsafeCharacter ? destination : DEFAULT_DESTINATION;
}
