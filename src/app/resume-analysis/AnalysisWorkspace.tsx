import { useState } from "react";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { cx } from "lib/cx";
import type { Settings } from "lib/redux/settingsSlice";
import type { Resume } from "lib/redux/types";
import type { ResumeAnalysisResult } from "lib/resume-analysis/types";
import { AnalysisReport } from "resume-analysis/AnalysisReport";
import type { Decision } from "resume-analysis/EditCard";
import { ResumeLivePreview } from "resume-analysis/ResumeLivePreview";

const primary = "bg-primary rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

type Tab = "report" | "preview";

/**
 * The analysis on the left and the resume on the right. Each suggestion is accepted or rejected on its own, and the preview shows the resume
 * with the accepted ones, so the effect of every choice is visible straight away. On a narrow screen the two share the space behind tabs.
 */
export const AnalysisWorkspace = ({
  result,
  previewResume,
  settings,
  decisions,
  acceptedCount,
  applied,
  canUndo,
  confirming,
  onDecide,
  onAcceptAll,
  onRejectAll,
  onReset,
  onAskToApply,
  onCancelApply,
  onApply,
  onUndo,
  onBack,
  headingRef,
}: {
  result: ResumeAnalysisResult;
  previewResume: Resume;
  settings: Settings;
  decisions: Record<string, Decision>;
  acceptedCount: number;
  applied: boolean;
  canUndo: boolean;
  confirming: boolean;
  onDecide: (id: string, decision: Decision | undefined) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onReset: () => void;
  onAskToApply: () => void;
  onCancelApply: () => void;
  onApply: () => void;
  onUndo: () => void;
  onBack: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}) => {
  const [tab, setTab] = useState<Tab>("report");
  const noun = acceptedCount === 1 ? "Change" : "Changes";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <button type="button" onClick={onBack} className={secondary}>
        &larr; Change Resume or Job
      </button>

      <div className="mt-4 flex gap-2 lg:hidden" role="tablist" aria-label="Analysis view">
        {(["report", "preview"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cx(
              "flex-1 rounded-lg border px-4 py-2 text-sm font-medium",
              tab === id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
            )}
          >
            {id === "report" ? "Analysis" : "Live Preview"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div id="panel-report" role="tabpanel" aria-labelledby="tab-report" className={cx(tab === "preview" && "hidden lg:block")}>
          <AnalysisReport
            analysis={result.analysis}
            decisions={decisions}
            onDecide={onDecide}
            onAcceptAll={onAcceptAll}
            onRejectAll={onRejectAll}
            onReset={onReset}
            headingRef={headingRef}
          />
        </div>

        <div
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          className={cx("space-y-4 lg:sticky lg:top-[calc(var(--top-nav-bar-height)+1rem)]", tab === "report" && "hidden lg:block")}
        >
          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4" aria-live="polite">
            {applied ? (
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Loaded into the resume builder</h3>
                  <p className="mt-1 text-sm text-gray-600">Your resume with the accepted changes is ready to edit and download.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/resume-builder" className={primary}>
                      Open Resume Builder
                    </Link>
                    {canUndo && (
                      <button type="button" onClick={onUndo} className={secondary}>
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : confirming ? (
              <div role="alertdialog" aria-label="Replace your resume?">
                <p className="text-sm text-amber-900">This replaces the resume in the builder. We keep a copy, so you can undo it.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={onApply} className={primary}>
                    Replace My Resume
                  </button>
                  <button type="button" onClick={onCancelApply} className={secondary}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium tabular-nums">{acceptedCount}</span> {acceptedCount === 1 ? "change" : "changes"} in the preview
                </p>
                <button type="button" onClick={onAskToApply} disabled={acceptedCount === 0} className={primary}>
                  Apply {acceptedCount > 0 ? `${acceptedCount} ` : ""}
                  {noun} to Resume Builder
                </button>
                {acceptedCount === 0 && <p className="w-full text-xs text-gray-500">Accept a suggestion to add it to your resume.</p>}
              </div>
            )}
          </section>

          <div className="max-h-[calc(100vh-var(--top-nav-bar-height)-10rem)] overflow-y-auto rounded-xl border border-gray-200 bg-gray-100 p-3">
            <ResumeLivePreview resume={previewResume} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
};
