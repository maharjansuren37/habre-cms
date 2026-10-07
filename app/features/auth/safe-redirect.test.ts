import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRedirect } from "./safe-redirect.ts";

test("a path inside the admin area is kept", () => {
  for (const destination of ["/admin", "/admin/posts/123", "/admin?tab=drafts", "/admin#top"]) {
    assert.equal(safeRedirect(destination), destination);
  }
});

test("a missing destination goes to /admin", () => {
  for (const destination of [null, undefined, ""]) {
    assert.equal(safeRedirect(destination), "/admin");
  }
});

test("destinations off the site go to /admin", () => {
  for (const destination of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeRedirect(destination), "/admin", destination);
  }
});

test("paths outside the admin area go to /admin", () => {
  for (const destination of ["/posts", "/", "/administrator", "admin/posts"]) {
    assert.equal(safeRedirect(destination), "/admin", destination);
  }
});

test("admin paths carrying a backslash or whitespace go to /admin", () => {
  for (const destination of ["/admin/\\evil.example", "/admin\n/posts", "/admin\t"]) {
    assert.equal(safeRedirect(destination), "/admin", JSON.stringify(destination));
  }
});

test("a path inside the start flow is kept", () => {
  for (const destination of [
    "/start",
    "/start/about?kind=blog",
    "/start/0c9d5f3e-1111-4222-8333-444455556666",
  ]) {
    assert.equal(safeRedirect(destination), destination);
  }
});

test("paths that only begin with /start go to /admin", () => {
  for (const destination of ["/startx", "/start-here", "/starting/about"]) {
    assert.equal(safeRedirect(destination), "/admin", destination);
  }
});
