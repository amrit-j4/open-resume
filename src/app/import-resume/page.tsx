"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpTrayIcon, DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getAccessToken } from "lib/auth-gate";
import { cx } from "lib/cx";
import { deepClone } from "lib/deep-clone";
import { getHasUsedAppBefore, saveStateToLocalStorage } from "lib/redux/local-storage";
import type { Resume } from "lib/redux/types";
import { initialSettings, type ShowForm } from "lib/redux/settingsSlice";
import { SIGN_IN_URL, SIGN_UP_URL, SITE_NAME } from "lib/site-config";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

const isAccepted = (name: string) =>
  ACCEPTED_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension));

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

type Status = "idle" | "importing" | "needs-account";

export default function ImportResumePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [replacesSavedResume, setReplacesSavedResume] = useState(false);

  useEffect(() => {
    setReplacesSavedResume(getHasUsedAppBefore());
  }, []);

  const chooseFile = (candidate: File | undefined) => {
    setError(null);
    setStatus("idle");
    if (!candidate) return;
    if (!isAccepted(candidate.name)) {
      setError("Upload a PDF or Word (.docx) file.");
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setError("This file is too large. The limit is 5 MB.");
      return;
    }
    setFile(candidate);
  };

  const importResume = async () => {
    if (!file) return;
    setError(null);
    setStatus("importing");
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus("needs-account");
        return;
      }

      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/resume-import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = (await res.json().catch(() => null)) as
        | { resume?: Resume; error?: string }
        | null;
      if (!res.ok || !data?.resume) {
        throw new Error(data?.error ?? "We couldn't read this file. Try another one.");
      }

      const { resume } = data;
      const settings = deepClone(initialSettings);
      const sectionHasContent: Record<ShowForm, boolean> = {
        workExperiences: resume.workExperiences.length > 0,
        educations: resume.educations.length > 0,
        projects: resume.projects.length > 0,
        skills:
          resume.skills.featuredSkills.length > 0 || resume.skills.descriptions.length > 0,
        custom: resume.custom.descriptions.length > 0,
      };
      for (const section of Object.keys(settings.formToShow) as ShowForm[]) {
        settings.formToShow[section] = sectionHasContent[section];
      }

      saveStateToLocalStorage({ resume, settings });
      router.push("/resume-builder");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof TypeError
          ? "We couldn't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "We couldn't read this file. Try another one."
      );
    }
  };

  const importing = status === "importing";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="text-balance text-center text-2xl font-semibold text-gray-900">
        Import Your Resume
      </h1>
      <p className="mx-auto mt-2 max-w-md text-pretty text-center text-sm text-gray-600">
        Upload a PDF or Word resume and we&rsquo;ll fill in the builder for you. You can edit
        everything afterwards.
      </p>

      <div
        className={cx(
          "mt-8 flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          isDragging ? "border-gray-500 bg-gray-50" : "border-gray-300"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          chooseFile(e.dataTransfer.files[0]);
        }}
      >
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left">
            <DocumentTextIcon className="h-6 w-6 shrink-0 text-gray-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs tabular-nums text-gray-500">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              aria-label="Remove file"
              disabled={importing}
              onClick={() => {
                setFile(null);
                setError(null);
                setStatus("idle");
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus-visible:bg-gray-100 disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <ArrowUpTrayIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 text-sm text-gray-700">Drag and drop your resume here, or</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:bg-gray-100"
            >
              Choose File
            </button>
            <p className="mt-3 text-xs text-gray-500">PDF or Word (.docx), up to 5&nbsp;MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {status === "needs-account" && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-700" role="alert">
          <p>Create a free {SITE_NAME} account or sign in to import a resume.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a
              href={SIGN_UP_URL}
              target="_blank"
              rel="noopener"
              className="bg-primary rounded-md px-4 py-2 font-medium hover:opacity-80"
            >
              Create Account
            </a>
            <a
              href={SIGN_IN_URL}
              target="_blank"
              rel="noopener"
              className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-100"
            >
              Sign In
            </a>
            <button
              type="button"
              onClick={importResume}
              className="rounded-md px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
            >
              I&rsquo;ve Signed In
            </button>
          </div>
        </div>
      )}

      {replacesSavedResume && file && (
        <p className="mt-4 text-center text-xs text-gray-500">
          This replaces the resume currently saved in this browser.
        </p>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={importResume}
          disabled={!file || importing}
          className="bg-primary rounded-lg px-6 py-2.5 text-sm font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? "Reading Your Resume…" : "Import Resume"}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-gray-500" aria-live="polite">
        {importing ? "This usually takes a few seconds." : "Your file isn’t stored."}
      </p>
    </main>
  );
}
