import assert from "node:assert/strict";
import { test } from "node:test";
import type { Document } from "#app/features/blocks/document-nodes.ts";
import { documentMediaIds } from "./document-media-ids.ts";

const section = (...blocks: Document["content"][number]["content"][number]["content"]) => ({
  type: "section" as const,
  attrs: { align: "top" as const, background: "none" as const },
  content: [{ type: "column" as const, content: blocks }],
});

test("a document's image ids are collected once each, in document order", () => {
  const document: Document = {
    type: "doc",
    content: [
      section({ type: "paragraph" }, { type: "image", attrs: { mediaId: "b" } }),
      section(
        { type: "image", attrs: { mediaId: "a" } },
        { type: "image", attrs: { mediaId: "b" } },
      ),
    ],
  };
  assert.deepEqual(documentMediaIds(document), ["b", "a"]);
});

test("a document with no image has no media ids", () => {
  const document: Document = { type: "doc", content: [section({ type: "space" })] };
  assert.deepEqual(documentMediaIds(document), []);
});

test("an image with no file chosen contributes no media id", () => {
  const id = "0b7e3a52-6d1c-4f3e-9a41-2c8d5e7f9b10";
  const document: Document = {
    type: "doc",
    content: [
      section({ type: "image", attrs: { mediaId: "" } }, { type: "image", attrs: { mediaId: id } }),
    ],
  };
  assert.deepEqual(documentMediaIds(document), [id]);
});
