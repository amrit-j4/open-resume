import { SIGN_IN_URL, SIGN_UP_URL, SITE_NAME } from "lib/site-config";
import { withReturnTo } from "lib/auth-gate";

export const SignUpToDownloadModal = ({
  checking,
  error,
  onRetry,
  onClose,
}: {
  checking: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="signup-to-download-title"
  >
    <div className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-xl">
      <h2 id="signup-to-download-title" className="text-xl font-semibold">
        Create a free {SITE_NAME} account to download
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Your resume is ready. Sign up or sign in to {SITE_NAME} to download it.
        Your resume is saved in this browser, and you will come straight back
        here afterwards.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <a
          href={withReturnTo(SIGN_UP_URL)}
          className="btn-primary text-center"
        >
          Sign up
        </a>
        <a
          href={withReturnTo(SIGN_IN_URL)}
          className="rounded-lg border border-gray-300 px-6 py-2 text-center font-semibold hover:bg-gray-100"
        >
          I already have an account
        </a>
        <button
          type="button"
          onClick={onRetry}
          disabled={checking}
          className="rounded-lg px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {checking ? "Checking..." : "I'm already signed in, download my resume"}
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
