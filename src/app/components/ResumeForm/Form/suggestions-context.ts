import { createContext } from "react";
import type { EditSection, ResumeEdit } from "lib/resume-analysis/types";

export type SuggestionState =
  /** Waiting for the person to accept or dismiss it. */
  | "pending"
  /** Its line has since been changed or removed, so it no longer fits. */
  | "stale"
  | "accepted"
  | "dismissed";

export interface FieldSuggestion {
  id: string;
  edit: ResumeEdit;
  state: SuggestionState;
  /** For an accepted one: the text that went into the resume. */
  appliedText?: string;
}

/**
 * What the analysis page offers the builder's own forms, so each can show the suggestions for its field. The builder itself provides none,
 * and then nothing is shown, so the forms look and behave exactly as they always have.
 */
export interface SuggestionsApi {
  /** The suggestions for a field. `entryIndex` is the number of the job, school or project the form is showing now. */
  forField: (section: EditSection, entryIndex?: number) => FieldSuggestion[];
  accept: (id: string, text: string) => void;
  dismiss: (id: string) => void;
  restore: (id: string) => void;
  undo: (id: string) => void;
}

export const SuggestionsContext = createContext<SuggestionsApi | null>(null);
