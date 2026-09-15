import { expect, test } from "@playwright/test";

test("home page renders its heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Habre CMS" })).toBeVisible();
});

test("health check reports the database is up", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "up" });
});
