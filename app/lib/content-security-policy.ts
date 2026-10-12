export type PolicyArea = "public" | "admin" | "preview";

/**
 * Paths that belong to the platform host (item 16a): `/admin` and under it,
 * `/start` and under it (item 18b3), `/signup` and under it, and `/verify`,
 * `/forgot-password`, `/reset-password` and `/confirm-email` exactly.
 */
export function isPlatformPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/start" ||
    pathname.startsWith("/start/") ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/verify" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/confirm-email" ||
    // The terms and privacy policy (F-428): under /legal/ so a site's own `privacy` page is untouched.
    pathname.startsWith("/legal/") ||
    // Stripe's webhook (item 21b): a POST with no page, on the platform host only.
    pathname === "/webhooks/stripe"
  );
}

/**
 * Admin and platform screens get the admin policy; `/admin/preview` and under
 * it (item 18b4b) are a site's page shown on the platform host, so they get
 * the public policy; everything else is the public site.
 */
export function areaForPath(pathname: string): PolicyArea {
  if (pathname === "/admin/preview" || pathname.startsWith("/admin/preview/")) return "preview";
  return isPlatformPath(pathname) ? "admin" : "public";
}

/**
 * The Content-Security-Policy header for one HTML response (F-100). Scripts
 * run only from this origin or with this response's nonce; styles only from
 * this origin, plus on public pages and the admin's preview of them (18b4b)
 * the nonce, for the brand `<style>` (18a1: only declarations built from
 * derived hex values, never a stored string).
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
  /** Public and preview pages also allow this response's nonce for the one
   *  brand `<style>` (18a1); the admin allows this origin only. */
  area: PolicyArea;
  imageBaseUrl: string;
  /** Billing is on (item 21b): the admin's plan page posts a form that is answered
   *  with a redirect to Stripe's Checkout or Portal, and `form-action` applies to
   *  that redirect (F-410). Only those two hosted pages, only in the admin. */
  billing?: boolean;
}): string {
  const { nonce, area, imageBaseUrl } = options;
  const imageOrigin = new URL(imageBaseUrl).origin;

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}'`,
    "style-src": area !== "admin" ? `'self' 'nonce-${nonce}'` : "'self'",
    "img-src": area === "admin" ? `'self' ${imageOrigin} blob:` : `'self' ${imageOrigin}`,
    "font-src": "'self'",
    "connect-src": "'self'",
    "object-src": "'none'",
    "base-uri": "'none'",
    "form-action":
      options.billing && area === "admin"
        ? "'self' https://checkout.stripe.com https://billing.stripe.com"
        : "'self'",
    "frame-ancestors": "'none'",
  };
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join("; ");
}
