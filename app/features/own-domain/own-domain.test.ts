import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLAIM_TTL_MS,
  canReplaceClaim,
  decideVerification,
  normalizeDomain,
  verificationRecords,
} from "./own-domain.ts";

const hosts = { platformHost: "app.habre.ai", sitesHost: "habre.page" };

function ok(domain: string) {
  return { ok: true, domain };
}
function refused(reason: string) {
  return { ok: false, reason };
}

test("a mixed-case name with a trailing dot is lowercased and the dot dropped", () => {
  assert.deepEqual(normalizeDomain("Example.COM.", hosts), ok("example.com"));
});

test("surrounding whitespace is trimmed", () => {
  assert.deepEqual(normalizeDomain("  example.com \n", hosts), ok("example.com"));
});

test("an internationalised name becomes its ASCII form", () => {
  assert.deepEqual(normalizeDomain("münchen.de", hosts), ok("xn--mnchen-3ya.de"));
});

test("a www prefix is allowed and kept", () => {
  assert.deepEqual(normalizeDomain("www.example.com", hosts), ok("www.example.com"));
});

test("an empty or blank input is refused as empty", () => {
  assert.deepEqual(normalizeDomain("", hosts), refused("empty"));
  assert.deepEqual(normalizeDomain("   ", hosts), refused("empty"));
});

test("an IPv4 address is refused as an ip", () => {
  assert.deepEqual(normalizeDomain("1.2.3.4", hosts), refused("ip"));
});

test("a name whose last label is all digits is refused as an ip", () => {
  assert.deepEqual(normalizeDomain("example.123", hosts), refused("ip"));
});

test("a bracketed IPv6 address is refused", () => {
  assert.deepEqual(normalizeDomain("[::1]", hosts), refused("invalid"));
});

test("a scheme is refused", () => {
  assert.deepEqual(normalizeDomain("https://example.com", hosts), refused("invalid"));
});

test("a path, query, fragment or userinfo is refused", () => {
  assert.deepEqual(normalizeDomain("example.com/path", hosts), refused("invalid"));
  assert.deepEqual(normalizeDomain("example.com?x=1", hosts), refused("invalid"));
  assert.deepEqual(normalizeDomain("example.com#top", hosts), refused("invalid"));
  assert.deepEqual(normalizeDomain("me@example.com", hosts), refused("invalid"));
});

test("a port is refused", () => {
  assert.deepEqual(normalizeDomain("example.com:8080", hosts), refused("invalid"));
});

test("spaces and underscores are refused", () => {
  assert.deepEqual(normalizeDomain("exa mple.com", hosts), refused("invalid"));
  assert.deepEqual(normalizeDomain("my_site.example.com", hosts), refused("invalid"));
});

test("a single label is refused", () => {
  assert.deepEqual(normalizeDomain("a", hosts), refused("invalid"));
});

test("a second trailing dot is refused", () => {
  assert.deepEqual(normalizeDomain("example.com..", hosts), refused("invalid"));
});

test("a label starting or ending with a hyphen is refused", () => {
  assert.deepEqual(normalizeDomain("-example.com", hosts), refused("invalid"));
  assert.deepEqual(normalizeDomain("example-.com", hosts), refused("invalid"));
});

test("a name over 253 characters is refused", () => {
  const label = "a".repeat(60);
  const long = `${label}.${label}.${label}.${label}.com`; // 60*4 + 4 dots + 3 = 247
  assert.deepEqual(normalizeDomain(long, hosts), ok(long));
  const tooLong = `${label}.${label}.${label}.${label}.${"b".repeat(10)}.com`; // 258
  assert.equal(tooLong.length > 253, true);
  assert.deepEqual(normalizeDomain(tooLong, hosts), refused("invalid"));
  assert.deepEqual(normalizeDomain("a".repeat(254), hosts), refused("invalid"));
});

test("a label over 63 characters is refused", () => {
  assert.deepEqual(normalizeDomain(`${"a".repeat(64)}.com`, hosts), refused("invalid"));
});

test("the platform host and anything under it are reserved", () => {
  assert.deepEqual(normalizeDomain("app.habre.ai", hosts), refused("reserved"));
  assert.deepEqual(normalizeDomain("x.app.habre.ai", hosts), refused("reserved"));
});

test("the sites host and anything under it are reserved", () => {
  assert.deepEqual(normalizeDomain("habre.page", hosts), refused("reserved"));
  assert.deepEqual(normalizeDomain("x.habre.page", hosts), refused("reserved"));
  assert.deepEqual(normalizeDomain("X.Habre.Page.", hosts), refused("reserved"));
});

test("a name that only ends with the sites host's text is not reserved", () => {
  assert.deepEqual(normalizeDomain("nothabre.page", hosts), ok("nothabre.page"));
});

test("reserved hosts compare without their port", () => {
  const dev = { platformHost: "app.localhost:3000", sitesHost: "localhost:3000" };
  assert.deepEqual(normalizeDomain("app.localhost", dev), refused("reserved"));
  assert.deepEqual(normalizeDomain("lena.localhost", dev), refused("reserved"));
  assert.deepEqual(normalizeDomain("example.com", dev), ok("example.com"));
});

test("verification records name the TXT under _habre-verify and point reach at the site host", () => {
  assert.deepEqual(verificationRecords("example.com", "abc123", "lena.habre.page"), {
    txt: { name: "_habre-verify.example.com", value: "habre-verify=abc123" },
    reach: { name: "example.com", target: "lena.habre.page" },
  });
});

const base = {
  token: "tok",
  txt: ["habre-verify=tok"],
  domainAddresses: ["203.0.113.5"],
  siteAddresses: ["203.0.113.5"],
};

test("a matching TXT and an address of the site verifies", () => {
  assert.equal(decideVerification(base), "verified");
});

test("no TXT records at all is no-txt", () => {
  assert.equal(decideVerification({ ...base, txt: [] }), "no-txt");
});

test("TXT records without the token are wrong-txt", () => {
  assert.equal(
    decideVerification({ ...base, txt: ["v=spf1 -all", "habre-verify=other"] }),
    "wrong-txt",
  );
});

test("a TXT string is matched exactly, so a longer value is wrong-txt", () => {
  assert.equal(decideVerification({ ...base, txt: ["habre-verify=tok2"] }), "wrong-txt");
});

test("whitespace and quotes around the TXT string are ignored", () => {
  assert.equal(decideVerification({ ...base, txt: [' "habre-verify=tok" '] }), "verified");
});

test("the token may be one of several TXT strings", () => {
  assert.equal(
    decideVerification({ ...base, txt: ["v=spf1 -all", "habre-verify=tok"] }),
    "verified",
  );
});

test("a domain with no addresses is not-pointing", () => {
  assert.equal(decideVerification({ ...base, domainAddresses: [] }), "not-pointing");
});

test("addresses with nothing in common are not-pointing", () => {
  assert.equal(decideVerification({ ...base, domainAddresses: ["198.51.100.9"] }), "not-pointing");
});

test("a domain with the site's address and a foreign one is not-pointing", () => {
  assert.equal(
    decideVerification({
      ...base,
      domainAddresses: ["203.0.113.5", "198.51.100.9"],
      siteAddresses: ["203.0.113.5"],
    }),
    "not-pointing",
  );
});

test("a domain whose addresses are only some of the site's verifies", () => {
  assert.equal(
    decideVerification({
      ...base,
      domainAddresses: ["203.0.113.5"],
      siteAddresses: ["203.0.113.5", "2001:db8::1"],
    }),
    "verified",
  );
});

test("a CNAME-style single match among several site addresses verifies", () => {
  assert.equal(
    decideVerification({
      ...base,
      domainAddresses: ["203.0.113.5"],
      siteAddresses: ["192.0.2.7", "203.0.113.5"],
    }),
    "verified",
  );
});

test("IPv6 addresses match case-insensitively", () => {
  assert.equal(
    decideVerification({
      ...base,
      domainAddresses: ["2001:DB8::1"],
      siteAddresses: [" 2001:db8::1 "],
    }),
    "verified",
  );
});

test("a failed TXT lookup is lookup-failed, even though no TXT was seen", () => {
  assert.equal(decideVerification({ ...base, txt: "error" }), "lookup-failed");
});

test("a failed domain lookup is lookup-failed", () => {
  assert.equal(decideVerification({ ...base, domainAddresses: "error" }), "lookup-failed");
});

test("a failed site lookup is lookup-failed", () => {
  assert.equal(decideVerification({ ...base, siteAddresses: "error" }), "lookup-failed");
});

test("a site with no addresses is lookup-failed, not not-pointing", () => {
  assert.equal(decideVerification({ ...base, siteAddresses: [] }), "lookup-failed");
});

test("a failed TXT lookup wins over everything else", () => {
  assert.equal(
    decideVerification({ ...base, txt: "error", domainAddresses: [], siteAddresses: [] }),
    "lookup-failed",
  );
});

test("a wrong TXT wins over a failed address lookup", () => {
  assert.equal(
    decideVerification({ ...base, txt: ["nope"], domainAddresses: "error" }),
    "wrong-txt",
  );
});

test("no-txt wins over a failed address lookup", () => {
  assert.equal(
    decideVerification({ ...base, txt: [], domainAddresses: "error", siteAddresses: [] }),
    "no-txt",
  );
});

test("wrong-txt wins over not-pointing", () => {
  assert.equal(
    decideVerification({ ...base, txt: ["nope"], domainAddresses: ["198.51.100.9"] }),
    "wrong-txt",
  );
});

const created = new Date("2026-10-01T00:00:00Z");

test("a verified claim is never replaceable", () => {
  const now = new Date(created.getTime() + 30 * CLAIM_TTL_MS);
  assert.equal(canReplaceClaim({ verifiedAt: created, createdAt: created }, now), false);
});

test("an unverified claim is not replaceable one minute before 24 hours", () => {
  const now = new Date(created.getTime() + CLAIM_TTL_MS - 60_000);
  assert.equal(canReplaceClaim({ verifiedAt: null, createdAt: created }, now), false);
});

test("an unverified claim is replaceable at 24 hours", () => {
  const now = new Date(created.getTime() + CLAIM_TTL_MS);
  assert.equal(canReplaceClaim({ verifiedAt: null, createdAt: created }, now), true);
});
