import assert from "node:assert/strict";
import { test } from "node:test";
import { publicTitle } from "./public-title.ts";

const root = { id: "root", loaderData: undefined };
const layout = (siteTitle: string) => ({
  id: "features/public-site/layout",
  loaderData: { settings: { siteTitle } },
});

test("the site title alone when there is no page title", () => {
  assert.equal(publicTitle([root, layout("Kathmandu Bakery")]), "Kathmandu Bakery");
});

test("the page title then the site title when there is a page title", () => {
  assert.equal(
    publicTitle([root, layout("Kathmandu Bakery")], "Opening hours"),
    "Opening hours - Kathmandu Bakery",
  );
});

test("Habre CMS when the public layout is not among the matches", () => {
  assert.equal(publicTitle([root], "Opening hours"), "Opening hours - Habre CMS");
});

test("Habre CMS when the public layout matched but has no loader data", () => {
  assert.equal(
    publicTitle([root, { id: "features/public-site/layout", loaderData: undefined }]),
    "Habre CMS",
  );
});
