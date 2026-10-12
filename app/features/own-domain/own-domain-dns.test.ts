import assert from "node:assert/strict";
import { test } from "node:test";
import { addressesAnswer, createDomainLookups, lookupAnswer } from "./own-domain-dns.server.ts";

const failure = (code: string) => Object.assign(new Error(code), { code });

test("not found, no data, refused and a timeout are answers meaning no records", () => {
  for (const code of ["ENOTFOUND", "ENODATA", "ECONNREFUSED", "ETIMEOUT"]) {
    assert.deepEqual(lookupAnswer(failure(code)), [], code);
  }
});

test("any other failure is an error", () => {
  for (const code of ["ESERVFAIL", "EREFUSED", "ECONNRESET", "EBADRESP"]) {
    assert.equal(lookupAnswer(failure(code)), "error", code);
  }
  assert.equal(lookupAnswer(new Error("boom")), "error");
  assert.equal(lookupAnswer("nope"), "error");
});

test("addresses join both families, and one family failing is fine when the other answered", () => {
  assert.deepEqual(addressesAnswer(["1.2.3.4"], ["::1"]), ["1.2.3.4", "::1"]);
  assert.deepEqual(addressesAnswer(["1.2.3.4"], "error"), ["1.2.3.4"]);
  assert.deepEqual(addressesAnswer("error", ["::1"]), ["::1"]);
});

test("addresses are an error when one family failed and the other had none", () => {
  assert.equal(addressesAnswer([], "error"), "error");
  assert.equal(addressesAnswer("error", []), "error");
  assert.equal(addressesAnswer("error", "error"), "error");
  assert.deepEqual(addressesAnswer([], []), []);
});

test("the lookups join each TXT answer's chunks and combine A and AAAA", async () => {
  const lookups = createDomainLookups({
    resolveTxt: async () => [["habre-verify=", "abc"], ["other"]],
    resolve4: async () => ["1.2.3.4"],
    resolve6: async () => {
      throw failure("ENODATA");
    },
  });
  assert.deepEqual(await lookups.txt("_habre-verify.example.test"), ["habre-verify=abc", "other"]);
  assert.deepEqual(await lookups.addresses("example.test"), ["1.2.3.4"]);
});

test("a failing resolver gives error, not an exception", async () => {
  const lookups = createDomainLookups({
    resolveTxt: async () => {
      throw failure("ESERVFAIL");
    },
    resolve4: async () => {
      throw failure("ESERVFAIL");
    },
    resolve6: async () => [],
  });
  assert.equal(await lookups.txt("x.test"), "error");
  assert.equal(await lookups.addresses("x.test"), "error");
});
