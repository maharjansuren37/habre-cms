import assert from "node:assert/strict";
import { test } from "node:test";
import { fitLongerSide, svgShape } from "./svg-size.ts";

test("width and height in pixels give the shape", () => {
  assert.deepEqual(svgShape('<svg xmlns="x" width="400" height="200px">'), {
    width: 400,
    height: 200,
  });
});

test("a viewBox alone gives its ratio, with spaces or commas", () => {
  assert.deepEqual(svgShape('<svg viewBox="0 0 400 200">'), { width: 400, height: 200 });
  assert.deepEqual(svgShape("<svg viewBox='0,0,50,100'>"), { width: 50, height: 100 });
});

test("percent sizes fall back to the viewBox, and no size at all gives null", () => {
  assert.deepEqual(svgShape('<svg width="100%" height="100%" viewBox="0 0 30 10">'), {
    width: 30,
    height: 10,
  });
  assert.equal(svgShape("<svg>"), null);
  assert.equal(svgShape("not an svg"), null);
});

test("a rect's own width does not count as the svg's", () => {
  assert.equal(svgShape('<svg><rect width="5" height="5"/></svg>'), null);
});

test("the longer side becomes 1200 and the ratio is kept", () => {
  assert.deepEqual(fitLongerSide({ width: 400, height: 200 }), { width: 1200, height: 600 });
  assert.deepEqual(fitLongerSide({ width: 100, height: 400 }), { width: 300, height: 1200 });
  assert.deepEqual(fitLongerSide({ width: 5000, height: 5000 }), { width: 1200, height: 1200 });
});
