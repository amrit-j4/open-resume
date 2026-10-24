import { SCORE_CATEGORIES, type KeywordImportance, type ResumeAnalysis, type ScoreBreakdownItem } from "lib/resume-analysis/types";

const MAX_KEYWORDS = 30;
const MAX_MISSING = 20;
const MAX_POINTS = 10;

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

/**
 * The score's parts, in a fixed order, each a whole number within what it is worth. All five must be there for the breakdown to be shown: a
 * partial one would be misleading. A part that isn't a number counts as missing.
 */
const breakdownOf = (value: unknown): ScoreBreakdownItem[] => {
  const byKey = new Map<string, Json>();
  for (const entry of asArray(value)) {
    const e = asObject(entry);
    const key = typeof e.category === "string" ? e.category.trim().toLowerCase() : typeof e.key === "string" ? e.key.trim().toLowerCase() : "";
    if (key) byKey.set(key, e);
  }

  const items: ScoreBreakdownItem[] = [];
  for (const { key, label, max } of SCORE_CATEGORIES) {
    const e = byKey.get(key);
    const raw = e?.score;
    const n = typeof raw === "string" ? parseFloat(raw) : typeof raw === "number" ? raw : NaN;
    if (!e || !Number.isFinite(n)) return [];
    items.push({ key, label, score: Math.min(max, Math.max(0, Math.round(n))), max, note: text(e.note, 250) });
  }
  return items;
};

/** Turns whatever the model returned into a bounded, correctly typed analysis. Missing or wrongly typed values become empty ones. */
export const normalizeAnalysis = (raw: unknown): Omit<ResumeAnalysis, "edits"> => {
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

  const breakdown = breakdownOf(root.breakdown);

  return {
    // The parts add up to the score, so they can never disagree with the number shown beside them.
    matchScore: breakdown.length > 0 ? breakdown.reduce((sum, item) => sum + item.score, 0) : score(root.matchScore),
    breakdown,
    editNote: text(root.editNote, 500),
    verdict: text(root.verdict, 500),
    job: { title: text(job.title, 150), company: text(job.company, 150) },
    // A keyword is either matched or missing, never both.
    matchedKeywords: matched.filter((keyword) => !missingNames.has(keyword.toLowerCase())).slice(0, MAX_KEYWORDS),
    missingKeywords: missing.slice(0, MAX_MISSING),
    strengths: textList(root.strengths, MAX_POINTS, 300),
    gaps: textList(root.gaps, MAX_POINTS, 300),
  };
};
