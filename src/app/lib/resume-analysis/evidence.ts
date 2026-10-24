import type { Resume } from "lib/redux/types";

/**
 * What the original resume says, for checking that a suggested rewording doesn't invent anything: its text, and the whole numbers in it
 * (so "15" isn't mistaken for part of "2015").
 */
export interface Corpus {
  text: string;
  numbers: Set<string>;
}

const NUMBER = /\d[\d,.]*/g;
const WORD = /[a-z0-9+#]+/g;

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ");

/** Every piece of text in a resume, tidied and lower-cased. */
export const textsOf = (resume: Resume): string[] => {
  const texts: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") texts.push(normalize(value).trim());
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(resume);
  return texts.filter(Boolean);
};

export const numbersIn = (value: string): string[] => (value.match(NUMBER) ?? []).map((n) => n.replace(/[.,]+$/, ""));

export const corpusOf = (resume: Resume): Corpus => {
  const text = textsOf(resume).join(" | "); // the words only: ratings and other JSON punctuation are not claims
  return { text, numbers: new Set(numbersIn(text)) };
};

/** True when the text mentions a number that isn't in the original resume. */
export const introducesNumbers = (value: string, corpus: Corpus): boolean => numbersIn(value).some((n) => !corpus.numbers.has(n));

/** True when every word of the text appears somewhere in the original resume. */
export const isEvidenced = (value: string, corpus: Corpus): boolean => {
  const words = normalize(value).match(WORD) ?? [];
  return words.length > 0 && words.every((word) => corpus.text.includes(word));
};

/** Text with only its letters and digits, lower-cased, so edits that change nothing but punctuation, spacing or capitals can be told apart. */
export const lettersOnly = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Every string inside a value, however deeply it is nested. */
const stringsIn = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
};

/**
 * The figures a rewording of one place may use. A figure belongs to the entry it was written in, so a bullet may only use figures from its
 * own entry: "saving 12 hours" from one job must not turn up on a claim about another. The summary may draw on any figure in the resume, and
 * a skills line only on the figures the skills already have.
 */
export const figuresAllowedAt = (resume: Resume, corpus: Corpus, place: { section: string; entryIndex?: number }): Set<string> => {
  if (place.section === "summary") return corpus.numbers;
  if (place.section === "skills") return new Set(numbersIn(stringsIn(resume.skills.descriptions).join(" ")));

  const entries =
    place.section === "workExperiences" ? resume.workExperiences : place.section === "educations" ? resume.educations : place.section === "projects" ? resume.projects : [];
  const entry = place.entryIndex === undefined ? undefined : entries[place.entryIndex];
  return new Set(entry ? numbersIn(stringsIn(entry).join(" ")) : []);
};

/** True when the text mentions a figure that isn't in the given set. */
export const usesFiguresOutside = (value: string, allowed: Set<string>): boolean => numbersIn(value).some((n) => !allowed.has(n));
