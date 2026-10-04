import assert from "node:assert/strict";
import { test } from "node:test";
import { formatFileSize } from "./file-size.ts";

test("a file under 1 KB is shown in bytes", () => {
  assert.equal(formatFileSize(287), "287 B");
});

test("a file under 1 MB is shown in whole KB", () => {
  assert.equal(formatFileSize(2048), "2 KB");
});

test("a 10 MB file is shown as 10.0 MB, not 10240.0 MB (F-248)", () => {
  assert.equal(formatFileSize(10_485_760), "10.0 MB");
});

test("a file of 1.5 MB is shown to one decimal", () => {
  assert.equal(formatFileSize(1_572_864), "1.5 MB");
});
