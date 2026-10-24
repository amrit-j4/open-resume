import { cx } from "lib/cx";
import type { ResumeAnalysis } from "lib/resume-analysis/types";

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

/** Where the score comes from, so a low number can be understood: each part shows what it is worth and, in words, why points were lost. */
const ScoreBreakdown = ({ items }: { items: ResumeAnalysis["breakdown"] }) => (
  <Card title="Where the Score Comes From">
    <ul className="space-y-4">
      {items.map((item) => {
        const full = item.score >= item.max;
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
              <span className="text-sm tabular-nums text-gray-600">
                {item.score} / {item.max}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
              role="meter"
              aria-label={item.label}
              aria-valuemin={0}
              aria-valuemax={item.max}
              aria-valuenow={item.score}
            >
              <div
                className={cx("h-full rounded-full", full ? "bg-green-600" : item.score / item.max >= 0.6 ? "bg-blue-600" : "bg-amber-600")}
                style={{ width: `${(item.score / item.max) * 100}%` }}
              />
            </div>
            {item.note && <p className="mt-1.5 text-sm text-gray-600">{item.note}</p>}
          </li>
        );
      })}
    </ul>
  </Card>
);

const ghostButton =
  "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

/** The report: the verdict and score, where the score comes from, the keywords, and what is strong and weak. The suggestions are in the resume itself. */
export const AnalysisReport = ({ analysis }: { analysis: ResumeAnalysis }) => (
  <div className="space-y-5">
    <section className="flex flex-col gap-5 rounded-xl border border-gray-200 p-5 sm:flex-row sm:items-center">
      <ScoreRing score={analysis.matchScore} />
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900">How Well Your Resume Fits</h3>
        {analysis.verdict && <p className="mt-2 text-pretty text-sm text-gray-700">{analysis.verdict}</p>}
      </div>
    </section>

    {analysis.breakdown.length > 0 && <ScoreBreakdown items={analysis.breakdown} />}

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

    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Strengths">
        <BulletList items={analysis.strengths} empty="No clear strengths for this job were found." />
      </Card>
      <Card title="Gaps">
        <BulletList items={analysis.gaps} empty="No major gaps found." />
      </Card>
    </div>
  </div>
);
