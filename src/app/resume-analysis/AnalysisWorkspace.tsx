import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Provider, useStore } from "react-redux";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { cx } from "lib/cx";
import { useAppDispatch, useAppSelector } from "lib/redux/hooks";
import { makeStore } from "lib/redux/make-store";
import { selectResume, setResume } from "lib/redux/resumeSlice";
import { selectFormsOrder, selectSettings, type Settings, type ShowForm } from "lib/redux/settingsSlice";
import type { RootState } from "lib/redux/store";
import { applyTailoredResume, restoreBackup } from "lib/redux/tailor-state";
import type { EditSection, ResumeAnalysisResult } from "lib/resume-analysis/types";
import {
  applySuggestion,
  applyUpdate,
  buildSuggestions,
  entryIndexOf,
  forgetRewrite,
  locate,
  undoSuggestion,
  type Rewrites,
  type Suggestion,
} from "lib/resume-analysis/suggestions";
import { ProfileForm } from "components/ResumeForm/ProfileForm";
import { WorkExperiencesForm } from "components/ResumeForm/WorkExperiencesForm";
import { EducationsForm } from "components/ResumeForm/EducationsForm";
import { ProjectsForm } from "components/ResumeForm/ProjectsForm";
import { SkillsForm } from "components/ResumeForm/SkillsForm";
import { CustomForm } from "components/ResumeForm/CustomForm";
import { SuggestionsContext, type FieldSuggestion, type SuggestionState, type SuggestionsApi } from "components/ResumeForm/Form/suggestions-context";
import { AnalysisReport, matchBand } from "resume-analysis/AnalysisReport";
import type { SavedWork } from "lib/resume-analysis/saved-analysis";
import { ResumeLivePreview } from "resume-analysis/ResumeLivePreview";

const primary = "bg-primary rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

const formTypeToComponent: { [type in ShowForm]: () => JSX.Element } = {
  workExperiences: WorkExperiencesForm,
  educations: EducationsForm,
  projects: ProjectsForm,
  skills: SkillsForm,
  custom: CustomForm,
};

const isEntrySection = (section: EditSection) => section === "workExperiences" || section === "educations" || section === "projects";

type Tab = "edit" | "report" | "preview";

interface Book {
  states: Record<string, { status: "accepted" | "dismissed"; appliedText?: string }>;
  rewrites: Rewrites;
}

/** The live preview, rebuilt from whatever the resume is right now. */
const PreviewFromStore = () => {
  const resume = useAppSelector(selectResume);
  const settings = useAppSelector(selectSettings);
  return <ResumeLivePreview resume={resume} settings={settings} />;
};

const Workspace = ({
  result,
  initialWork,
  onWork,
  onBack,
  onStartOver,
  headingRef,
}: {
  result: ResumeAnalysisResult;
  initialWork?: SavedWork;
  onWork?: (work: SavedWork) => void;
  onBack: () => void;
  onStartOver?: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}) => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const resume = useAppSelector(selectResume);
  const formsOrder = useAppSelector(selectFormsOrder);

  const suggestions = useMemo(() => buildSuggestions(result.resume, result.analysis.edits), [result]);
  const byId = useMemo(() => new Map(suggestions.map((s) => [s.edit.id, s])), [suggestions]);

  // Accepting many suggestions in one go has to see each one's effect on the next, so what has been accepted lives in a ref, updated at once.
  const book = useRef<Book>({ states: initialWork?.states ?? {}, rewrites: (initialWork?.rewrites as Rewrites | undefined) ?? {} });
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const [tab, setTab] = useState<Tab>("report");
  const [confirming, setConfirming] = useState(false);
  const [applied, setApplied] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Hands the page what has been done so far, so it can be kept across a reload. Runs on every render, and the page does the throttling.
  useEffect(() => {
    onWork?.({ resume, states: book.current.states, rewrites: book.current.rewrites });
  });

  // Anything done to the resume after it was loaded into the builder means the builder no longer has what is shown.
  useEffect(() => {
    setApplied(false);
    setConfirming(false);
  }, [resume]);

  const stateOf = (suggestion: Suggestion): SuggestionState =>
    book.current.states[suggestion.edit.id]?.status ?? (locate(resume, suggestion, book.current.rewrites) ? "pending" : "stale");

  const accept = (id: string, text: string) => {
    const suggestion = byId.get(id);
    if (!suggestion) return;
    const current = store.getState().resume;
    const done = applySuggestion(current, suggestion, text, book.current.rewrites);
    if (done) {
      book.current.rewrites = done.rewrites;
      book.current.states[id] = { status: "accepted", appliedText: text };
      dispatch(setResume(applyUpdate(current, done.update)));
    }
    rerender();
  };

  const dismiss = (id: string) => {
    book.current.states[id] = { status: "dismissed" };
    rerender();
  };

  const restore = (id: string) => {
    delete book.current.states[id];
    rerender();
  };

  const undo = (id: string) => {
    const suggestion = byId.get(id);
    const done = book.current.states[id];
    if (!suggestion || !done?.appliedText) return;
    const current = store.getState().resume;
    const update = undoSuggestion(current, suggestion, done.appliedText);
    // If that text was changed by hand there is nothing to take out, but the suggestion is no longer "accepted" either way.
    if (update) dispatch(setResume(applyUpdate(current, update)));
    book.current.rewrites = forgetRewrite(book.current.rewrites, suggestion, done.appliedText);
    delete book.current.states[id];
    rerender();
  };

  const isPendingNow = (suggestion: Suggestion) =>
    !book.current.states[suggestion.edit.id] && Boolean(locate(store.getState().resume, suggestion, book.current.rewrites));

  const acceptAll = () => suggestions.filter(isPendingNow).forEach((s) => accept(s.edit.id, s.edit.after));
  const dismissAll = () => suggestions.filter(isPendingNow).forEach((s) => dismiss(s.edit.id));

  const api: SuggestionsApi = {
    forField: (section, entryIndex) =>
      suggestions
        .filter((s) => s.edit.section === section && (!isEntrySection(section) || entryIndexOf(resume, s) === entryIndex))
        .map((s): FieldSuggestion => ({ id: s.edit.id, edit: s.edit, state: stateOf(s), appliedText: book.current.states[s.edit.id]?.appliedText })),
    accept,
    dismiss,
    restore,
    undo,
  };

  const counts = { pending: 0, accepted: 0, dismissed: 0 };
  for (const s of suggestions) {
    const state = stateOf(s);
    if (state === "pending") counts.pending++;
    else if (state === "accepted") counts.accepted++;
    else if (state === "dismissed") counts.dismissed++;
  }

  const changed = JSON.stringify(resume) !== JSON.stringify(result.resume);
  const { analysis } = result;
  const band = matchBand(analysis.matchScore);
  const jobName = [analysis.job.title, analysis.job.company].filter(Boolean).join(" at ");

  const applyToBuilder = () => {
    // Applying again keeps the first backup, so Undo always leads back to the person's own resume.
    applyTailoredResume(store.getState().resume, { keepBackup: canUndo });
    setApplied(true);
    setConfirming(false);
    setCanUndo(true);
  };

  const undoApply = () => {
    if (restoreBackup()) {
      setApplied(false);
      setCanUndo(false);
    }
  };

  const tabs: { id: Tab; label: string; mobileOnly?: boolean }[] = [
    { id: "report", label: "Report" },
    { id: "edit", label: "Edit Resume" },
    { id: "preview", label: "Live Preview", mobileOnly: true },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onBack} className={secondary}>
          &larr; Change Resume or Job
        </button>
        {onStartOver && (
          <button type="button" onClick={onStartOver} className={secondary}>
            Start a new analysis
          </button>
        )}
      </div>

      <header className="mt-4">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-gray-900 outline-none">
          Your Resume Analysis
        </h2>
        {jobName && <p className="mt-1 text-sm text-gray-500">For {jobName}</p>}
      </header>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Analysis view">
        {tabs.map(({ id, label, mobileOnly }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cx(
              "rounded-lg border px-4 py-2 text-sm font-medium max-lg:flex-1",
              mobileOnly && "lg:hidden",
              tab === id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className={cx("min-w-0", tab === "preview" && "max-lg:hidden")}>
          {tab === "report" ? (
            <div id="panel-report" role="tabpanel" aria-labelledby="tab-report">
              <AnalysisReport analysis={analysis} />
            </div>
          ) : (
            <div id="panel-edit" role="tabpanel" aria-labelledby="tab-edit" className="space-y-5">
              <section className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-gray-700">
                    <span className={cx("font-semibold", band.colour)}>
                      <span className="tabular-nums">{analysis.matchScore}</span> &middot; {band.label}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={acceptAll} disabled={counts.pending === 0} className={secondary}>
                      Accept All
                    </button>
                    <button type="button" onClick={dismissAll} disabled={counts.pending === 0} className={secondary}>
                      Dismiss All
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600" aria-live="polite" data-testid="decision-count">
                  {analysis.edits.length === 0
                    ? "No wording changes are suggested. Your resume already reads well for this job."
                    : `${counts.pending} to review, ${counts.accepted} accepted, ${counts.dismissed} dismissed`}
                </p>
                {analysis.editNote && (
                  <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-950" data-testid="edit-note">
                    {analysis.editNote}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Suggestions appear under the field they&rsquo;re about. You can also edit anything yourself, and the preview follows.
                </p>
              </section>

              <SuggestionsContext.Provider value={api}>
                <div className="flex flex-col gap-6">
                  <ProfileForm />
                  {formsOrder.map((form) => {
                    const Component = formTypeToComponent[form];
                    return <Component key={form} />;
                  })}
                </div>
              </SuggestionsContext.Provider>
            </div>
          )}
        </div>

        <div id="panel-preview" role={tab === "preview" ? "tabpanel" : undefined} className={cx("space-y-4 lg:sticky lg:top-[calc(var(--top-nav-bar-height)+1rem)]", tab !== "preview" && "max-lg:hidden")}>
          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4" aria-live="polite">
            {applied ? (
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Loaded into the resume builder</h3>
                  <p className="mt-1 text-sm text-gray-600">Your resume is ready to edit and download.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/resume-builder" className={primary}>
                      Open Resume Builder
                    </Link>
                    {canUndo && (
                      <button type="button" onClick={undoApply} className={secondary}>
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
                  <button type="button" onClick={applyToBuilder} className={primary}>
                    Replace My Resume
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className={secondary}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium tabular-nums">{counts.accepted}</span> {counts.accepted === 1 ? "suggestion" : "suggestions"} accepted
                </p>
                <button type="button" onClick={() => setConfirming(true)} disabled={!changed} className={primary}>
                  Apply to Resume Builder
                </button>
                {!changed && <p className="w-full text-xs text-gray-500">Accept a suggestion, or edit your resume, to apply the changes.</p>}
              </div>
            )}
          </section>

          <div className="max-h-[calc(100vh-var(--top-nav-bar-height)-10rem)] overflow-y-auto rounded-xl border border-gray-200 bg-gray-100 p-3">
            <PreviewFromStore />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The analysis and the resume side by side. The resume is the builder's own form, shown over a store of its own, with each field's
 * suggestions underneath it; the live preview shows that same resume. Nothing reaches the builder until the person applies it.
 */
export const AnalysisWorkspace = ({
  result,
  settings,
  initialWork,
  onWork,
  onBack,
  onStartOver,
  headingRef,
}: {
  result: ResumeAnalysisResult;
  settings: Settings;
  initialWork?: SavedWork;
  onWork?: (work: SavedWork) => void;
  onBack: () => void;
  onStartOver?: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}) => {
  const store = useMemo(() => makeStore({ resume: initialWork?.resume ?? result.resume, settings }), [result, settings, initialWork]);
  return (
    <Provider store={store}>
      <Workspace result={result} initialWork={initialWork} onWork={onWork} onBack={onBack} onStartOver={onStartOver} headingRef={headingRef} />
    </Provider>
  );
};
