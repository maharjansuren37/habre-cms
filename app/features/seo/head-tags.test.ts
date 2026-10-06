import assert from "node:assert/strict";
import { test } from "node:test";
import { publicMeta } from "./head-tags.ts";

const layout = {
  id: "features/public-site/layout",
  loaderData: {
    settings: { siteTitle: "Lena's site", logoUrl: null },
    navLinks: [],
    mainOrigin: "https://lena.example",
  },
};

test("a page's canonical link is the main origin and its own path", () => {
  const tags = publicMeta([layout], { title: "About", path: "/about" });
  assert.deepEqual(tags, [
    { title: "About - Lena's site" },
    { tagName: "link", rel: "canonical", href: "https://lena.example/about" },
  ]);
});

test("the home page's canonical link is the bare main origin and a slash", () => {
  const tags = publicMeta([layout], { path: "/" });
  assert.deepEqual(tags, [
    { title: "Lena's site" },
    { tagName: "link", rel: "canonical", href: "https://lena.example/" },
  ]);
});

test("without the layout's data there is a title and no canonical link", () => {
  const tags = publicMeta([undefined], { title: "About", path: "/about" });
  assert.deepEqual(tags, [{ title: "About - Habre CMS" }]);
});
