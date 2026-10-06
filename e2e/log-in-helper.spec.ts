import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./helpers/auth.ts";
import { createAdmin, deleteTestUser, type TestUser } from "./helpers/users.ts";

// F-231: signup's race test can hold both password slots while another worker
// logs in, so the login answers 503 ("Login is busy."). The shared `logIn`
// helper tries again once.

let user: TestUser;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.23`,
  });
  user = createAdmin("Log In Helper");
});

test.afterEach(async () => {
  await deleteTestUser(user.email);
});

test("logIn tries again once when the login answers busy, and lands on the posts list", async ({
  page,
}) => {
  let posts = 0;
  await page.route(
    (url) => url.pathname === "/admin/login" || url.pathname === "/admin/login.data",
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts += 1;
      if (posts === 1) return route.fulfill({ status: 503, body: "" });
      return route.continue();
    },
  );

  await logIn(page, user);

  await expect(page).toHaveURL(/\/admin\/posts$/);
  expect(posts).toBe(2);
});
