import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnDomainChecker, type DueDomain } from "./own-domain-checker.ts";

const now = new Date("2026-10-12T12:00:00Z");
const MINUTE = 60 * 1000;

function row(domain: string, overrides: Partial<DueDomain> = {}): DueDomain {
  return {
    siteId: `site-${domain}`,
    domain,
    siteHost: `${domain}.sites.test`,
    // 30 minutes old and never checked: due.
    createdAt: new Date(now.getTime() - 30 * MINUTE),
    lastCheckedAt: null,
    ...overrides,
  };
}

function setup(
  rows: DueDomain[],
  check: (
    r: DueDomain,
  ) => Promise<{ outcome: string; newlyVerified: boolean } | null> = async () => ({
    outcome: "no-txt",
    newlyVerified: false,
  }),
  prewarm: (domain: string) => Promise<void> = async () => {},
) {
  const checked: string[] = [];
  const prewarmed: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const checker = createOwnDomainChecker({
    dueCandidates: async () => rows,
    check: async (r) => {
      checked.push(r.domain);
      return check(r);
    },
    prewarm: async (domain) => {
      prewarmed.push(domain);
      return prewarm(domain);
    },
    now: () => now,
    log: (line) => logs.push(line),
  });
  return { checker, checked, prewarmed, logs };
}

test("a due row is checked", async () => {
  const { checker, checked } = setup([row("a.test")]);
  await checker.tick();
  assert.deepEqual(checked, ["a.test"]);
});

test("a row that is not due is not checked", async () => {
  const notDue = row("a.test", { lastCheckedAt: new Date(now.getTime() - MINUTE) });
  const { checker, checked } = setup([notDue]);
  await checker.tick();
  assert.deepEqual(checked, []);
});

test("a verification triggers exactly one pre-warm, a non-verification none", async () => {
  const { checker, prewarmed } = setup([row("a.test"), row("b.test")], async (r) => ({
    outcome: r.domain === "a.test" ? "verified" : "no-txt",
    newlyVerified: r.domain === "a.test",
  }));
  await checker.tick();
  assert.deepEqual(prewarmed, ["a.test"]);
});

test("a check that throws is logged and the next row still runs", async () => {
  const { checker, checked, logs } = setup([row("a.test"), row("b.test")], async (r) => {
    if (r.domain === "a.test") throw new Error("lookup blew up");
    return { outcome: "no-txt", newlyVerified: false };
  });
  await checker.tick();
  assert.deepEqual(checked, ["a.test", "b.test"]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.event, "own_domain_check_failed");
  assert.equal(logs[0]?.domain, "a.test");
});

test("a pre-warm that rejects is logged and swallowed", async () => {
  const { checker, logs } = setup(
    [row("a.test")],
    async () => ({ outcome: "verified", newlyVerified: true }),
    async () => {
      throw new Error("no route");
    },
  );
  await checker.tick();
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.event, "own_domain_prewarm_failed");
});

test("25 due rows: 20 are checked, oldest last check first, never-checked first", async () => {
  const rows = Array.from({ length: 25 }, (_, n) =>
    row(`d${n}.test`, {
      // d0..d4 were checked 40 minutes ago, newest to oldest by index; the rest never.
      lastCheckedAt: n < 5 ? new Date(now.getTime() - (40 + n) * MINUTE) : null,
    }),
  );
  const { checker, checked } = setup(rows);
  await checker.tick();
  assert.equal(checked.length, 20);
  // 20 never-checked rows come first; the five previously checked ones wait.
  assert.equal(
    checked.some((d) => /^d[0-4]\.test$/.test(d)),
    false,
  );
});

test("rows are checked one at a time", async () => {
  let running = 0;
  let peak = 0;
  const { checker } = setup([row("a.test"), row("b.test"), row("c.test")], async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return { outcome: "no-txt", newlyVerified: false };
  });
  await checker.tick();
  assert.equal(peak, 1);
});

test("a tick that starts while another is running does nothing", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { checker, checked } = setup([row("a.test")], async () => {
    await gate;
    return { outcome: "no-txt", newlyVerified: false };
  });
  const first = checker.tick();
  await checker.tick();
  assert.deepEqual(checked, ["a.test"]);
  release();
  await first;
  await checker.tick();
  assert.deepEqual(checked, ["a.test", "a.test"]);
});

test("a failing candidate query is logged and does not throw", async () => {
  const logs: Record<string, unknown>[] = [];
  const checker = createOwnDomainChecker({
    dueCandidates: async () => {
      throw new Error("db down");
    },
    check: async () => null,
    prewarm: async () => {},
    now: () => now,
    log: (line) => logs.push(line),
  });
  await checker.tick();
  assert.equal(logs[0]?.event, "own_domain_tick_failed");
});
