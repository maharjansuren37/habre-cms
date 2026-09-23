import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addRow,
  applyNavIntent,
  draftRowsToNavItems,
  moveRow,
  navItemsToDraftRows,
  parseDraftRows,
  removeRow,
} from "./navigation-form-input.ts";
import { NAV_MAX_ITEMS } from "./navigation-input.ts";

const PAGE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function draftForm(rows: { label: string; pageId: string; url: string }[]): FormData {
  const form = new FormData();
  form.set("nav-count", String(rows.length));
  rows.forEach((row, index) => {
    form.set(`nav-label-${index}`, row.label);
    form.set(`nav-pageId-${index}`, row.pageId);
    form.set(`nav-url-${index}`, row.url);
  });
  return form;
}

test("navItemsToDraftRows turns a page item and a URL item into rows", () => {
  const rows = navItemsToDraftRows([
    { label: "About", pageId: PAGE_ID },
    { label: "Docs", url: "https://example.com" },
  ]);
  assert.deepEqual(rows, [
    { label: "About", pageId: PAGE_ID, url: "" },
    { label: "Docs", pageId: "", url: "https://example.com" },
  ]);
});

test("parseDraftRows reads exactly the submitted rows, edits included", () => {
  const form = draftForm([
    { label: "About", pageId: PAGE_ID, url: "" },
    { label: "Edited", pageId: "", url: "https://example.com" },
  ]);
  const rows = parseDraftRows(form);
  assert.deepEqual(rows, [
    { label: "About", pageId: PAGE_ID, url: "" },
    { label: "Edited", pageId: "", url: "https://example.com" },
  ]);
});

test("parseDraftRows trims a crafted count above the cap", () => {
  const form = new FormData();
  form.set("nav-count", String(NAV_MAX_ITEMS + 500));
  const rows = parseDraftRows(form);
  assert.equal(rows.length, NAV_MAX_ITEMS);
});

test("addRow appends an empty row", () => {
  const rows = addRow([{ label: "About", pageId: PAGE_ID, url: "" }]);
  assert.deepEqual(rows, [
    { label: "About", pageId: PAGE_ID, url: "" },
    { label: "", pageId: "", url: "" },
  ]);
});

test("addRow refuses to grow past the cap", () => {
  const full = Array.from({ length: NAV_MAX_ITEMS }, () => ({ label: "x", pageId: "", url: "" }));
  assert.equal(addRow(full).length, NAV_MAX_ITEMS);
});

test("removeRow drops the row at that index only", () => {
  const rows = removeRow(
    [
      { label: "A", pageId: "", url: "" },
      { label: "B", pageId: "", url: "" },
      { label: "C", pageId: "", url: "" },
    ],
    1,
  );
  assert.deepEqual(
    rows.map((row) => row.label),
    ["A", "C"],
  );
});

test("moveRow swaps a row with its neighbour up or down", () => {
  const rows = [
    { label: "A", pageId: "", url: "" },
    { label: "B", pageId: "", url: "" },
  ];
  assert.deepEqual(
    moveRow(rows, 1, "up").map((row) => row.label),
    ["B", "A"],
  );
  assert.deepEqual(
    moveRow(rows, 0, "down").map((row) => row.label),
    ["B", "A"],
  );
});

test("moveRow does nothing at either end", () => {
  const rows = [
    { label: "A", pageId: "", url: "" },
    { label: "B", pageId: "", url: "" },
  ];
  assert.deepEqual(moveRow(rows, 0, "up"), rows);
  assert.deepEqual(moveRow(rows, 1, "down"), rows);
});

test("applyNavIntent adds, removes and moves by the intent's own index", () => {
  const rows = [
    { label: "A", pageId: "", url: "" },
    { label: "B", pageId: "", url: "" },
  ];
  assert.equal(applyNavIntent("nav-add", rows)?.length, 3);
  assert.deepEqual(
    applyNavIntent("nav-remove-0", rows)?.map((row) => row.label),
    ["B"],
  );
  assert.deepEqual(
    applyNavIntent("nav-move-down-0", rows)?.map((row) => row.label),
    ["B", "A"],
  );
});

test("applyNavIntent returns null for a non-reshape intent", () => {
  assert.equal(applyNavIntent("save", []), null);
});

test("draftRowsToNavItems accepts a page row and a URL row", () => {
  const result = draftRowsToNavItems(
    [
      { label: "About", pageId: PAGE_ID, url: "" },
      { label: "Docs", pageId: "", url: "https://example.com" },
    ],
    new Set([PAGE_ID]),
  );
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.items.length, 2);
});

test("draftRowsToNavItems drops a row nobody touched", () => {
  const result = draftRowsToNavItems(
    [
      { label: "About", pageId: PAGE_ID, url: "" },
      { label: "", pageId: "", url: "" },
    ],
    new Set([PAGE_ID]),
  );
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.items.length, 1);
});

test("draftRowsToNavItems refuses a row with both a page and a URL", () => {
  const result = draftRowsToNavItems(
    [{ label: "Both", pageId: PAGE_ID, url: "https://example.com" }],
    new Set([PAGE_ID]),
  );
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /not both/);
});

test("draftRowsToNavItems refuses a labelled row with neither a page nor a URL", () => {
  const result = draftRowsToNavItems([{ label: "Nowhere", pageId: "", url: "" }], new Set());
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /choose a page or type a web address/);
});

test("draftRowsToNavItems refuses a page id that no longer exists", () => {
  const result = draftRowsToNavItems([{ label: "Gone", pageId: PAGE_ID, url: "" }], new Set());
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /Choose it again/);
});

test("draftRowsToNavItems refuses a javascript: URL", () => {
  const result = draftRowsToNavItems(
    [{ label: "Bad", pageId: "", url: "javascript:alert(1)" }],
    new Set(),
  );
  assert.equal(result.ok, false);
});
