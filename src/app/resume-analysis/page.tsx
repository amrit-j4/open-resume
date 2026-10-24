"use client";
import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "lib/auth-gate";
import { cx } from "lib/cx";
import { loadStateFromLocalStorage } from "lib/redux/local-storage";
import { initialSettings, type Settings } from "lib/redux/settingsSlice";
import { loadBuilderResume } from "lib/redux/tailor-state";
import type { Resume } from "lib/redux/types";
import type { ResumeAnalysisResult } from "lib/resume-analysis/types";
import {
  analysisSignature,
  clearSavedAnalysis,
  fileSignature,
  loadSavedAnalysis,
  readFileForSaving,
  restoreFile,
  saveAnalysis,
  type SavedAnalysis,
  type SavedWork,
} from "lib/resume-analysis/saved-analysis";
import { SIGN_IN_URL, SIGN_UP_URL, SITE_NAME } from "lib/site-config";
import { ResumeFilePicker } from "components/ResumeFilePicker";
import { AnalysisWorkspace } from "resume-analysis/AnalysisWorkspace";

type ResumeSource = "upload" | "builder";
type JobInput = "text" | "link";
type Status = "idle" | "analysing" | "needs-account";

interface FieldErrors {
  resume?: string;
  job?: string;
}

const MIN_JOB_TEXT_LENGTH = 80;

const isWebLink = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const RadioCard = ({
  name,
  value,
  checked,
  disabled,
  onChange,
  title,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  hint?: string;
}) => (
  <label
    className={cx(
      "flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 text-left",
      checked ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400",
      disabled && "cursor-not-allowed opacity-50 hover:border-gray-200"
    )}
  >
    <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="mt-1 h-4 w-4" />
    <span>
      <span className="block text-sm font-medium text-gray-900">{title}</span>
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </span>
  </label>
);

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
  </svg>
);

export default function ResumeAnalysisPage() {
  const [source, setSource] = useState<ResumeSource>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [builderResume, setBuilderResume] = useState<Resume | undefined>();
  const [jobInput, setJobInput] = useState<JobInput>("text");
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [previewSettings, setPreviewSettings] = useState<Settings>(initialSettings);

  // What is kept in this browser. Written when an analysis comes back, and updated as the suggestions are worked through.
  const savedRef = useRef<SavedAnalysis | undefined>();
  const [work, setWork] = useState<SavedWork | undefined>();
  const workTimer = useRef<ReturnType<typeof setTimeout>>();

  const abortRef = useRef<AbortController | null>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = loadBuilderResume();
    setBuilderResume(saved);
    if (saved) setSource("builder");

    // Pick up the last analysis, so a reload lands back on it.
    const kept = loadSavedAnalysis();
    if (kept) {
      savedRef.current = kept;
      setSource(kept.source === "builder" && !saved ? "upload" : kept.source);
      setJobInput(kept.jobInput);
      setJobText(kept.jobText);
      setJobUrl(kept.jobUrl);
      if (kept.file) setFile(restoreFile(kept.file) ?? null);
      setResult(kept.result);
      setPreviewSettings(kept.settings);
      setWork(kept.work);
      setShowResults(true);
    }
    return () => {
      abortRef.current?.abort();
      clearTimeout(workTimer.current);
    };
  }, []);

  useEffect(() => {
    if (result && showResults) reportHeadingRef.current?.focus();
  }, [result, showResults]);


  const analysing = status === "analysing";

  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    if (source === "upload" && !file) found.resume = fileProblem ?? "Choose your resume file.";
    if (source === "builder" && !builderResume) found.resume = "There's no resume saved in the builder yet. Upload a file instead.";
    if (jobInput === "text" && jobText.trim().length < MIN_JOB_TEXT_LENGTH) {
      found.job = "Paste the whole job description, not just the title.";
    }
    if (jobInput === "link" && !isWebLink(jobUrl)) {
      found.job = "Enter a full link that starts with http:// or https://.";
    }
    return found;
  };

  /** What the resume and job are, as a string, so the same inputs can be recognised. */
  const currentSignature = () =>
    analysisSignature({
      source,
      resume: source === "upload" && file ? fileSignature(file) : JSON.stringify(builderResume ?? null),
      jobInput,
      job: jobInput === "text" ? jobText.trim() : jobUrl.trim(),
    });

  /** Keeps the working state (accepted suggestions and edits), a moment after the last change, as typing changes it constantly. */
  const rememberWork = (next: SavedWork) => {
    if (!savedRef.current) return;
    savedRef.current = { ...savedRef.current, work: next };
    clearTimeout(workTimer.current);
    workTimer.current = setTimeout(() => savedRef.current && saveAnalysis(savedRef.current), 400);
  };

  /** Forgets the saved analysis and empties the form, ready for a different resume or job. */
  const startOver = () => {
    clearTimeout(workTimer.current);
    clearSavedAnalysis();
    savedRef.current = undefined;
    setResult(null);
    setWork(undefined);
    setFile(null);
    setFileProblem(null);
    setJobText("");
    setJobUrl("");
    setErrors({});
    setServerError(null);
    setStatus("idle");
    setSource(builderResume ? "builder" : "upload");
  };

  const analyse = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (analysing) return;

    const found = validate();
    setErrors(found);
    setServerError(null);
    if (found.resume || found.job) return;

    // The same resume and job as the saved analysis: reuse it, rather than paying for the AI to do it again.
    const signature = currentSignature();
    const kept = savedRef.current;
    if (kept && kept.signature === signature) {
      setResult(kept.result);
      setPreviewSettings(kept.settings);
      setWork(kept.work);
      setShowResults(true);
      return;
    }

    setStatus("analysing");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus("needs-account");
        return;
      }

      const body = new FormData();
      if (source === "upload" && file) body.append("file", file);
      else body.append("resume", JSON.stringify(builderResume));
      if (jobInput === "text") body.append("jobText", jobText);
      else body.append("jobUrl", jobUrl.trim());

      const res = await fetch("/api/resume-analysis", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as (Partial<ResumeAnalysisResult> & { error?: string }) | null;
      if (!res.ok || !data?.analysis || !data.tailoredResume) {
        throw new Error(data?.error ?? "We couldn't analyse this resume. Please try again.");
      }

      setResult(data as ResumeAnalysisResult);
      // The preview uses the template, colours and fonts the person already chose in the builder.
      const settings = (loadStateFromLocalStorage()?.settings as Settings | undefined) ?? initialSettings;
      setPreviewSettings(settings);
      setWork(undefined);
      savedRef.current = {
        version: 1,
        signature,
        source,
        jobInput,
        jobText,
        jobUrl,
        file: source === "upload" && file ? await readFileForSaving(file) : undefined,
        result: data as ResumeAnalysisResult,
        settings,
      };
      saveAnalysis(savedRef.current);
      setShowResults(true);
      setStatus("idle");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("idle");
      setServerError(
        error instanceof TypeError
          ? "We couldn't reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "We couldn't analyse this resume. Please try again."
      );
    }
  };

  const resumeErrorId = "resume-error";
  const jobErrorId = "job-error";

  if (showResults && result) {
    return (
      <main>
        <AnalysisWorkspace result={result} settings={previewSettings} initialWork={work} onWork={rememberWork} onBack={() => setShowResults(false)} headingRef={reportHeadingRef} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-balance text-center text-2xl font-semibold text-gray-900">Resume Analysis</h1>
      <p className="mx-auto mt-2 max-w-lg text-pretty text-center text-sm text-gray-600">
        Compare your resume with a job. Get a match score, the keywords you&rsquo;re missing, and a version of your resume reworded for that job.
      </p>

      {result && (
        <p className="mt-6 text-center text-sm text-gray-600">
          Your last analysis is saved in this browser, so analysing the same resume and job again is instant.{" "}
          <button type="button" onClick={startOver} disabled={analysing} className="font-medium text-gray-900 underline hover:no-underline disabled:opacity-50">
            Start a new analysis
          </button>
        </p>
      )}

      <form onSubmit={analyse} noValidate className="mt-10 space-y-8">
        <fieldset disabled={analysing} className="space-y-3">
          <legend className="text-base font-semibold text-gray-900">1. Your resume</legend>
          <div className="flex flex-col gap-3 sm:flex-row" role="radiogroup" aria-label="Where your resume comes from">
            <RadioCard
              name="source"
              value="upload"
              checked={source === "upload"}
              onChange={() => setSource("upload")}
              title="Upload a file"
              hint="PDF or Word"
            />
            <RadioCard
              name="source"
              value="builder"
              checked={source === "builder"}
              disabled={!builderResume}
              onChange={() => setSource("builder")}
              title="Use my builder resume"
              hint={builderResume ? `${builderResume.profile.name || "Saved in this browser"}` : "Nothing saved in this browser yet"}
            />
          </div>

          {source === "upload" && (
            <ResumeFilePicker
              file={file}
              onChange={(next) => {
                setFile(next);
                setErrors((current) => ({ ...current, resume: undefined }));
              }}
              onProblem={setFileProblem}
              disabled={analysing}
              describedBy={errors.resume || fileProblem ? resumeErrorId : undefined}
            />
          )}
          {(errors.resume || (source === "upload" && fileProblem)) && (
            <p id={resumeErrorId} className="text-sm text-red-600" role="alert">
              {errors.resume ?? fileProblem}
            </p>
          )}
        </fieldset>

        <fieldset disabled={analysing} className="space-y-3">
          <legend className="text-base font-semibold text-gray-900">2. The job</legend>
          <div className="flex flex-col gap-3 sm:flex-row" role="radiogroup" aria-label="How to provide the job">
            <RadioCard name="job" value="text" checked={jobInput === "text"} onChange={() => setJobInput("text")} title="Paste the description" />
            <RadioCard name="job" value="link" checked={jobInput === "link"} onChange={() => setJobInput("link")} title="Link to the job" hint="A job page on any website" />
          </div>

          {jobInput === "text" ? (
            <div>
              <label htmlFor="job-text" className="sr-only">
                Job description
              </label>
              <textarea
                id="job-text"
                name="jobText"
                rows={9}
                value={jobText}
                onChange={(e) => {
                  setJobText(e.target.value);
                  setErrors((current) => ({ ...current, job: undefined }));
                }}
                placeholder="Paste the job description here…"
                aria-invalid={Boolean(errors.job)}
                aria-describedby={errors.job ? jobErrorId : undefined}
                className="w-full rounded-lg border border-gray-300 p-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 sm:text-sm"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="job-url" className="sr-only">
                Link to the job
              </label>
              <input
                id="job-url"
                name="jobUrl"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={jobUrl}
                onChange={(e) => {
                  setJobUrl(e.target.value);
                  setErrors((current) => ({ ...current, job: undefined }));
                }}
                placeholder="https://example.com/jobs/senior-data-analyst…"
                aria-invalid={Boolean(errors.job)}
                aria-describedby={errors.job ? jobErrorId : undefined}
                className="w-full rounded-lg border border-gray-300 p-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 sm:text-sm"
              />
              <p className="mt-2 text-xs text-gray-500">Some sites block automated access. If a link doesn&rsquo;t work, paste the description instead.</p>
            </div>
          )}
          {errors.job && (
            <p id={jobErrorId} className="text-sm text-red-600" role="alert">
              {errors.job}
            </p>
          )}
        </fieldset>

        {status === "needs-account" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-700" role="alert">
            <p>Create a free {SITE_NAME} account or sign in to analyse your resume.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a href={SIGN_UP_URL} target="_blank" rel="noopener" className="bg-primary rounded-md px-4 py-2 font-medium hover:opacity-80">
                Create Account
              </a>
              <a href={SIGN_IN_URL} target="_blank" rel="noopener" className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-100">
                Sign In
              </a>
              <button type="button" onClick={() => analyse()} className="rounded-md px-4 py-2 font-medium text-gray-700 hover:bg-gray-100">
                I&rsquo;ve Signed In
              </button>
            </div>
          </div>
        )}

        {serverError && (
          <p className="text-center text-sm text-red-600" role="alert">
            {serverError}
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={analysing}
              className="bg-primary inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {analysing && <Spinner />}
              {analysing ? "Analysing…" : "Analyse Resume"}
            </button>
            {analysing && (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-500" aria-live="polite">
            {analysing ? "Reading your resume and comparing it with the job. This usually takes 30 to 60 seconds." : "Your resume and the job aren’t stored."}
          </p>
        </div>
      </form>

    </main>
  );
}
