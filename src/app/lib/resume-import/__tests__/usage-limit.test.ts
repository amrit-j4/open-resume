import { dailyLimit, resetUsage, startUsage } from "lib/resume-import/usage-limit";

const originalEnv = process.env;
const DAY = 24 * 60 * 60 * 1000;
const alice = { kind: "user", id: "alice" } as const;
const bob = { kind: "user", id: "bob" } as const;

beforeEach(() => {
  resetUsage();
  process.env = { ...originalEnv };
  delete process.env.RESUME_IMPORT_DAILY_LIMIT;
  delete process.env.RESUME_ANALYSIS_DAILY_LIMIT;
});

afterEach(() => {
  process.env = originalEnv;
});

/** Runs one request to completion at the given time. */
const use = (caller: Parameters<typeof startUsage>[0], action: "import" | "analysis", now: number, options?: { refund?: boolean }) => {
  const result = startUsage(caller, action, now);
  if (result.allowed) result.done(options);
  return result;
};

describe("startUsage", () => {
  test("allows up to the daily limit, then answers 429 with when to retry", () => {
    for (let i = 0; i < 5; i++) expect(use(alice, "analysis", 1000 + i).allowed).toBe(true);

    const blocked = use(alice, "analysis", 2000);

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.status).toBe(429);
      expect(blocked.message).toContain("limit of 5 resume analyses");
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  test("counts each action and each person separately", () => {
    for (let i = 0; i < 5; i++) use(alice, "analysis", 1000 + i);

    expect(use(alice, "import", 2000).allowed).toBe(true);
    expect(use(bob, "analysis", 2000).allowed).toBe(true);
  });

  test("gives the allowance back after a day", () => {
    for (let i = 0; i < 5; i++) use(alice, "analysis", 1000 + i);

    expect(use(alice, "analysis", 1000 + DAY - 1).allowed).toBe(false);
    expect(use(alice, "analysis", 1000 + DAY + 1).allowed).toBe(true);
  });

  test("allows one request at a time per person", () => {
    const first = startUsage(alice, "analysis", 1000);
    const second = startUsage(alice, "import", 1001);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    if (!second.allowed) expect(second.message).toContain("already have a request in progress");
    expect(startUsage(bob, "analysis", 1002).allowed).toBe(true);

    if (first.allowed) first.done();
    expect(startUsage(alice, "import", 1003).allowed).toBe(true);
  });

  test("does not use up the allowance when the request failed on our side", () => {
    for (let i = 0; i < 5; i++) expect(use(alice, "analysis", 1000 + i, { refund: true }).allowed).toBe(true);

    expect(use(alice, "analysis", 2000).allowed).toBe(true);
  });

  test("a request that is finished twice is only released once", () => {
    const first = startUsage(alice, "analysis", 1000);
    if (first.allowed) {
      first.done();
      const second = startUsage(alice, "analysis", 1001);
      first.done({ refund: true }); // must not free the second request's slot or allowance
      expect(startUsage(alice, "analysis", 1002).allowed).toBe(false);
      if (second.allowed) second.done();
    }
  });

  test("does not limit callers with the shared secret", () => {
    for (let i = 0; i < 50; i++) expect(startUsage({ kind: "key" }, "analysis", 1000 + i).allowed).toBe(true);
  });

  test("reads the limit from the environment, and 0 switches the action off", () => {
    process.env.RESUME_IMPORT_DAILY_LIMIT = "2";
    process.env.RESUME_ANALYSIS_DAILY_LIMIT = "0";

    expect(dailyLimit("import")).toBe(2);
    expect(use(alice, "import", 1000).allowed).toBe(true);
    expect(use(alice, "import", 1001).allowed).toBe(true);
    expect(use(alice, "import", 1002).allowed).toBe(false);
    expect(use(alice, "analysis", 1003).allowed).toBe(false);
  });

  test("ignores a limit that is not a whole number", () => {
    process.env.RESUME_ANALYSIS_DAILY_LIMIT = "lots";
    expect(dailyLimit("analysis")).toBe(5);
    process.env.RESUME_ANALYSIS_DAILY_LIMIT = "-3";
    expect(dailyLimit("analysis")).toBe(5);
  });
});
