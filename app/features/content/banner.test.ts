import assert from "node:assert/strict";
import { test } from "node:test";
import { bannerRedirect, readBanner } from "./banner.ts";

test("with no banner param, there is nothing to show", () => {
  assert.equal(readBanner(new URLSearchParams()), null);
});

test("each verb is read back with its title", () => {
  assert.deepEqual(readBanner(new URLSearchParams("deleted=Old+Post")), {
    verb: "deleted",
    title: "Old Post",
  });
  assert.deepEqual(readBanner(new URLSearchParams("published=New+Post")), {
    verb: "published",
    title: "New Post",
  });
  assert.deepEqual(readBanner(new URLSearchParams("unpublished=Taken+Down")), {
    verb: "unpublished",
    title: "Taken Down",
  });
});

test("a title longer than the entry title's own cap is truncated, not shown as-is (F-57)", () => {
  const banner = readBanner(new URLSearchParams(`published=${"a".repeat(5000)}`));
  assert.equal(banner?.title.length, 200);
});

test("bannerRedirect builds the exact query readBanner reads back", () => {
  const response = bannerRedirect("published", "My Post", "/admin/posts");
  assert.equal(response.status, 302);
  const location = response.headers.get("Location");
  assert.equal(location, "/admin/posts?published=My%20Post");
  assert.deepEqual(readBanner(new URL(`http://x${location}`).searchParams), {
    verb: "published",
    title: "My Post",
  });
});

test("bannerRedirect points at whichever list it is given", () => {
  const response = bannerRedirect("deleted", "About", "/admin/pages");
  assert.equal(response.headers.get("Location"), "/admin/pages?deleted=About");
});
