import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { cx } from "lib/cx";
import type { ResumeAnalysis, SuggestedChange } from "lib/resume-analysis/types";

const SECTION_LABELS: Record<SuggestedChange["section"], string> = {
  summary: "Summary",
  workExperiences: "Work experience",
  educations: "Education",
  projects: "Projects",
  skills: "Skills",
  custom: "Extras",
};

const IMPORTANCE_LABELS = { high: "High priority", medium: "Medium priority", low: "Low priority" } as const;

/** A verdict in words as well as colour, so the score never depends on colour alone. */
export const matchBand = (score: number) =>
  score >= 75
    ? { label: "Strong match", colour: "text-green-700" }
    : score >= 55
      ? { label: "Good match", colour: "text-blue-700" }
      : score >= 30
        ? { label: "Partial match", colour: "text-amber-700" }
        : { label: "Weak match", colour: "text-red-700" };

const ScoreRing = ({ score }: { score: number }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const { label, colour } = matchBand(score);
  return (
    <div className="flex shrink-0 flex-col items-center" role="img" aria-label={`Match score ${score} out of 100: ${label}`}>
      <div className={cx("relative h-28 w-28", colour)}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-gray-200" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-semibold tabular-nums text-gray-900">{score}</span>
      </div>
      <span className={cx("mt-2 text-sm font-medium", colour)}>{label}</span>
    </div>
  );
};

const Card = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={cx("rounded-xl border border-gray-200 p-5", className)}>
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    <div className="mt-3">{children}</div>
  </section>
);

const BulletList = ({ items, empty }: { items: string[]; empty: string }) =>
  items.length === 0 ? (
    <p className="text-sm text-gray-500">{empty}</p>
  ) : (
    <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );

export const AnalysisReport = ({
  analysis,
  applied,
  canUndo,
  confirming,
  onAskToApply,
  onCancelApply,
  onApply,
  onUndo,
  headingRef,
}: {
  analysis: ResumeAnalysis;
  applied: boolean;
  canUndo: boolean;
  confirming: boolean;
  onAskToApply: () => void;
  onCancelApply: () => void;
  onApply: () => void;
  onUndo: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}) => {
  const jobName = [analysis.job.title, analysis.job.company].filter(Boolean).join(" at ");
  const isWeak = analysis.matchScore < 30;

  return (
    <div className="mt-10 space-y-5">
      <section className="flex flex-col gap-6 rounded-xl border border-gray-200 p-6 sm:flex-row sm:items-center">
        <ScoreRing score={analysis.matchScore} />
        <div className="min-w-0">
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-gray-900 outline-none">
            Your Resume Analysis
          </h2>
          {jobName && <p className="mt-1 text-sm text-gray-500">For {jobName}</p>}
          {analysis.verdict && <p className="mt-3 text-pretty text-gray-700">{analysis.verdict}</p>}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Strengths">
          <BulletList items={analysis.strengths} empty="No clear strengths for this job were found." />
        </Card>
        <Card title="Gaps">
          <BulletList items={analysis.gaps} empty="No major gaps found." />
        </Card>
      </div>

      <Card title="Keywords">
        <h4 className="text-sm font-medium text-gray-900">
          Already in your resume <span className="tabular-nums text-gray-500">({analysis.matchedKeywords.length})</span>
        </h4>
        {analysis.matchedKeywords.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">None of the job&rsquo;s keywords were found.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {analysis.matchedKeywords.map((keyword) => (
              <li key={keyword} className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-900">
                {keyword}
              </li>
            ))}
          </ul>
        )}

        <h4 className="mt-6 text-sm font-medium text-gray-900">
          Missing from your resume <span className="tabular-nums text-gray-500">({analysis.missingKeywords.length})</span>
        </h4>
        <p className="mt-1 text-xs text-gray-500">Add one only if it&rsquo;s true. We never add these to your resume for you.</p>
        {analysis.missingKeywords.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nothing important is missing.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {analysis.missingKeywords.map((entry) => (
              <li key={entry.keyword} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{entry.keyword}</span>
                  <span
                    className={cx(
                      "rounded px-1.5 py-0.5 text-xs",
                      entry.importance === "high" && "bg-red-50 text-red-800",
                      entry.importance === "medium" && "bg-amber-50 text-amber-800",
                      entry.importance === "low" && "bg-gray-100 text-gray-700"
                    )}
                  >
                    {IMPORTANCE_LABELS[entry.importance]}
                  </span>
                </div>
                {entry.advice && <p className="mt-1 text-sm text-gray-600">{entry.advice}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Suggested Changes">
        {analysis.changes.length === 0 ? (
          <p className="text-sm text-gray-500">No wording changes are suggested. Your resume already reads well for this job.</p>
        ) : (
          <ol className="space-y-4">
            {analysis.changes.map((change, index) => (
              <li key={index} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-900">
                  {SECTION_LABELS[change.section]}
                  {change.where && <span className="font-normal text-gray-500"> &middot; {change.where}</span>}
                </p>
                <dl className="mt-2 space-y-2 text-sm">
                  {change.before && (
                    <div>
                      <dt className="text-xs font-medium uppercase text-gray-500">Before</dt>
                      <dd className="mt-0.5 text-gray-600">{change.before}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">After</dt>
                    <dd className="mt-0.5 rounded bg-green-50 px-2 py-1 text-gray-900">{change.after}</dd>
                  </div>
                </dl>
                {change.reason && <p className="mt-2 text-sm text-gray-600">{change.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5" aria-live="polite">
        {applied ? (
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Loaded into the resume builder</h3>
              <p className="mt-1 text-sm text-gray-600">Your tailored resume is ready to edit and download.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/resume-builder" className="bg-primary rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80">
                  Open Resume Builder
                </Link>
                {canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-base font-semibold text-gray-900">Use the tailored resume</h3>
            <p className="mt-1 text-sm text-gray-600">
              {isWeak
                ? "This job is a weak match, and tailoring can only reword what you've already done. You can still load the reworded version."
                : "We reworded your resume for this job using only what you already wrote. Nothing was added. Review it in the builder before you download it."}
            </p>
            {confirming ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4" role="alertdialog" aria-label="Replace your resume?">
                <p className="text-sm text-amber-900">This replaces the resume in the builder. We keep a copy, so you can undo it.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={onApply} className="bg-primary rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80">
                    Replace My Resume
                  </button>
                  <button
                    type="button"
                    onClick={onCancelApply}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={onAskToApply} className="bg-primary mt-4 rounded-lg px-5 py-2.5 text-sm font-medium hover:opacity-80">
                Apply to Resume Builder
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
};
