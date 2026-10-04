import assert from "node:assert/strict";
import { test } from "node:test";
import { fitsStorage, formatStorage, formatStorageLimit, storageSummary } from "./storage-limit.ts";

const MB = 1024 * 1024;
const LIMIT = 500 * MB;

test("a file that takes usage exactly to the limit fits", () => {
  assert.equal(fitsStorage(LIMIT - 10 * MB, 10 * MB, LIMIT), true);
});

test("a file one byte over the limit does not fit", () => {
  assert.equal(fitsStorage(LIMIT - 10 * MB, 10 * MB + 1, LIMIT), false);
});

test("with no limit every file fits", () => {
  assert.equal(fitsStorage(Number.MAX_SAFE_INTEGER, 10 * MB, null), true);
});

test("formatStorage writes 0 bytes as 0 MB", () => {
  assert.equal(formatStorage(0), "0 MB");
});

test("formatStorage says less than 1 MB from 1 byte to just under 1 MB", () => {
  assert.equal(formatStorage(1), "less than 1 MB");
  assert.equal(formatStorage(1048575), "less than 1 MB");
});

test("formatStorage writes whole MB, rounded down", () => {
  assert.equal(formatStorage(1048576), "1 MB");
  assert.equal(formatStorage(524288000), "500 MB");
  assert.equal(formatStorage(1048576 * 2 - 1), "1 MB");
});

test("formatStorage writes GB to one decimal, dropping a trailing .0", () => {
  assert.equal(formatStorage(1073741824), "1 GB");
  assert.equal(formatStorage(1610612736), "1.5 GB");
});

test("storageSummary below the limit is not full", () => {
  assert.deepEqual(storageSummary(30 * MB, LIMIT), {
    usedText: "30 MB",
    limitText: "500 MB",
    value: 30 * MB,
    max: LIMIT,
    isFull: false,
  });
});

test("storageSummary at the limit is full", () => {
  const summary = storageSummary(LIMIT, LIMIT);
  assert.equal(summary.usedText, "500 MB");
  assert.equal(summary.isFull, true);
});

test("storageSummary above the limit is full and keeps the real usage", () => {
  const summary = storageSummary(510 * MB, LIMIT);
  assert.equal(summary.value, 510 * MB);
  assert.equal(summary.isFull, true);
});

test("storageSummary with no limit has no limit text or max and is never full", () => {
  assert.deepEqual(storageSummary(38 * MB, null), {
    usedText: "38 MB",
    limitText: null,
    value: 38 * MB,
    max: null,
    isFull: false,
  });
});

test("formatStorageLimit rounds a limit up, so 2000 MB reads as 2 GB (F-249)", () => {
  assert.equal(formatStorageLimit(2000 * MB), "2 GB");
  assert.equal(formatStorageLimit(500 * MB), "500 MB");
  assert.equal(formatStorageLimit(2048 * MB), "2 GB");
});

test("storageSummary never shows usage equal to a limit it has not reached (F-249)", () => {
  const summary = storageSummary(1990 * MB, 2000 * MB);
  assert.equal(summary.usedText, "1.9 GB");
  assert.equal(summary.limitText, "2 GB");
  assert.equal(summary.isFull, false);
});

test("a full site shows usage no lower than its limit (F-250)", () => {
  const summary = storageSummary(2000 * MB, 2000 * MB);
  assert.equal(summary.usedText, "2 GB");
  assert.equal(summary.limitText, "2 GB");
  assert.equal(summary.isFull, true);
});
