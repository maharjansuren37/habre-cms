export type PolicyArea = "public" | "admin";

/**
 * Paths that belong to the admin host: `/admin` and under it, `/signup` and
 * under it, and `/verify`, `/forgot-password` and `/reset-password` exactly (15b, 15c,
 * until item 16 adds the platform host).
 */
export function isPlatformPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/verify" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/confirm-email"
  );
}

/** Admin and platform screens get the admin policy; everything else is the public site. */
export function areaForPath(pathname: string): PolicyArea {
  return isPlatformPath(pathname) ? "admin" : "public";
}

/**
 * The Content-Security-Policy header for one HTML response (F-100). Scripts
 * run only from this origin or with this response's nonce; styles only from
 * this origin. The admin once also allowed inline styles and `data:` images,
 * which Editor.js needed; item 14a3 dropped both, once nothing in the editor
 * needed them - TipTap runs with `injectCSS: false` and the toolbar, chip and
 * panel are placed through CSSOM (`element.style`), which the policy allows.
 * `e2e/content-security-policy.spec.ts` walks the editor to keep it so.
 * Images come from this origin or the R2 bucket, whose base URL may carry a
 * path, so only its origin is used.
 */
export function contentSecurityPolicy(options: {
  nonce: string;
  /** Decides nothing since 14a3, when the admin's policy became the public
   *  one; kept so the two hosts can differ again without touching callers. */
  area: PolicyArea;
  imageBaseUrl: string;
}): string {
  const { nonce, imageBaseUrl } = options;
  const imageOrigin = new URL(imageBaseUrl).origin;

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}'`,
    "style-src": "'self'",
    "img-src": `'self' ${imageOrigin}`,
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
