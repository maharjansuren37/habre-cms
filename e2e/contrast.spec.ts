import { expect, test } from "@playwright/test";

// WCAG 2.x contrast of Habre's role tokens, measured on the real served app.
// The pairs and minimums are those of prototypes/checks/contrast.mjs, except
// the selection / on-selection pairs: those arrive with item 14a, which adds
// them here.

const PAIRS: [string, string, number][] = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text-muted", "bg", 4.5],
  ["text-muted", "surface", 4.5],
  ["text-muted", "surface-sunken", 4.5],
  ["text-muted", "surface-hover", 4.5],
  ["primary", "bg", 4.5],
  ["primary", "surface", 4.5],
  ["primary-hover", "bg", 4.5],
  ["on-primary", "primary", 4.5],
  ["on-primary", "primary-hover", 4.5],
  ["primary", "primary-subtle", 4.5],
  ["border-strong", "surface", 3],
  ["border-strong", "bg", 3],
  ["focus-ring", "bg", 3],
  ["focus-ring", "surface", 3],
  ["danger", "surface", 4.5],
  ["danger", "bg", 4.5],
  ["on-primary", "danger", 4.5],
  ["danger", "danger-subtle", 4.5],
  ["text", "danger-subtle", 4.5],
  ["success", "success-subtle", 4.5],
  ["warning", "warning-subtle", 4.5],
  ["info", "info-subtle", 4.5],
  ["bg", "text", 4.5],
  ["bg", "text-muted", 4.5],
];

type Rgb = [number, number, number];

const ROLES = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];

// Parses what getComputedStyle returns: rgb()/rgba() or color(srgb r g b).
function parseColor(value: string): Rgb {
  const nums = value.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 3) throw new Error(`cannot parse colour "${value}"`);
  if (nums.length > 3 && nums[3] !== 1) throw new Error(`colour "${value}" has alpha`);
  const scale = value.startsWith("color(") ? 255 : 1;
  return [nums[0] * scale, nums[1] * scale, nums[2] * scale];
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function measure(
  page: import("@playwright/test").Page,
  path: string,
  colorScheme: "light" | "dark",
) {
  await page.emulateMedia({ colorScheme });
  await page.goto(path);
  // A string, because e2e/ is type-checked without the DOM lib.
  const resolved = (await page.evaluate(`(() => {
    const out = {};
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    for (const role of ${JSON.stringify(ROLES)}) {
      probe.style.color = "var(--color-" + role + ")";
      out[role] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  })()`)) as Record<string, string>;

  const colors = Object.fromEntries(ROLES.map((role) => [role, parseColor(resolved[role])]));
  const failures: string[] = [];
  const lines: string[] = [];
  for (const [a, b, min] of PAIRS) {
    const r = ratio(colors[a], colors[b]);
    lines.push(`${`${a} on ${b}`.padEnd(32)}${r.toFixed(2).padStart(6)}  min ${min}`);
    if (r < min) failures.push(`${a} on ${b}: ${r.toFixed(2)} < ${min}`);
  }
  console.log(`\n${path} (${colorScheme})\n${lines.join("\n")}`);
  return failures;
}

test("Habre's scope meets contrast in light mode", async ({ page }) => {
  expect(await measure(page, "/admin/login", "light")).toEqual([]);
});

test("Habre's scope meets contrast in dark mode", async ({ page }) => {
  expect(await measure(page, "/admin/login", "dark")).toEqual([]);
});

test("the site scope meets contrast in light mode", async ({ page }) => {
  expect(await measure(page, "/", "light")).toEqual([]);
  await expect(page.locator("html")).toHaveAttribute("data-surface", "site");
});

test("the site scope still meets contrast under a dark device", async ({ page }) => {
  expect(await measure(page, "/", "dark")).toEqual([]);
  await expect(page.locator("html")).toHaveAttribute("data-surface", "site");
});
