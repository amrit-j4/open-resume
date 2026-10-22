export const SITE_NAME = "Job4online";
export const SITE_RESUME_NAME = "Job4online Resume Builder";
export const JOB_BOARD_URL = (
  process.env.NEXT_PUBLIC_JOB_BOARD_URL || "https://job4online.com.au"
).replace(/\/$/, "");
export const DASHBOARD_URL = `${JOB_BOARD_URL}/dashboard`;

// AGPL-3.0 section 13: users interacting with this app over a network must be
// offered the source of the modified version. Point this at the public repo
// that contains this deployed code.
export const SOURCE_CODE_URL = "https://github.com/amrit-j4/open-resume";

export const ORIGINAL_PROJECT_NAME = "OpenResume";
export const ORIGINAL_PROJECT_URL = "https://github.com/xitanggg/open-resume";

// The Job4online API. A signed-in job seeker's session cookie is shared across the job4online.com.au subdomains, so this app
// (cv.job4online.com.au) can ask the API who is signed in. Set NEXT_PUBLIC_API_URL when building to point at another API (for example the
// local development tunnel).
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://new-j4api.job4online.com.au"
).replace(/\/$/, "");

// Sign-in and sign-up live on the job board itself.
export const SIGN_UP_URL = `${JOB_BOARD_URL}/auth/sign-up`;
export const SIGN_IN_URL = `${JOB_BOARD_URL}/auth/sign-in`;
