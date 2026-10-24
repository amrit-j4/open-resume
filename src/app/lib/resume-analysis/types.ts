import type { Resume } from "lib/redux/types";

export type KeywordImportance = "high" | "medium" | "low";

// The extras (certifications, awards, publications, languages) are facts rather than wording, so they can't be edited.
export const EDIT_SECTIONS = ["summary", "workExperiences", "educations", "projects", "skills"] as const;
export type EditSection = (typeof EDIT_SECTIONS)[number];

export interface MissingKeyword {
  keyword: string;
  importance: KeywordImportance;
  /** What to do about it: where to mention it if it is true, or what to learn if it isn't. */
  advice: string;
}

export type EditKind = "replace" | "add";

/**
 * One suggested change to the resume, pointing at an exact place so it can be accepted or rejected on its own.
 *
 * - `replace` swaps the text at a place for new wording.
 * - `add` puts a new bullet (or skills line) in. Its place is given as a position among the bullets the entry has now: 0 puts it first, and
 *   the number of bullets puts it last. It only ever states something the resume already says, and says which part (`basedOn`).
 */
export interface ResumeEdit {
  id: string;
  kind: EditKind;
  section: EditSection;
  /** Which work experience, education or project (0-based). Not used for the summary or skills. */
  entryIndex?: number;
  /** For a replace: which bullet (0-based) in that entry, or which skills line. For an add: the position to insert at. Not used for the summary. */
  bulletIndex?: number;
  /** A label for the place, such as "Summary" or the company name. */
  where: string;
  /** The text being replaced. Empty for an add. */
  before: string;
  /** The new text. */
  after: string;
  reason: string;
  /** For an add: the part of the resume the new text comes from, so the person can check it. */
  basedOn?: string;
}

/** The parts a match score is made of, with how many points each is worth. */
export const SCORE_CATEGORIES = [
  { key: "skills", label: "Required skills", max: 40 },
  { key: "experience", label: "Experience fit", max: 25 },
  { key: "keywords", label: "Job keywords", max: 20 },
  { key: "education", label: "Education and certifications", max: 10 },
  { key: "clarity", label: "Clarity and results", max: 5 },
] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number]["key"];

export interface ScoreBreakdownItem {
  key: ScoreCategory;
  label: string;
  score: number;
  max: number;
  /** Why points were lost. Empty when the part is full. */
  note: string;
}

export interface ResumeAnalysis {
  /** 0 to 100. When there is a breakdown, this is the sum of its parts. */
  matchScore: number;
  /** Where the score comes from. Empty when the model didn't give a usable one. */
  breakdown: ScoreBreakdownItem[];
  /** Why wording changes alone can or can't close the gap for this job. May be empty. */
  editNote: string;
  /** One or two sentences: how well the resume fits and the main thing to fix. */
  verdict: string;
  job: { title: string; company: string };
  matchedKeywords: string[];
  missingKeywords: MissingKeyword[];
  strengths: string[];
  gaps: string[];
  edits: ResumeEdit[];
}

export interface ResumeAnalysisResult {
  analysis: ResumeAnalysis;
  /** The resume as it was read: the starting point every edit applies to. */
  resume: Resume;
  /** The resume with every suggested edit applied. */
  tailoredResume: Resume;
}
