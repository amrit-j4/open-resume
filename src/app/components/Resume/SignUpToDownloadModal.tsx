import { SIGN_IN_URL, SIGN_UP_URL, SITE_NAME } from "lib/site-config";

/**
 * Shown when an action needs a Job4online account. Sign-in opens in a new tab so this page, and the resume the visitor has built (kept
 * in this browser), stay put; the visitor comes back and retries from here.
 */
export const SignUpToDownloadModal = ({
  action,
  checking,
  error,
  onRetry,
  onClose,
}: {
  action: "download" | "save";
  checking: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) => {
  const verb = action === "download" ? "download" : "save";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-to-download-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-xl">
        <h2 id="signup-to-download-title" className="text-xl font-semibold">
          Create a free {SITE_NAME} account to {verb}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Your resume is ready. Sign up or sign in to {SITE_NAME} in a new tab,
          then come back here to {verb} it. Your resume is kept in this
          browser, so nothing is lost.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <a
            href={SIGN_UP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-center"
          >
            Sign up (opens in a new tab)
          </a>
          <a
            href={SIGN_IN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-6 py-2 text-center font-semibold hover:bg-gray-100"
          >
            I already have an account (opens in a new tab)
          </a>
          <button
            type="button"
            onClick={onRetry}
            disabled={checking}
            className="rounded-lg px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {checking ? "Checking..." : `I'm signed in, ${verb} my resume`}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-gray-500 underline underline-offset-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
};
