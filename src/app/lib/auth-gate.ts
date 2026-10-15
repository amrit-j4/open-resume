import { API_URL } from "lib/site-config";

/** Old endpoint (`GET /session/status`). Resolves true/false; throws if it is missing, unreachable or errors. */
const checkLegacySession = async (): Promise<boolean> => {
  const res = await fetch(`${API_URL}/session/status`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Legacy session check failed (${res.status})`);
  const data = (await res.json()) as { authenticated?: boolean };
  return data.authenticated === true;
};

/**
 * New endpoint. The job board's refresh cookie is shared with this app (same site in production, same host across ports locally), so
 * `POST /auth/refresh` answers 200 for a signed-in seeker, or 401/403 when nobody (or a non-seeker) is signed in.
 */
const checkRefreshSession = async (): Promise<boolean> => {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (res.ok) return true;
  if (res.status === 401 || res.status === 403) return false;
  throw new Error(`Session check failed (${res.status})`);
};

/**
 * Asks the Job4online API whether the visitor has a signed-in session. The old endpoint is tried first; if it says yes that is the
 * answer. If it says no, errors or does not exist, the new refresh endpoint is the fallback, so either one signing the user in counts.
 * Resolves true/false; throws only if neither could be reached.
 */
export const isSignedIn = async (): Promise<boolean> => {
  let legacyError: unknown = null;
  try {
    if (await checkLegacySession()) return true;
  } catch (error) {
    legacyError = error;
  }

  try {
    return await checkRefreshSession();
  } catch (error) {
    // Legacy said "not signed in" cleanly and the new one failed: trust the clean answer. Both failing is a real error.
    if (legacyError === null) return false;
    throw error;
  }
};

/**
 * Builds a seeker sign-up / sign-in link that returns the user to this page
 * afterwards (via the seeker's /auth/return page, which only accepts this origin).
 */
export const withReturnTo = (authUrl: string): string => {
  const here = `${window.location.origin}${window.location.pathname}`;
  const callback = `/auth/return?to=${here}`;
  return `${authUrl}?callbackURL=${encodeURIComponent(callback)}`;
};
