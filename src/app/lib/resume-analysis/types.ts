import type { Resume } from "lib/redux/types";

export type KeywordImportance = "high" | "medium" | "low";

export const CHANGE_SECTIONS = ["summary", "workExperiences", "educations", "projects", "skills", "custom"] as const;
export type ChangeSection = (typeof CHANGE_SECTIONS)[number];

export interface MissingKeyword {
  keyword: string;
  importance: KeywordImportance;
  /** What to do about it: where to mention it if it is true, or what to learn if it isn't. */
  advice: string;
}

export interface SuggestedChange {
  section: ChangeSection;
  /** Which entry it applies to, such as "Cascade Studios" or "Summary". */
  where: string;
  before: string;
  after: string;
  reason: string;
}

export interface ResumeAnalysis {
  /** 0 to 100. */
  matchScore: number;
  /** One or two sentences: how well the resume fits and the main thing to fix. */
  verdict: string;
  job: { title: string; company: string };
  matchedKeywords: string[];
  missingKeywords: MissingKeyword[];
  strengths: string[];
  gaps: string[];
  changes: SuggestedChange[];
}

export interface ResumeAnalysisResult {
  analysis: ResumeAnalysis;
  /** The resume as it was read, for showing before and after. */
  resume: Resume;
  /** The same resume reworded for this job, ready to load into the builder. */
  tailoredResume: Resume;
}
