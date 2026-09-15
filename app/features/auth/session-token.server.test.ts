import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import {
  SESSION_LIFETIME_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./session-token.server.ts";

const SECRET = "test-secret-that-is-at-least-32-characters";
const USER_ID = "6f1d3c2a-8b4e-4f6a-9c1d-2e3f4a5b6c7d";
const LOGIN_TIME = new Date("2026-09-15T10:00:00Z");

function secondsAfterLogin(seconds: number): Date {
  return new Date(LOGIN_TIME.getTime() + seconds * 1000);
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

test("a signed token verifies and returns its claims", async () => {
  const token = await signSessionToken({ userId: USER_ID, tokenVersion: 3 }, SECRET, LOGIN_TIME);
  assert.deepEqual(await verifySessionToken(token, SECRET, secondsAfterLogin(60)), {
    userId: USER_ID,
    tokenVersion: 3,
  });
});

test("a token is valid until seven days after login, and not after", async () => {
  // A literal, not SESSION_LIFETIME_SECONDS: the week is the contract under test.
  const sevenDays = 604_800;
  const token = await signSessionToken({ userId: USER_ID, tokenVersion: 0 }, SECRET, LOGIN_TIME);
  assert.notEqual(await verifySessionToken(token, SECRET, secondsAfterLogin(sevenDays - 1)), null);
  assert.equal(await verifySessionToken(token, SECRET, secondsAfterLogin(sevenDays + 1)), null);
});

test("a token with a tampered payload is rejected", async () => {
  const token = await signSessionToken({ userId: USER_ID, tokenVersion: 0 }, SECRET, LOGIN_TIME);
  const [header, , signature] = token.split(".");
  const raisedVersion = base64url({
    sub: USER_ID,
    tv: 5,
    iss: "habre-cms",
    iat: Math.floor(LOGIN_TIME.getTime() / 1000),
    exp: Math.floor(LOGIN_TIME.getTime() / 1000) + SESSION_LIFETIME_SECONDS,
  });
  const tampered = `${header}.${raisedVersion}.${signature}`;
  assert.equal(await verifySessionToken(tampered, SECRET, secondsAfterLogin(60)), null);
});

test("a token signed with another secret is rejected", async () => {
  const token = await signSessionToken(
    { userId: USER_ID, tokenVersion: 0 },
    "another-secret-that-is-also-32-characters-long",
    LOGIN_TIME,
  );
  assert.equal(await verifySessionToken(token, SECRET, secondsAfterLogin(60)), null);
});

test("an unsigned alg:none token is rejected", async () => {
  const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
    sub: USER_ID,
    tv: 0,
    iss: "habre-cms",
    iat: Math.floor(LOGIN_TIME.getTime() / 1000),
    exp: Math.floor(LOGIN_TIME.getTime() / 1000) + SESSION_LIFETIME_SECONDS,
  })}.`;
  assert.equal(await verifySessionToken(unsigned, SECRET, secondsAfterLogin(60)), null);
});

test("correctly signed tokens with invalid claims are rejected", async () => {
  const key = new TextEncoder().encode(SECRET);
  const issuedAt = Math.floor(LOGIN_TIME.getTime() / 1000);
  const sign = (payload: Record<string, unknown>, build: (jwt: SignJWT) => SignJWT) =>
    build(new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt(issuedAt)).sign(
      key,
    );
  const week = issuedAt + SESSION_LIFETIME_SECONDS;
  const invalid = {
    "non-UUID subject": await sign({ tv: 0 }, (jwt) =>
      jwt.setSubject("1 or 1=1").setIssuer("habre-cms").setExpirationTime(week),
    ),
    "negative token version": await sign({ tv: -1 }, (jwt) =>
      jwt.setSubject(USER_ID).setIssuer("habre-cms").setExpirationTime(week),
    ),
    "missing token version": await sign({}, (jwt) =>
      jwt.setSubject(USER_ID).setIssuer("habre-cms").setExpirationTime(week),
    ),
    "another issuer": await sign({ tv: 0 }, (jwt) =>
      jwt.setSubject(USER_ID).setIssuer("someone-else").setExpirationTime(week),
    ),
    "no expiry": await sign({ tv: 0 }, (jwt) => jwt.setSubject(USER_ID).setIssuer("habre-cms")),
  };
  for (const [description, token] of Object.entries(invalid)) {
    assert.equal(await verifySessionToken(token, SECRET, secondsAfterLogin(60)), null, description);
  }
});

test("something that is not a token at all is rejected", async () => {
  for (const garbage of ["", "garbage", "a.b.c", "e30.e30.e30"]) {
    assert.equal(await verifySessionToken(garbage, SECRET), null, garbage);
  }
});
