import type { Page } from "@playwright/test";
import type { TestUser } from "./users.ts";

/**
 * Logs a test user in through the real form and waits for the redirect to
 * Home (an admin) or Posts (an editor or author) - the shared setup step
 * nearly every spec needs before it can drive an admin screen. `auth.spec.ts` has its own version instead of
 * this one: it exercises login itself, including the failure paths (a wrong
 * password, a redirect back to a protected page), so it needs to control the
 * navigation and the success wait independently rather than assume both.
 *
 * It tries again once when the login answers 503 ("Login is busy."): signup's
 * race test can hold both password slots while another worker logs in (F-231).
 */
export async function logIn(page: Page, user: TestUser): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    const answer = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && /\/admin\/login(\.data)?$/.test(response.url()),
    );
    await page.getByRole("button", { name: "Log in" }).click();
    if ((await answer).status() !== 503 || attempt === 2) break;
    await page.waitForTimeout(500);
  }
  // An admin lands on Home; an editor or author is sent on to Posts.
  await page.waitForURL(/\/admin(\/posts)?$/);
}
