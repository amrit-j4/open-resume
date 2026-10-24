import { CHANGE_SECTIONS, type ChangeSection, type KeywordImportance, type ResumeAnalysis } from "lib/resume-analysis/types";

const MAX_KEYWORDS = 30;
const MAX_MISSING = 20;
const MAX_POINTS = 10;
const MAX_CHANGES = 25;

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown, max: number): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

const textList = (value: unknown, max: number, itemMax: number): string[] =>
  asArray(value)
    .map((item) => text(item, itemMax))
    .filter(Boolean)
    .slice(0, max);

const importance = (value: unknown): KeywordImportance => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "high" || normalized === "low" ? normalized : "medium";
};

const section = (value: unknown): ChangeSection | null => {
  const wanted = typeof value === "string" ? value.trim().toLowerCase() : "";
  return CHANGE_SECTIONS.find((candidate) => candidate.toLowerCase() === wanted) ?? null;
};

/** Text with only its letters and digits, lower-cased, so edits that change nothing but punctuation, spacing or capitals can be told apart. */
const lettersOnly = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const unique = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The score as a whole number from 0 to 100; a missing or nonsensical score is 0. A fraction such as 0.82 is read as a percentage. */
const score = (value: unknown): number => {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  const percent = n > 0 && n <= 1 && !Number.isInteger(n) ? n * 100 : n;
  return Math.min(100, Math.round(percent));
};

/** Turns whatever the model returned into a bounded, correctly typed analysis. Missing or wrongly typed values become empty ones. */
export const normalizeAnalysis = (raw: unknown): ResumeAnalysis => {
  const root = asObject(raw);
  const job = asObject(root.job);

  const missing = asArray(root.missingKeywords)
    .map((entry) => {
      const e = asObject(entry);
      return { keyword: text(e.keyword, 80), importance: importance(e.importance), advice: text(e.advice, 400) };
    })
    .filter((entry) => entry.keyword);

  const matched = unique(textList(root.matchedKeywords, MAX_KEYWORDS * 2, 80));
  const missingNames = new Set(missing.map((entry) => entry.keyword.toLowerCase()));

  const changes = asArray(root.changes)
    .map((entry) => {
      const e = asObject(entry);
      const target = section(e.section);
      return target
        ? { section: target, where: text(e.where, 120), before: text(e.before, 800), after: text(e.after, 800), reason: text(e.reason, 400) }
        : null;
    })
    .filter(
      (entry): entry is NonNullable<typeof entry> =>
        entry !== null && entry.after.length > 0 && lettersOnly(entry.after) !== lettersOnly(entry.before)
    )
    .slice(0, MAX_CHANGES);

  return {
    matchScore: score(root.matchScore),
    verdict: text(root.verdict, 500),
    job: { title: text(job.title, 150), company: text(job.company, 150) },
    // A keyword is either matched or missing, never both.
    matchedKeywords: matched.filter((keyword) => !missingNames.has(keyword.toLowerCase())).slice(0, MAX_KEYWORDS),
    missingKeywords: missing.slice(0, MAX_MISSING),
    strengths: textList(root.strengths, MAX_POINTS, 300),
    gaps: textList(root.gaps, MAX_POINTS, 300),
    changes,
  };
};
