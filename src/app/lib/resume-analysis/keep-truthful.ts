import type { Resume } from "lib/redux/types";

/**
 * The model rewrites the resume for a job, and a rewrite must never invent anything. This takes its answer and puts back everything it was
 * not allowed to change, so what reaches the builder is the person's own resume, reworded:
 * - contact details, employers, job titles, schools, degrees, dates, GPA and the number of entries always come from the original;
 * - a work, education or project entry whose bullets bring in a number that isn't in the original keeps its original bullets;
 * - skills and skill lines that don't appear in the original are dropped (and if that leaves a list empty, the original list stays).
 */

const NUMBER = /\d[\d,.]*/g;
const WORD = /[a-z0-9+#]+/g;

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ");

const numbersIn = (value: string): string[] => (value.match(NUMBER) ?? []).map((n) => n.replace(/[.,]+$/, ""));

/** Every piece of text in a resume, tidied, for checking that a described edit really is in it. */
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

/** What the original resume says: its text, lower-cased, and the whole numbers in it (so "15" isn't mistaken for part of "2015"). */
interface Corpus {
  text: string;
  numbers: Set<string>;
}

const corpusOf = (resume: Resume): Corpus => {
  const text = textsOf(resume).join(" | "); // the words only: ratings and other JSON punctuation are not claims
  return { text, numbers: new Set(numbersIn(text)) };
};

const introducesNumbers = (bullets: string[], corpus: Corpus): boolean =>
  bullets.some((bullet) => numbersIn(bullet).some((n) => !corpus.numbers.has(n)));

/** Keeps a rewritten list of bullets only if it adds no new figures; otherwise the original bullets stay. */
const safeBullets = (rewritten: string[] | undefined, original: string[], corpus: Corpus): string[] =>
  rewritten && rewritten.length > 0 && !introducesNumbers(rewritten, corpus) ? rewritten : original;

/** The rewritten list, or the original if the rewrite left nothing, so a bad answer never wipes out a section. */
const orOriginal = <T,>(rewritten: T[], original: T[]): T[] => (rewritten.length > 0 ? rewritten : original);

/** True when every word of the skill appears somewhere in the original resume. */
const isEvidenced = (skill: string, corpus: Corpus): boolean => {
  const words = normalize(skill).match(WORD) ?? [];
  return words.length > 0 && words.every((word) => corpus.text.includes(word));
};

export const keepTruthful = (original: Resume, tailored: Resume): Resume => {
  const corpus = corpusOf(original);

  return {
    profile: {
      ...original.profile,
      summary: tailored.profile.summary && !introducesNumbers([tailored.profile.summary], corpus) ? tailored.profile.summary : original.profile.summary,
    },
    workExperiences: original.workExperiences.map((entry, i) => ({
      ...entry,
      descriptions: safeBullets(tailored.workExperiences[i]?.descriptions, entry.descriptions, corpus),
    })),
    educations: original.educations.map((entry, i) => ({
      ...entry,
      descriptions: safeBullets(tailored.educations[i]?.descriptions, entry.descriptions, corpus),
    })),
    projects: original.projects.map((entry, i) => ({
      ...entry,
      descriptions: safeBullets(tailored.projects[i]?.descriptions, entry.descriptions, corpus),
    })),
    skills: {
      featuredSkills: orOriginal(
        tailored.skills.featuredSkills.filter((s) => isEvidenced(s.skill, corpus)),
        original.skills.featuredSkills
      ),
      descriptions: orOriginal(
        tailored.skills.descriptions.filter((line) => isEvidenced(line, corpus)),
        original.skills.descriptions
      ),
    },
    custom: {
      descriptions: orOriginal(
        tailored.custom.descriptions.filter((line) => isEvidenced(line, corpus) && !introducesNumbers([line], corpus)),
        original.custom.descriptions
      ),
    },
  };
};
