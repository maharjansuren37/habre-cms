import type { Page } from "@playwright/test";
import type { TestUser } from "./users.ts";

/**
 * Logs a test user in through the real form and waits for the redirect to
 * the posts list - the shared setup step nearly every spec needs before it
 * can drive an admin screen. `auth.spec.ts` has its own version instead of
 * this one: it exercises login itself, including the failure paths (a wrong
 * password, a redirect back to a protected page), so it needs to control the
 * navigation and the success wait independently rather than assume both.
 */
export async function logIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/admin/posts");
}
