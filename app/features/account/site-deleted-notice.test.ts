import assert from "node:assert/strict";
import { test } from "node:test";
import { siteDeletedNotice } from "./site-deleted-notice.ts";

test("the subject says the site was deleted", () => {
  assert.equal(siteDeletedNotice("lena-bakes", "Lena").subject, "Your Habre site was deleted");
});

test("the text names the address and says the account went with it", () => {
  const { text } = siteDeletedNotice("lena-bakes", "Lena");
  assert.match(text, /Your site lena-bakes was deleted by its admin\./);
  assert.match(text, /Your account was deleted with it/);
});

test("it greets by first name when it has one", () => {
  assert.match(siteDeletedNotice("lena-bakes", "Lena Novak").text, /^Hi Lena,/);
  assert.match(siteDeletedNotice("lena-bakes").text, /^Hi,/);
});

test("it is plain text: no markup from a name or an address", () => {
  const { text } = siteDeletedNotice("<i>site</i>", "<b>Lena</b> Novak");
  assert.ok(!text.includes("<"));
  assert.ok(!text.includes(">"));
  assert.match(text, /^Hi bLena\/b,/);
});
