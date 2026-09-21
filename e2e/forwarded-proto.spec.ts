import { expect, test } from "@playwright/test";

// These run against the second web server, started with ADMIN_URL=https://... as
// if Caddy were in front of it. Everything here uses the request API rather than
// a browser: what is being tested is which origin the server thinks it has, and
// the session cookie is Secure on that server, so a real browser over http could
// not carry one anyway.
const ORIGIN = "https://127.0.0.1:3101";
const SERVER = "http://127.0.0.1:3101";

const form = { "Content-Type": "application/x-www-form-urlencoded" };
const credentials = "email=nobody@example.org&password=wrongpassword123";

test("the second server is up", async ({ request }) => {
  const response = await request.get(`${SERVER}/healthz`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("a forwarded https request reaches the action instead of being refused", async ({
  request,
}) => {
  const response = await request.post(`${SERVER}/admin/login`, {
    headers: { ...form, "X-Forwarded-Proto": "https", Origin: ORIGIN },
    data: credentials,
    maxRedirects: 0,
  });

  // Reaching the action means the login form answers for itself: these are wrong
  // credentials, so 400 with the form's own message. Without trustProxy the
  // server reads its origin as http://127.0.0.1:3101, the https Origin header
  // looks cross-site, and React Router aborts before the action runs.
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain("That email and password don’t match.");
});

test("a genuinely cross-site origin is still refused", async ({ request }) => {
  const response = await request.post(`${SERVER}/admin/login`, {
    headers: { ...form, "X-Forwarded-Proto": "https", Origin: "https://evil.example" },
    data: credentials,
    maxRedirects: 0,
  });

  // Asserted as behaviour, not as a status code: React Router refuses a
  // cross-origin form post (400) before this project's own check would (403),
  // and which layer catches it first is not what this test is about. What
  // matters is that the action never ran and no session came back.
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(await response.text()).not.toContain("That email and password don’t match.");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
