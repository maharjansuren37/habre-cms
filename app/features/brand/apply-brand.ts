import { deriveBrandShades, LIGHT_SITE_SURFACE, parseBrandColor } from "./brand-colours.ts";

/**
 * Sets a site scope element's five brand roles through the CSSOM - the admin's
 * `style-src 'self'` blocks a `style` attribute, and allows this. No colour (or
 * anything that is not `#rrggbb`) removes them, so the scope's ink shows through.
 * Browser-only DOM work, shared by Settings' preview and the editor's canvas.
 */
export function applyBrandProperties(element: HTMLElement | null, brandColor: string) {
  if (!element) return;
  const parsed = parseBrandColor(brandColor);
  const shades = parsed ? deriveBrandShades(parsed, LIGHT_SITE_SURFACE) : null;
  const properties = {
    "--color-primary": shades?.primary,
    "--color-primary-hover": shades?.primaryHover,
    "--color-on-primary": shades?.onPrimary,
    "--color-primary-subtle": shades?.primarySubtle,
    "--color-focus-ring": shades?.focusRing,
  };
  for (const [name, value] of Object.entries(properties)) {
    if (value) element.style.setProperty(name, value);
    else element.style.removeProperty(name);
  }
}
