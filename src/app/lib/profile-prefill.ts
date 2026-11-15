import { API_URL } from "lib/site-config";
import { getAccessToken } from "lib/auth-gate";
import type { Resume, ResumeProfile } from "lib/redux/types";

/** The profile fields a Job4online account can fill in on a new resume. */
export type ProfilePrefill = Partial<
  Pick<ResumeProfile, "name" | "email" | "phone" | "location" | "summary">
>;

const REQUEST_TIMEOUT_MS = 4000;

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * What the signed-in job seeker has already told Job4online: their name and email (`GET /auth/me`) and what they entered in onboarding or
 * edited in their profile (`GET /seeker/profile`: name, phone, location and the "about" text, which becomes the resume summary).
 *
 * Resolves to null when nobody is signed in, the account is not a job seeker, or the API can't be reached: a new resume then just starts
 * blank, as it always did. Never rejects. The access token comes from the refresh cookie shared with the job board (see auth-gate).
 */
export const fetchProfilePrefill = async (): Promise<ProfilePrefill | null> => {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const init = {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store" as const,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    const [me, profile] = await Promise.all([
      fetch(`${API_URL}/auth/me`, init)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch(`${API_URL}/seeker/profile`, init)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]);

    const profileName = [clean(profile?.firstName), clean(profile?.lastName)]
      .filter(Boolean)
      .join(" ");
    const prefill: ProfilePrefill = {
      name: profileName || clean(me?.name),
      email: clean(me?.email),
      phone: clean(profile?.phone),
      location: clean(profile?.location),
      summary: clean(profile?.about),
    };
    return Object.values(prefill).some(Boolean) ? prefill : null;
  } catch {
    return null;
  }
};

/** A copy of the resume with the account details filled in. A field that already has text is never overwritten. */
export const applyProfilePrefill = (
  resume: Resume,
  prefill: ProfilePrefill | null
): Resume => {
  if (!prefill) return resume;
  const profile = { ...resume.profile };
  for (const field of Object.keys(prefill) as (keyof ProfilePrefill)[]) {
    const value = prefill[field];
    if (value && !profile[field].trim()) profile[field] = value;
  }
  return { ...resume, profile };
};
