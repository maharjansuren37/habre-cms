import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHostRouting } from "./host-routing.ts";

const HOSTS = {
  publicHost: "surenmaharjan.fyi",
  adminHost: "cms.surenmaharjan.fyi",
  publicOrigin: "https://surenmaharjan.fyi",
  adminOrigin: "https://cms.surenmaharjan.fyi",
};

function decide(overrides: {
  method?: string;
  pathname: string;
  search?: string;
  requestHost: string;
  publicHost?: string;
  adminHost?: string;
}) {
  return resolveHostRouting({
    method: "GET",
    search: "",
    ...HOSTS,
    ...overrides,
  });
}

test("allows everything when the two hosts are equal (development, single-host test server)", () => {
  assert.deepEqual(
    decide({
      pathname: "/admin/posts",
      requestHost: "127.0.0.1:3000",
      publicHost: "127.0.0.1:3000",
      adminHost: "127.0.0.1:3000",
    }),
    { kind: "allow" },
  );
});

test("answers /healthz on the admin host without redirecting", () => {
  assert.deepEqual(decide({ pathname: "/healthz", requestHost: HOSTS.adminHost }), {
    kind: "allow",
  });
});

test("answers /healthz on the public host without redirecting", () => {
  assert.deepEqual(decide({ pathname: "/healthz", requestHost: HOSTS.publicHost }), {
    kind: "allow",
  });
});

test("redirects the admin host's bare / to /admin", () => {
  assert.deepEqual(decide({ pathname: "/", requestHost: HOSTS.adminHost }), {
    kind: "redirect",
    to: "/admin",
  });
});

test("refuses a POST to / on the admin host rather than redirecting it", () => {
  assert.deepEqual(decide({ method: "POST", pathname: "/", requestHost: HOSTS.adminHost }), {
    kind: "not-found",
  });
});

test("allows an admin path on the admin host", () => {
  assert.deepEqual(decide({ pathname: "/admin/posts", requestHost: HOSTS.adminHost }), {
    kind: "allow",
  });
});

test("does not treat a path that merely starts with 'admin' as an admin path", () => {
  assert.deepEqual(decide({ pathname: "/adminfoo", requestHost: HOSTS.adminHost }), {
    kind: "redirect",
    to: "https://surenmaharjan.fyi/adminfoo",
  });
});

test("redirects a public path on the admin host to the public host, query string included", () => {
  assert.deepEqual(
    decide({ pathname: "/posts/hello", search: "?ref=x", requestHost: HOSTS.adminHost }),
    { kind: "redirect", to: "https://surenmaharjan.fyi/posts/hello?ref=x" },
  );
});

test("refuses a non-GET/HEAD public path on the admin host rather than redirecting it", () => {
  assert.deepEqual(
    decide({ method: "POST", pathname: "/posts/hello", requestHost: HOSTS.adminHost }),
    { kind: "not-found" },
  );
});

test("redirects an admin path on the public host to the admin host, query string included", () => {
  assert.deepEqual(
    decide({ pathname: "/admin/posts", search: "?page=2", requestHost: HOSTS.publicHost }),
    { kind: "redirect", to: "https://cms.surenmaharjan.fyi/admin/posts?page=2" },
  );
});

test("refuses a non-GET/HEAD admin path on the public host rather than redirecting it", () => {
  assert.deepEqual(
    decide({ method: "POST", pathname: "/admin/posts", requestHost: HOSTS.publicHost }),
    { kind: "not-found" },
  );
});

test("allows a public path on the public host", () => {
  assert.deepEqual(decide({ pathname: "/posts/hello", requestHost: HOSTS.publicHost }), {
    kind: "allow",
  });
});

test("refuses a request whose host matches neither", () => {
  assert.deepEqual(decide({ pathname: "/", requestHost: "evil.example" }), {
    kind: "not-found",
  });
});

test("allows /signup, the pages under it and /verify on the admin host", () => {
  for (const pathname of ["/signup", "/signup/sent", "/verify"]) {
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.adminHost }), { kind: "allow" });
  }
});

test("redirects /signup and /verify on the public host to the admin host, query string included", () => {
  assert.deepEqual(
    decide({ pathname: "/verify", search: "?token=abc", requestHost: HOSTS.publicHost }),
    { kind: "redirect", to: "https://cms.surenmaharjan.fyi/verify?token=abc" },
  );
  assert.deepEqual(
    decide({ method: "HEAD", pathname: "/signup/sent", requestHost: HOSTS.publicHost }),
    { kind: "redirect", to: "https://cms.surenmaharjan.fyi/signup/sent" },
  );
});

test("refuses a POST to /signup or /verify on the public host rather than redirecting it", () => {
  for (const pathname of ["/signup", "/verify"]) {
    assert.deepEqual(decide({ method: "POST", pathname, requestHost: HOSTS.publicHost }), {
      kind: "not-found",
    });
  }
});

test("treats /signupx and /verify/x as public paths", () => {
  for (const pathname of ["/signupx", "/verify/x"]) {
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.publicHost }), { kind: "allow" });
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.adminHost }), {
      kind: "redirect",
      to: `https://surenmaharjan.fyi${pathname}`,
    });
  }
});

test("treats /forgot-password and /reset-password like admin paths on both hosts", () => {
  for (const pathname of ["/forgot-password", "/reset-password"]) {
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.adminHost }), { kind: "allow" });
    assert.deepEqual(decide({ pathname, search: "?token=abc", requestHost: HOSTS.publicHost }), {
      kind: "redirect",
      to: `https://cms.surenmaharjan.fyi${pathname}?token=abc`,
    });
    assert.deepEqual(decide({ method: "POST", pathname, requestHost: HOSTS.publicHost }), {
      kind: "not-found",
    });
  }
});

test("treats /forgot-passwords as a public path", () => {
  assert.deepEqual(decide({ pathname: "/forgot-passwords", requestHost: HOSTS.publicHost }), {
    kind: "allow",
  });
});
