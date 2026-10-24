import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cx } from "lib/cx";
import type { EditSection, ResumeEdit } from "lib/resume-analysis/types";

export type Decision = "accepted" | "rejected";

const SECTION_LABELS: Record<EditSection, string> = {
  summary: "Summary",
  workExperiences: "Work experience",
  educations: "Education",
  projects: "Projects",
  skills: "Skills",
};

/** One suggested rewording, with its before and after text, why, and buttons to accept or reject it. Pressing the chosen button again undoes the choice. */
export const EditCard = ({
  edit,
  number,
  decision,
  onDecide,
}: {
  edit: ResumeEdit;
  number: number;
  decision: Decision | undefined;
  onDecide: (decision: Decision | undefined) => void;
}) => {
  const accepted = decision === "accepted";
  const rejected = decision === "rejected";
  const isAdd = edit.kind === "add";
  const place = edit.section === "summary" ? "Summary" : `${SECTION_LABELS[edit.section]} · ${edit.where}`;

  return (
    <li
      className={cx(
        "rounded-lg border p-4 transition-colors",
        accepted && "border-green-300 bg-green-50/50",
        rejected && "border-gray-200 bg-gray-50 opacity-70",
        !decision && "border-gray-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">
          <span className="tabular-nums text-gray-500">{number}. </span>
          {place}
          {isAdd && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 align-middle text-xs font-medium text-blue-800">New</span>}
        </p>
        {decision && (
          <span className={cx("shrink-0 text-xs font-medium", accepted ? "text-green-800" : "text-gray-600")}>{accepted ? "Accepted" : "Rejected"}</span>
        )}
      </div>

      <dl className="mt-2 space-y-2 text-sm">
        {edit.before && (
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Before</dt>
            <dd className={cx("mt-0.5 text-gray-600", accepted && "line-through decoration-gray-400")}>{edit.before}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{isAdd ? "Add" : "After"}</dt>
          <dd className="mt-0.5 rounded bg-green-50 px-2 py-1 text-gray-900">{edit.after}</dd>
        </div>
      </dl>
      {edit.reason && <p className="mt-2 text-sm text-gray-600">{edit.reason}</p>}
      {isAdd && edit.basedOn && (
        <p className="mt-1 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Based on your resume:</span> {edit.basedOn}
        </p>
      )}

      <div className="mt-3 flex gap-2" role="group" aria-label={`Suggestion ${number}`}>
        <button
          type="button"
          aria-pressed={accepted}
          aria-label={`Accept suggestion ${number}: ${edit.where}`}
          onClick={() => onDecide(accepted ? undefined : "accepted")}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900",
            accepted ? "border-green-700 bg-green-700 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
          )}
        >
          <CheckIcon className="h-4 w-4" aria-hidden="true" />
          Accept
        </button>
        <button
          type="button"
          aria-pressed={rejected}
          aria-label={`Reject suggestion ${number}: ${edit.where}`}
          onClick={() => onDecide(rejected ? undefined : "rejected")}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900",
            rejected ? "border-gray-700 bg-gray-700 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
          )}
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          Reject
        </button>
      </div>
    </li>
  );
};
