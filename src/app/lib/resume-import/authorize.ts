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

/**
 * Who may call the import endpoint:
 * - a caller with the shared secret in `x-api-key` (RESUME_IMPORT_API_KEY), such as the mobile app, or
 * - a signed-in Job4online user, proven by an access token the API accepts. The web page uses this so no secret ships to the browser.
 * With neither configured nor presented, the answer is no.
 */
export const isAuthorized = async (req: Request): Promise<boolean> => {
  const secret = process.env.RESUME_IMPORT_API_KEY;
  const presentedKey = req.headers.get("x-api-key");
  if (secret && presentedKey && safeEqual(presentedKey, secret)) return true;

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  try {
    const me = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    return me.ok;
  } catch {
    return false;
  }
};
