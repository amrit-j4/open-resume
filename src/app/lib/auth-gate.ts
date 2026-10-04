import { API_URL } from "lib/site-config";

/**
 * Asks the Job4online API whether the visitor has a signed-in session.
 * Resolves true/false; throws if the API can't be reached.
 */
export const isSignedIn = async (): Promise<boolean> => {
  const res = await fetch(`${API_URL}/session/status`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Session check failed (${res.status})`);
  const data = (await res.json()) as { authenticated?: boolean };
  return data.authenticated === true;
};
