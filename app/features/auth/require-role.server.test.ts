import assert from "node:assert/strict";
import { test } from "node:test";
import { RouterContextProvider } from "react-router";
import { requireRole } from "./require-role.server.ts";
import { userContext } from "./user-context.ts";

function contextFor(role: "admin" | "editor" | "author") {
  const context = new RouterContextProvider();
  context.set(userContext, { id: "u1", email: "a@b.c", name: "A", role });
  return context;
}

const request = new Request("http://x/admin/pages", { headers: { "X-Forwarded-For": "9.9.9.9" } });

// `data("Not Found", { status: 404 })` throws the plain object it builds - the
// router only turns it into a route error response once it reaches actual
// routing, which this unit test does not exercise.
test("a role outside the allowed list is refused with Not Found, not a forbidden page", async () => {
  const middleware = requireRole(["admin", "editor"]);
  await assert.rejects(
    async () => {
      await middleware(
        { request, url: new URL(request.url), context: contextFor("author") } as never,
        async () => new Response(),
      );
    },
    (error: unknown) => {
      assert.equal((error as { data: unknown }).data, "Not Found");
      assert.equal((error as { init?: { status: number } }).init?.status, 404);
      return true;
    },
  );
});

test("a refusal is logged (F-82), with the path, the role, and the IP", async () => {
  const middleware = requireRole(["admin", "editor"]);
  const originalWarn = console.warn;
  const logged: unknown[] = [];
  console.warn = (line: string) => logged.push(JSON.parse(line));
  try {
    await assert.rejects(async () => {
      await middleware(
        { request, url: new URL(request.url), context: contextFor("author") } as never,
        async () => new Response(),
      );
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(logged, [
    {
      event: "request_refused",
      reason: "role",
      path: "/admin/pages",
      role: "author",
      ip: "9.9.9.9",
    },
  ]);
});

test("an allowed role passes through to the next handler, and logs nothing", async () => {
  const middleware = requireRole(["admin", "editor"]);
  const response = new Response("ok");
  const originalWarn = console.warn;
  const logged: unknown[] = [];
  console.warn = (line: string) => logged.push(line);
  try {
    for (const role of ["admin", "editor"] as const) {
      const result = await middleware(
        { request, url: new URL(request.url), context: contextFor(role) } as never,
        async () => response,
      );
      assert.equal(result, response);
    }
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(logged, []);
});
