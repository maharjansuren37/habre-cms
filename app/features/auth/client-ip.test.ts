import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, rateLimitKeyForIp } from "./client-ip.ts";

test("the address added by the nearest proxy is used", () => {
  assert.equal(clientIp(new Headers({ "X-Forwarded-For": "203.0.113.7" })), "203.0.113.7");
  assert.equal(
    clientIp(new Headers({ "X-Forwarded-For": "10.0.0.1, 198.51.100.2,  203.0.113.7 " })),
    "203.0.113.7",
  );
});

test("without a usable X-Forwarded-For the address is unknown", () => {
  assert.equal(clientIp(new Headers()), "unknown");
  assert.equal(clientIp(new Headers({ "X-Forwarded-For": " , " })), "unknown");
});

test("IPv4 addresses and unknown are rate-limited as they are", () => {
  assert.equal(rateLimitKeyForIp("203.0.113.7"), "203.0.113.7");
  assert.equal(rateLimitKeyForIp("unknown"), "unknown");
});

test("an IPv6 address is rate-limited by its /64", () => {
  assert.equal(rateLimitKeyForIp("2001:0db8:0000:0001:0000:0000:0000:0042"), "2001:db8:0:1::/64");
  assert.equal(rateLimitKeyForIp("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(rateLimitKeyForIp("::1"), "0:0:0:0::/64");
});

test("addresses in one /64 share a key, and different /64s do not", () => {
  assert.equal(rateLimitKeyForIp("2001:db8:0:1::a"), rateLimitKeyForIp("2001:db8:0:1:ffff::b"));
  assert.notEqual(rateLimitKeyForIp("2001:db8:0:1::a"), rateLimitKeyForIp("2001:db8:0:2::a"));
});

test("an IPv4-mapped IPv6 address is rate-limited as the IPv4 address", () => {
  assert.equal(rateLimitKeyForIp("::ffff:203.0.113.7"), "203.0.113.7");
});

test("case and a zone id do not change the key", () => {
  assert.equal(rateLimitKeyForIp("2001:DB8:0:1::A"), "2001:db8:0:1::/64");
  assert.equal(rateLimitKeyForIp("fe80::1%eth0"), "fe80:0:0:0::/64");
});

test("a malformed IPv6 value is used as it is", () => {
  assert.equal(rateLimitKeyForIp("2001:db8::1::2"), "2001:db8::1::2");
  assert.equal(rateLimitKeyForIp("2001:db8:zz::1"), "2001:db8:zz::1");
  assert.equal(rateLimitKeyForIp("1:2:3:4:5:6:7"), "1:2:3:4:5:6:7");
});
