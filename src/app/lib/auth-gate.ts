import { API_URL } from "lib/site-config";

/**
 * The visitor's access token, or null when nobody (or a non-seeker) is signed in. The job board's refresh cookie is shared with this
 * app, so `POST /auth/refresh` answers 200 with a token for a signed-in seeker and 401/403 otherwise. Throws if the API cannot be
 * reached or errors, so callers can tell "not signed in" apart from "could not check".
 */
export const getAccessToken = async (): Promise<string | null> => {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (res.ok) {
    const { accessToken } = (await res.json()) as { accessToken?: string };
    return accessToken ?? null;
  }
  if (res.status === 401 || res.status === 403) return null;
  throw new Error(`Session check failed (${res.status})`);
};

/** True when a Job4online seeker is signed in. */
export const isSignedIn = async (): Promise<boolean> => (await getAccessToken()) !== null;
