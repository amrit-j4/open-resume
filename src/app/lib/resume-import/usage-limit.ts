import type { Caller } from "lib/resume-import/authorize";

/**
 * Stops one person from running up the AI bill. Every import or analysis calls the model, so each signed-in user gets:
 * - a daily allowance for each of the two actions, and
 * - one request at a time (so parallel calls can't get around the allowance).
 * Callers with the shared secret are trusted and not limited.
 *
 * The counts are kept in this server's memory, so they reset when it restarts or is redeployed, and each instance counts for itself. That is
 * fine for an abuse guard on one container; if this ever runs as several instances, keep the counts somewhere they share (Redis, a table).
 */

export type UsageAction = "import" | "analysis";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMITS: Record<UsageAction, number> = { import: 10, analysis: 5 };
const ENV_NAMES: Record<UsageAction, string> = { import: "RESUME_IMPORT_DAILY_LIMIT", analysis: "RESUME_ANALYSIS_DAILY_LIMIT" };
const LABELS: Record<UsageAction, string> = { import: "resume imports", analysis: "resume analyses" };
/** Above this many people tracked, forget the ones whose day has passed. */
const SWEEP_ABOVE = 5_000;

/** The daily allowance, from the environment when it is a whole number (0 turns the action off), else the default. */
export const dailyLimit = (action: UsageAction): number => {
  const value = Number(process.env[ENV_NAMES[action]]);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_LIMITS[action];
};

/** When each user's requests were made in the last day, per action. */
const history = new Map<string, number[]>();
/** The users with a request running now. */
const running = new Set<string>();

const keyOf = (action: UsageAction, userId: string) => `${action}:${userId}`;

const recent = (key: string, now: number): number[] => {
  const times = (history.get(key) ?? []).filter((time) => now - time < DAY_MS);
  if (times.length) history.set(key, times);
  else history.delete(key);
  return times;
};

const sweep = (now: number) => {
  if (history.size <= SWEEP_ABOVE) return;
  for (const key of Array.from(history.keys())) recent(key, now);
};

const hoursUntil = (ms: number) => Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));

export type UsageResult =
  | { allowed: true; /** Call when the request is over. A failure on our side (`refund`) doesn't use up the person's allowance. */ done: (options?: { refund?: boolean }) => void }
  | { allowed: false; status: 429; message: string; retryAfterSeconds: number };

/** Takes one use of the daily allowance and the user's single running slot, or says why not. Always call `done` when allowed. */
export const startUsage = (caller: Caller, action: UsageAction, now = Date.now()): UsageResult => {
  if (caller.kind === "key") return { allowed: true, done: () => undefined };

  const limit = dailyLimit(action);
  const key = keyOf(action, caller.id);
  const times = recent(key, now);

  if (limit === 0) {
    return { allowed: false, status: 429, message: `${capital(LABELS[action])} are switched off right now.`, retryAfterSeconds: 3600 };
  }
  if (running.has(caller.id)) {
    return { allowed: false, status: 429, message: "You already have a request in progress. Wait for it to finish, then try again.", retryAfterSeconds: 30 };
  }
  if (times.length >= limit) {
    const wait = times[0] + DAY_MS - now;
    return {
      allowed: false,
      status: 429,
      message: `You've reached today's limit of ${limit} ${LABELS[action]}. Try again in about ${hoursUntil(wait)} ${hoursUntil(wait) === 1 ? "hour" : "hours"}.`,
      retryAfterSeconds: Math.ceil(wait / 1000),
    };
  }

  sweep(now);
  running.add(caller.id);
  history.set(key, [...times, now]);

  let finished = false;
  return {
    allowed: true,
    done: ({ refund = false } = {}) => {
      if (finished) return;
      finished = true;
      running.delete(caller.id);
      if (refund) {
        const left = recent(key, Date.now());
        const at = left.lastIndexOf(now);
        if (at >= 0) left.splice(at, 1);
        if (left.length) history.set(key, left);
        else history.delete(key);
      }
    },
  };
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** For tests: forget everything. */
export const resetUsage = () => {
  history.clear();
  running.clear();
};
