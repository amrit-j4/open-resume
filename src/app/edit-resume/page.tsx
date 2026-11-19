"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "lib/auth-gate";
import { setEditingResume } from "lib/editing-resume";
import { saveStateToLocalStorage } from "lib/redux/local-storage";
import type { Resume } from "lib/redux/types";
import { builderStateFromImportedResume } from "lib/resume-import/to-builder-state";
import { DASHBOARD_URL, SIGN_IN_URL, SITE_NAME } from "lib/site-config";

type Status = "loading" | "needs-account" | "error";

/**
 * Where "Edit" on the Job4online resumes page lands: `/edit-resume?id=<resume id>`. It reads that resume back into the builder (the same AI
 * reading as an import), remembers which resume is being edited, and opens the builder. Saving there replaces that resume.
 */
function EditResume() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  // Strict mode runs effects twice in development; one reading is enough (and each costs an AI call).
  const started = useRef(false);

  const load = useCallback(async () => {
    if (!id) {
      setStatus("error");
      setError("Choose a resume to edit from your Job4online resumes.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus("needs-account");
        return;
      }

      const res = await fetch("/api/resume-edit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => null)) as { resume?: Resume; name?: string; error?: string } | null;
      if (!res.ok || !data?.resume) {
        throw new Error(data?.error ?? "We couldn't read this resume. Try another one.");
      }

      saveStateToLocalStorage(builderStateFromImportedResume(data.resume));
      setEditingResume({ id, name: data.name ?? "your resume" });
      router.replace("/resume-builder");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof TypeError
          ? "We couldn't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "We couldn't read this resume. Try another one."
      );
    }
  }, [id, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-balance text-2xl font-semibold text-gray-900">Edit Your Resume</h1>

      {status === "loading" && (
        <p className="mt-4 text-sm text-gray-600" aria-live="polite">
          Opening your resume in the builder… This usually takes a few seconds.
        </p>
      )}

      {status === "needs-account" && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700" role="alert">
          <p>Sign in to {SITE_NAME} to edit your resume.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a href={SIGN_IN_URL} target="_blank" rel="noopener" className="bg-primary rounded-md px-4 py-2 font-medium hover:opacity-80">
              Sign In
            </a>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
            >
              I&rsquo;ve Signed In
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="mt-4" role="alert">
          <p className="text-sm text-red-600">{error}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {id && (
              <button
                type="button"
                onClick={() => void load()}
                className="bg-primary rounded-md px-4 py-2 text-sm font-medium hover:opacity-80"
              >
                Try Again
              </button>
            )}
            <a
              href={`${DASHBOARD_URL}/resumes`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              Back to My Resumes
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

export default function EditResumePage() {
  return (
    <Suspense fallback={null}>
      <EditResume />
    </Suspense>
  );
}
