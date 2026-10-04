export const SITE_NAME = "Job4online";
export const SITE_RESUME_NAME = "Job4online Resume Builder";
export const JOB_BOARD_URL = "https://job4online.com.au";

// AGPL-3.0 section 13: users interacting with this app over a network must be
// offered the source of the modified version. Point this at the public repo
// that contains this deployed code.
export const SOURCE_CODE_URL = "https://github.com/amrit-j4/open-resume";

export const ORIGINAL_PROJECT_NAME = "OpenResume";
export const ORIGINAL_PROJECT_URL = "https://github.com/xitanggg/open-resume";

// Job4online API (Better Auth). The session cookie is shared across
// *.job4online.com.au, so this app (cv.job4online.com.au) can check sign-in state.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.job4online.com.au"
).replace(/\/$/, "");
export const SEEKER_APP_URL = "https://seeker.job4online.com.au";
export const SIGN_UP_URL = `${SEEKER_APP_URL}/auth/sign-up`;
export const SIGN_IN_URL = `${SEEKER_APP_URL}/auth/sign-in`;
