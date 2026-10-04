import assert from "node:assert/strict";
import { test } from "node:test";
import { areaForPath, contentSecurityPolicy } from "./content-security-policy.ts";

const R2 = "https://pub-abc123.r2.dev";

/** The header split back into `{ directive: value }`, so tests read one at a time. */
function directives(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split("; ").map((part) => {
      const space = part.indexOf(" ");
      return [part.slice(0, space), part.slice(space + 1)];
    }),
  );
}

const SHARED = {
  "default-src": "'self'",
  "script-src": "'self' 'nonce-abc123=='",
  "img-src": `'self' ${R2}`,
  "font-src": "'self'",
  "connect-src": "'self'",
  "object-src": "'none'",
  "base-uri": "'none'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
};

test("the public policy is the shared directives with styles and images from known origins only", () => {
  const header = contentSecurityPolicy({ nonce: "abc123==", area: "public", imageBaseUrl: R2 });
  assert.deepEqual(directives(header), { ...SHARED, "style-src": "'self'" });
});

test("the admin policy allows no inline styles and no data: images, the same as the public one (14a3)", () => {
  const header = contentSecurityPolicy({ nonce: "abc123==", area: "admin", imageBaseUrl: R2 });
  assert.deepEqual(directives(header), { ...SHARED, "style-src": "'self'" });
  assert.doesNotMatch(header, /unsafe-inline|data:/);
});

test("images are allowed from the R2 bucket's origin, without its path", () => {
  const header = contentSecurityPolicy({
    nonce: "n",
    area: "public",
    imageBaseUrl: "https://media.example.com/site/images/",
  });
  assert.equal(directives(header)["img-src"], "'self' https://media.example.com");
});

test("each response's own nonce is the one scripts are allowed with", () => {
  const header = contentSecurityPolicy({ nonce: "other+/=", area: "admin", imageBaseUrl: R2 });
  assert.equal(directives(header)["script-src"], "'self' 'nonce-other+/='");
});

test("/admin and paths under it are admin; everything else is public", () => {
  assert.equal(areaForPath("/admin"), "admin");
  assert.equal(areaForPath("/admin/posts"), "admin");
  assert.equal(areaForPath("/administrator"), "public");
  assert.equal(areaForPath("/admin-notes"), "public");
  assert.equal(areaForPath("/"), "public");
  assert.equal(areaForPath("/posts/hello"), "public");
});

test("/signup, the pages under it and /verify are admin; near misses are public (15b)", () => {
  assert.equal(areaForPath("/signup"), "admin");
  assert.equal(areaForPath("/signup/sent"), "admin");
  assert.equal(areaForPath("/verify"), "admin");
  assert.equal(areaForPath("/signupx"), "public");
  assert.equal(areaForPath("/verify/x"), "public");
  assert.equal(areaForPath("/verifying"), "public");
});

test("/forgot-password and /reset-password are admin; near misses are public (15c)", () => {
  assert.equal(areaForPath("/forgot-password"), "admin");
  assert.equal(areaForPath("/reset-password"), "admin");
  assert.equal(areaForPath("/forgot-passwords"), "public");
  assert.equal(areaForPath("/reset-password/x"), "public");
});

test("/confirm-email is admin; near misses are public (15e1)", () => {
  assert.equal(areaForPath("/confirm-email"), "admin");
  assert.equal(areaForPath("/confirm-email/x"), "public");
  assert.equal(areaForPath("/confirm-emails"), "public");
});
