import { createHash } from "crypto";
import { API_URL } from "lib/site-config";

/** Compares in time that doesn't depend on where the strings first differ, so the secret can't be guessed a character at a time. */
const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
};

/** Who is calling: a trusted caller with the shared secret, or a signed-in Job4online user (by id, so a limit follows the person, not the token). */
export type Caller = { kind: "key" } | { kind: "user"; id: string };

/**
 * Who may call the AI endpoints, and who they are:
 * - a caller with the shared secret in `x-api-key` (RESUME_IMPORT_API_KEY), or
 * - a signed-in Job4online user, proven by an access token the API accepts. The web page and the mobile app use this, so no secret ships to them.
 * With neither configured nor presented, the answer is null.
 */
export const authorize = async (req: Request): Promise<Caller | null> => {
  const secret = process.env.RESUME_IMPORT_API_KEY;
  const presentedKey = req.headers.get("x-api-key");
  if (secret && presentedKey && safeEqual(presentedKey, secret)) return { kind: "key" };

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const me = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!me.ok) return null;
    let body: { id?: unknown } | null = null;
    try {
      body = await me.json();
    } catch {
      // No readable body: the token was accepted, which is what matters. The id fallback below covers it.
    }
    // If the API ever stops sending an id, tell people apart by their token rather than letting everyone share one allowance.
    const id = typeof body?.id === "string" && body.id ? body.id : `token:${createHash("sha256").update(authorization).digest("hex").slice(0, 32)}`;
    return { kind: "user", id };
  } catch {
    return null;
  }
};

export const isAuthorized = async (req: Request): Promise<boolean> => (await authorize(req)) !== null;
