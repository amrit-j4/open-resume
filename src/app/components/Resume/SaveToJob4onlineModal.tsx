import { SITE_NAME } from "lib/site-config";

/** Asks before the resume is uploaded, since saving files it under the person's Job4online account rather than on their device. */
export const SaveToJob4onlineModal = ({
  saving,
  onConfirm,
  onClose,
}: {
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="save-to-job4online-title"
  >
    <div className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-xl">
      <h2 id="save-to-job4online-title" className="text-xl font-semibold">
        Save to {SITE_NAME}?
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        This will be saved to the {SITE_NAME} platform, in your account&rsquo;s resumes, where it is used to match you with jobs.
        To keep a copy on your device instead, use Download.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving…" : `Save to ${SITE_NAME}`}
        </button>
      </div>
    </div>
  </div>
);
