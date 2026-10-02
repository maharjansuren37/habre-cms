export type PolicyArea = "public" | "admin";

/** Admin screens get the admin policy; everything else is the public site. */
export function areaForPath(pathname: string): PolicyArea {
  return pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : "public";
}

/**
 * The Content-Security-Policy header for one HTML response (F-100). Scripts
 * run only from this origin or with this response's nonce. The admin also
 * allows inline styles and `data:` images, which Editor.js once needed; they
 * stay until the editor is re-checked after item 14a3 (14a1's Notes) - the
 * public site needs neither, which is one of D22's two reasons for separate
 * hostnames. Images come from this origin or the R2 bucket, whose
 * base URL may carry a path, so only its origin is used.
 */
export function contentSecurityPolicy(options: {
  nonce: string;
  area: PolicyArea;
  imageBaseUrl: string;
}): string {
  const { nonce, area, imageBaseUrl } = options;
  const imageOrigin = new URL(imageBaseUrl).origin;

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}'`,
    "style-src": area === "admin" ? "'self' 'unsafe-inline'" : "'self'",
    // `data:` in the admin only: Editor.js needed it for an icon mask; kept
    // until the editor is re-checked after item 14a3.
    "img-src": area === "admin" ? `'self' ${imageOrigin} data:` : `'self' ${imageOrigin}`,
    "font-src": "'self'",
    "connect-src": "'self'",
    "object-src": "'none'",
    "base-uri": "'none'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
  };
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join("; ");
}
