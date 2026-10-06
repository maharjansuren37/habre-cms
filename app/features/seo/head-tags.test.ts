import assert from "node:assert/strict";
import { test } from "node:test";
import { publicMeta } from "./head-tags.ts";

const layout = {
  id: "features/public-site/layout",
  loaderData: {
    settings: { siteTitle: "Lena's site", logoUrl: null },
    siteDescription: "Bread and letters.",
    language: "en",
    navLinks: [],
    mainOrigin: "https://lena.example",
  },
};

const canonical = (href: string) => ({ tagName: "link", rel: "canonical", href });

test("a page with nothing set has the canonical, a suffixed title, og tags and no description or image", () => {
  const tags = publicMeta([layout], { title: "About", path: "/about" });
  assert.deepEqual(tags, [
    { title: "About - Lena's site" },
    canonical("https://lena.example/about"),
    { property: "og:title", content: "About" },
    { property: "og:url", content: "https://lena.example/about" },
    { property: "og:site_name", content: "Lena's site" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]);
});

test("a search title is the whole browser title and the og title", () => {
  const tags = publicMeta([layout], { title: "About", path: "/about", seoTitle: "Who we are" });
  assert.deepEqual(tags[0], { title: "Who we are" });
  assert.deepEqual(tags[2], { property: "og:title", content: "Who we are" });
});

test("a description and an image add their tags, and the card grows", () => {
  const tags = publicMeta([layout], {
    title: "Hello",
    path: "/posts/hello",
    type: "article",
    description: 'A <b> & "post"',
    imageUrl: "https://media.example/a.jpg",
  });
  assert.deepEqual(tags, [
    { title: "Hello - Lena's site" },
    canonical("https://lena.example/posts/hello"),
    { name: "description", content: 'A <b> & "post"' },
    { property: "og:title", content: "Hello" },
    { property: "og:description", content: 'A <b> & "post"' },
    { property: "og:url", content: "https://lena.example/posts/hello" },
    { property: "og:site_name", content: "Lena's site" },
    { property: "og:type", content: "article" },
    { property: "og:image", content: "https://media.example/a.jpg" },
    { name: "twitter:card", content: "summary_large_image" },
  ]);
});

test("the site description is used only where the page asks for it", () => {
  const without = publicMeta([layout], { title: "About", path: "/about" });
  assert.ok(!without.some((tag) => tag.name === "description"));
  const withIt = publicMeta([layout], {
    title: "Posts",
    path: "/posts",
    siteDescriptionFallback: true,
  });
  assert.deepEqual(
    withIt.find((tag) => tag.name === "description"),
    {
      name: "description",
      content: "Bread and letters.",
    },
  );
  const own = publicMeta([layout], {
    path: "/",
    description: "Own words",
    siteDescriptionFallback: true,
  });
  assert.deepEqual(
    own.find((tag) => tag.name === "description"),
    {
      name: "description",
      content: "Own words",
    },
  );
});

test("the home page's og title is the site title, its canonical a slash", () => {
  const tags = publicMeta([layout], { path: "/", siteDescriptionFallback: true });
  assert.deepEqual(tags[0], { title: "Lena's site" });
  assert.deepEqual(tags[1], canonical("https://lena.example/"));
  assert.deepEqual(
    tags.find((tag) => tag.property === "og:title"),
    {
      property: "og:title",
      content: "Lena's site",
    },
  );
});

test("an empty site description emits no description at all", () => {
  const empty = { ...layout, loaderData: { ...layout.loaderData, siteDescription: "" } };
  const tags = publicMeta([empty], {
    path: "/posts",
    title: "Posts",
    siteDescriptionFallback: true,
  });
  assert.ok(!tags.some((tag) => tag.name === "description" || tag.property === "og:description"));
});

test("without the layout's data there is a title and no canonical link", () => {
  const tags = publicMeta([undefined], { title: "About", path: "/about" });
  assert.deepEqual(tags, [{ title: "About - Habre CMS" }]);
});
