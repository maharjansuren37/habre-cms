export type PolicyArea = "public" | "admin";

/**
 * Paths that belong to the platform host (item 16a): `/admin` and under it,
 * `/signup` and under it, and `/verify`, `/forgot-password`, `/reset-password`
 * and `/confirm-email` exactly.
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
 * this origin, plus on public pages the nonce, for the brand `<style>` (18a1:
 * only declarations built from derived hex values, never a stored string).
 * The admin once also allowed inline styles and `data:` images, which
 * Editor.js needed; item 14a3 dropped both, once nothing in the editor
 * needed them - TipTap runs with `injectCSS: false` and the toolbar, chip and
 * panel are placed through CSSOM (`element.style`), which the policy allows.
 * `e2e/content-security-policy.spec.ts` walks the editor to keep it so.
 * Images come from this origin or the R2 bucket, whose base URL may carry a
 * path, so only its origin is used. The admin also allows `blob:` images, so an
 * SVG logo can be drawn from the person's own file before it becomes a PNG
 * (18a2); the public pages do not.
 */
export function contentSecurityPolicy(options: {
  nonce: string;
  /** Public pages also allow this response's nonce for the one brand
   *  `<style>` (18a1); the admin allows this origin only. */
  area: PolicyArea;
  imageBaseUrl: string;
}): string {
  const { nonce, area, imageBaseUrl } = options;
  const imageOrigin = new URL(imageBaseUrl).origin;

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}'`,
    "style-src": area === "public" ? `'self' 'nonce-${nonce}'` : "'self'",
    "img-src": area === "admin" ? `'self' ${imageOrigin} blob:` : `'self' ${imageOrigin}`,
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
