import assert from "node:assert/strict";
import test from "node:test";
import { data, UNSAFE_ErrorResponseImpl as ErrorResponseImpl } from "react-router";
import { isRoutineRefusal } from "./server-errors.ts";

// Built the way the router builds its own: the message wrapped in an Error,
// marked internal.
function routerError(status: number, message: string) {
  return new ErrorResponseImpl(status, "", new Error(message), true);
}

test("a URL no route matches is a routine refusal", () => {
  assert.equal(isRoutineRefusal(routerError(404, 'No route matches URL "/wp-login.php"')), true);
});

test("a POST to a route with no action is a routine refusal", () => {
  assert.equal(
    isRoutineRefusal(
      routerError(405, 'You made a POST request to "/" but did not provide an `action`'),
    ),
    true,
  );
});

test("a router-generated 400 is not a routine refusal", () => {
  assert.equal(isRoutineRefusal(routerError(400, "Bad Request")), false);
});

test("a router-generated 500 is not a routine refusal", () => {
  assert.equal(isRoutineRefusal(routerError(500, "Unexpected")), false);
});

test("a 404 thrown by app code with data() is not a routine refusal", () => {
  // What a loader's `throw data("Not Found", { status: 404 })` becomes.
  const thrown = data("Not Found", { status: 404 });
  const response = new ErrorResponseImpl(thrown.init?.status ?? 500, "", thrown.data);
  assert.equal(isRoutineRefusal(response), false);
});

test("a plain Error is not a routine refusal", () => {
  assert.equal(isRoutineRefusal(new Error("connect ECONNREFUSED 127.0.0.1:5432")), false);
});

test("a non-object is not a routine refusal", () => {
  assert.equal(isRoutineRefusal(undefined), false);
  assert.equal(isRoutineRefusal("Not Found"), false);
});
