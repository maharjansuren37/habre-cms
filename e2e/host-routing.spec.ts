import { expect, test } from "@playwright/test";
import { HOST_SPLIT_PORT as PORT } from "./helpers/ports.ts";
import { createAdmin, deleteTestUser } from "./helpers/users.ts";

// Runs against the third web server (playwright.config.ts), started with
// genuinely different PUBLIC_URL/ADMIN_URL hosts on one port - D22's own
// answer to "browser tests need two local hostnames". Mostly uses the request
// API rather than a browser: what is being tested is app/lib/host-routing.ts's
// redirect and refusal decisions, not anything rendered. Logging in is the
// exception, because only a browser makes the client-side `.data` requests
// that reach host routing with a path the framework has not cleaned up.
const PUBLIC = `http://127.0.0.1:${PORT}`;
const ADMIN = `http://localhost:${PORT}`;

test("an admin path requested on the public host redirects to the admin host", async ({
  request,
}) => {
  const response = await request.get(`${PUBLIC}/admin/posts`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(`${ADMIN}/admin/posts`);
});

test("a public path requested on the admin host redirects to the public host", async ({
  request,
}) => {
  const response = await request.get(`${ADMIN}/posts/hello`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(`${PUBLIC}/posts/hello`);
});

test("bare / on the admin host redirects to /admin, not to the public host", async ({
  request,
}) => {
  const response = await request.get(ADMIN, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe("/admin");
});

test("a POST to an admin path on the public host is refused rather than redirected", async ({
  request,
}) => {
  const response = await request.post(`${PUBLIC}/admin/login`, {
    maxRedirects: 0,
    form: { email: "nobody@example.org", password: "wrong" },
  });
  expect(response.status()).toBe(404);
});

test("a request to a host that is neither is refused", async ({ request }) => {
  const response = await request.get(`${PUBLIC}/`, {
    headers: { Host: "evil.example" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("/healthz answers on both hosts without redirecting", async ({ request }) => {
  const onPublic = await request.get(`${PUBLIC}/healthz`);
  const onAdmin = await request.get(`${ADMIN}/healthz`);
  expect(onPublic.status()).toBe(200);
  expect(onAdmin.status()).toBe(200);
});

test("a client-side data request for /admin on the admin host stays on the admin host", async ({
  request,
}) => {
  // What the browser fetches when it navigates to /admin without reloading.
  const response = await request.get(`${ADMIN}/admin.data`, { maxRedirects: 0 });
  const body = await response.text();
  expect(body).toContain("/admin/login");
  expect(body).not.toContain(PUBLIC);
});

test("logging in on the admin host lands on the posts list on the admin host", async ({ page }) => {
  const user = createAdmin("Host Split Admin");
  try {
    await page.goto(`${ADMIN}/admin/login`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin/posts`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts");
  } finally {
    await deleteTestUser(user.email);
  }
});
