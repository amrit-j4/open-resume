import type { Resume } from "lib/redux/types";
import { lettersOnly } from "lib/resume-analysis/evidence";
import type { EditSection, ResumeEdit } from "lib/resume-analysis/types";

/**
 * Suggestions live next to the form fields they are about, and the person is free to edit the resume while they are pending. So a suggestion
 * can't just say "bullet 2 of job 1": by the time it is accepted, that line may have moved or been reworded. This finds it again by its text.
 */

export interface Suggestion {
  edit: ResumeEdit;
  /** What identified the entry when the analysis was made, so it can be found again if entries have been moved. */
  entryKey?: string;
  /** For an add: the text of the bullet it goes after. Undefined when it goes first. */
  anchorText?: string;
}

/** The rewordings accepted so far: a bullet's original text (tidied) to the tidied texts it has become. Lets an add still find its anchor. */
export type Rewrites = Record<string, string[]>;

export type Place =
  | { kind: "summary" }
  | { kind: "replace"; section: EntrySection | "skills"; entryIndex?: number; bulletIndex: number }
  | { kind: "add"; section: EntrySection | "skills"; entryIndex?: number; insertAt: number };

type EntrySection = "workExperiences" | "educations" | "projects";

const isEntrySection = (section: EditSection): section is EntrySection =>
  section === "workExperiences" || section === "educations" || section === "projects";

const entryKeyOf = (resume: Resume, section: EntrySection, index: number): string | undefined => {
  const entry = resume[section][index];
  if (!entry) return undefined;
  if (section === "workExperiences") {
    const e = resume.workExperiences[index];
    return lettersOnly(`${e.company}|${e.jobTitle}|${e.date}`);
  }
  if (section === "educations") {
    const e = resume.educations[index];
    return lettersOnly(`${e.school}|${e.degree}|${e.date}`);
  }
  const e = resume.projects[index];
  return lettersOnly(`${e.project}|${e.date}`);
};

/** The bullets a suggestion points into, in a resume. Undefined when the entry or list isn't there. */
const bulletsIn = (resume: Resume, section: EntrySection | "skills", entryIndex: number | undefined): string[] | undefined =>
  section === "skills" ? resume.skills.descriptions : entryIndex === undefined ? undefined : resume[section][entryIndex]?.descriptions;

/** Makes each edit findable later: records which entry it was in, and for an add the line it goes after. Done once, on the resume as analysed. */
export const buildSuggestions = (resume: Resume, edits: ResumeEdit[]): Suggestion[] =>
  edits.map((edit) => {
    const suggestion: Suggestion = { edit };
    if (isEntrySection(edit.section) && edit.entryIndex !== undefined) {
      suggestion.entryKey = entryKeyOf(resume, edit.section, edit.entryIndex);
    }
    if (edit.kind === "add" && edit.section !== "summary" && edit.bulletIndex !== undefined && edit.bulletIndex > 0) {
      const section = edit.section as EntrySection | "skills";
      suggestion.anchorText = bulletsIn(resume, section, edit.entryIndex)?.[edit.bulletIndex - 1];
    }
    return suggestion;
  });

/** True when the text is the given original, or something it was reworded into by an accepted suggestion. */
const isVersionOf = (text: string, original: string, rewrites: Rewrites): boolean => {
  const key = lettersOnly(original);
  const tidy = lettersOnly(text);
  return tidy === key || (rewrites[key] ?? []).includes(tidy);
};

/** Which entry in the resume now is the one this suggestion was about: the same entry by its header, or else the one at the same number. */
export const entryIndexOf = (resume: Resume, suggestion: Suggestion): number | undefined => {
  const { edit, entryKey } = suggestion;
  if (!isEntrySection(edit.section) || edit.entryIndex === undefined) return undefined;
  const entries = resume[edit.section];
  if (entryKey) {
    const byKey = entries.findIndex((_, i) => entryKeyOf(resume, edit.section as EntrySection, i) === entryKey);
    if (byKey >= 0) return byKey;
  }
  return edit.entryIndex < entries.length ? edit.entryIndex : undefined;
};

/**
 * Where a suggestion applies in the resume as it is now, or null when it no longer does (its line was removed or reworded by hand). A reword
 * is found by the text it replaces; an add by the line it follows, falling back to its original position if that line is gone.
 */
export const locate = (resume: Resume, suggestion: Suggestion, rewrites: Rewrites): Place | null => {
  const { edit } = suggestion;
  if (edit.section === "summary") return { kind: "summary" };

  const section = edit.section as EntrySection | "skills";
  const entryIndex = section === "skills" ? undefined : entryIndexOf(resume, suggestion);
  if (section !== "skills" && entryIndex === undefined) return null;
  const bullets = bulletsIn(resume, section, entryIndex);
  if (!bullets) return null;

  if (edit.kind === "replace") {
    const bulletIndex = bullets.findIndex((text) => isVersionOf(text, edit.before, rewrites) && lettersOnly(text) !== lettersOnly(edit.after));
    return bulletIndex >= 0 ? { kind: "replace", section, entryIndex, bulletIndex } : null;
  }

  if (suggestion.anchorText === undefined) {
    // It went first, unless the position was already past the start.
    return { kind: "add", section, entryIndex, insertAt: edit.bulletIndex === 0 ? 0 : Math.min(edit.bulletIndex ?? 0, bullets.length) };
  }
  const anchor = bullets.findIndex((text) => isVersionOf(text, suggestion.anchorText!, rewrites));
  return { kind: "add", section, entryIndex, insertAt: anchor >= 0 ? anchor + 1 : Math.min(edit.bulletIndex ?? bullets.length, bullets.length) };
};

/** A change to make to the resume, in the shape the builder's own actions take. */
export type Update =
  | { kind: "summary"; value: string }
  | { kind: "bullets"; section: EntrySection | "skills"; entryIndex?: number; value: string[] };

export interface Applied {
  update: Update;
  rewrites: Rewrites;
}

/** What accepting a suggestion with the given text would do to the resume, or null if it no longer applies. */
export const applySuggestion = (resume: Resume, suggestion: Suggestion, text: string, rewrites: Rewrites): Applied | null => {
  const place = locate(resume, suggestion, rewrites);
  if (!place) return null;
  if (place.kind === "summary") return { update: { kind: "summary", value: text }, rewrites };

  const bullets = [...(bulletsIn(resume, place.section, place.entryIndex) ?? [])];
  if (place.kind === "replace") {
    const key = lettersOnly(suggestion.edit.before);
    bullets[place.bulletIndex] = text;
    return {
      update: { kind: "bullets", section: place.section, entryIndex: place.entryIndex, value: bullets },
      rewrites: { ...rewrites, [key]: [...(rewrites[key] ?? []), lettersOnly(text)] },
    };
  }
  bullets.splice(place.insertAt, 0, text);
  return { update: { kind: "bullets", section: place.section, entryIndex: place.entryIndex, value: bullets }, rewrites };
};

/**
 * What undoing an accepted suggestion would do. It goes by the text that was put in, so it still works after other edits: a reword is put back
 * to the original wording, an add is taken out again. Null when that text is no longer in the resume (it was changed by hand).
 */
export const undoSuggestion = (resume: Resume, suggestion: Suggestion, appliedText: string): Update | null => {
  const { edit } = suggestion;
  if (edit.section === "summary") {
    return lettersOnly(resume.profile.summary) === lettersOnly(appliedText) ? { kind: "summary", value: edit.before } : null;
  }

  const section = edit.section as EntrySection | "skills";
  const candidates = section === "skills" ? [undefined] : resume[section].map((_, i) => i);
  const target = lettersOnly(appliedText);
  for (const entryIndex of edit.entryIndex === undefined || section === "skills" ? candidates : [entryIndexOf(resume, suggestion), ...candidates]) {
    if (section !== "skills" && entryIndex === undefined) continue;
    const bullets = bulletsIn(resume, section, entryIndex);
    const at = bullets?.findIndex((text) => lettersOnly(text) === target) ?? -1;
    if (!bullets || at < 0) continue;

    const next = [...bullets];
    if (edit.kind === "replace") next[at] = edit.before;
    else next.splice(at, 1);
    return { kind: "bullets", section, entryIndex, value: next };
  }
  return null;
};

/** Forgets that a rewording was made, once it is undone. */
export const forgetRewrite = (rewrites: Rewrites, suggestion: Suggestion, appliedText: string): Rewrites => {
  const key = lettersOnly(suggestion.edit.before);
  const left = (rewrites[key] ?? []).filter((text) => text !== lettersOnly(appliedText));
  const next = { ...rewrites };
  if (left.length) next[key] = left;
  else delete next[key];
  return next;
};

/** The resume with an update made to it. The resume given is not changed. */
export const applyUpdate = (resume: Resume, update: Update): Resume => {
  if (update.kind === "summary") return { ...resume, profile: { ...resume.profile, summary: update.value } };
  if (update.section === "skills") return { ...resume, skills: { ...resume.skills, descriptions: update.value } };

  const { section, entryIndex } = update;
  return {
    ...resume,
    [section]: resume[section].map((entry, i) => (i === entryIndex ? { ...entry, descriptions: update.value } : entry)),
  };
};
