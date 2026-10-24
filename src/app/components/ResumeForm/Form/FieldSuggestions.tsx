import { useContext, useState } from "react";
import { CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { SuggestionsContext, type FieldSuggestion } from "components/ResumeForm/Form/suggestions-context";
import { cx } from "lib/cx";
import type { EditSection } from "lib/resume-analysis/types";

const button =
  "rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

/** A suggestion waiting to be accepted. The new wording can be changed first; Accept puts in whatever the box holds. */
const PendingCard = ({
  item,
  onAccept,
  onDismiss,
}: {
  item: FieldSuggestion;
  onAccept: (text: string) => void;
  onDismiss: () => void;
}) => {
  const { edit } = item;
  const isAdd = edit.kind === "add";
  const [text, setText] = useState(edit.after);
  const id = `suggestion-${item.id}`;

  return (
    <li className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
      <p className="text-sm font-medium text-blue-950">{isAdd ? "Suggested new line" : "Suggested rewording"}</p>
      {!isAdd && edit.before && (
        <p className="mt-1 text-sm text-gray-600">
          <span className="text-xs font-medium uppercase text-gray-500">Now </span>
          {edit.before}
        </p>
      )}
      <label htmlFor={id} className="sr-only">
        {isAdd ? "New line to add" : "New wording"}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(6, Math.max(2, Math.ceil(text.length / 70)))}
        className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus-visible:border-gray-500 sm:text-sm"
      />
      {edit.reason && <p className="mt-2 text-sm text-gray-700">{edit.reason}</p>}
      {isAdd && edit.basedOn && (
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-medium">Based on your resume:</span> {edit.basedOn}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={text.trim() === ""}
          onClick={() => onAccept(text.trim())}
          className={cx(button, "border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-50")}
        >
          {isAdd ? "Add It" : "Accept"}
        </button>
        <button type="button" onClick={onDismiss} className={cx(button, "border-gray-300 bg-white text-gray-800 hover:bg-gray-100")}>
          Dismiss
        </button>
      </div>
    </li>
  );
};

/**
 * The suggestions for one field of the resume, shown just under it, on the analysis page. In the builder there is nothing to show, so this
 * renders nothing there.
 */
export const FieldSuggestions = ({ section, entryIndex, className }: { section: EditSection; entryIndex?: number; className?: string }) => {
  const api = useContext(SuggestionsContext);
  const [showDismissed, setShowDismissed] = useState(false);
  if (!api) return null;

  const items = api.forField(section, entryIndex);
  const dismissed = items.filter((item) => item.state === "dismissed");
  const visible = items.filter((item) => item.state !== "dismissed");
  if (items.length === 0) return null;

  return (
    <div className={cx("col-span-full", className)}>
      {visible.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm font-medium text-blue-900">
          <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          Suggestions for this job
        </div>
      )}
      <ul className="mt-2 space-y-2" aria-live="polite">
        {visible.map((item) => {
          if (item.state === "pending") {
            return <PendingCard key={item.id} item={item} onAccept={(text) => api.accept(item.id, text)} onDismiss={() => api.dismiss(item.id)} />;
          }
          if (item.state === "stale") {
            return (
              <li key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                <p>You&rsquo;ve changed this line since the analysis, so this suggestion no longer fits.</p>
                <button type="button" onClick={() => api.dismiss(item.id)} className={cx(button, "mt-2 border-gray-300 bg-white text-gray-800 hover:bg-gray-100")}>
                  Dismiss
                </button>
              </li>
            );
          }
          return (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="flex min-w-0 items-start gap-2 text-sm text-green-950">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">{item.edit.kind === "add" ? "Added" : "Accepted"}: </span>
                  {item.appliedText}
                </span>
              </p>
              <button type="button" onClick={() => api.undo(item.id)} className={cx(button, "shrink-0 border-gray-300 bg-white text-gray-800 hover:bg-gray-100")}>
                Undo
              </button>
            </li>
          );
        })}
      </ul>
      {dismissed.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowDismissed((shown) => !shown)} aria-expanded={showDismissed} className="text-sm text-gray-600 underline underline-offset-2 hover:text-gray-900">
            {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
          </button>
          {showDismissed && (
            <ul className="mt-2 space-y-2">
              {dismissed.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  <span className="min-w-0">{item.edit.after}</span>
                  <button type="button" onClick={() => api.restore(item.id)} className={cx(button, "shrink-0 border-gray-300 bg-white text-gray-800 hover:bg-gray-100")}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
