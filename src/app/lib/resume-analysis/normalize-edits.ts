import type { Resume } from "lib/redux/types";
import { bulletCount, entryCount, textAt } from "lib/resume-analysis/apply-edits";
import { corpusOf, figuresAllowedAt, isEvidenced, lettersOnly, usesFiguresOutside, type Corpus } from "lib/resume-analysis/evidence";
import { EDIT_SECTIONS, type EditSection, type ResumeEdit } from "lib/resume-analysis/types";

const MAX_EDITS = 20;
const MAX_ADDS = 6;
const MAX_BASED_ON = 300;
const MAX_TEXT = 800;
const MAX_REASON = 400;

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {});

const text = (value: unknown, max: number): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

const section = (value: unknown): EditSection | null => {
  const wanted = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EDIT_SECTIONS.find((candidate) => candidate.toLowerCase() === wanted) ?? null;
};

/** A whole number from the model, which may arrive as a number or a numeric string. */
const index = (value: unknown): number | undefined => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : undefined;
};

const labelFor = (resume: Resume, edit: Pick<ResumeEdit, "section" | "entryIndex">): string => {
  const i = edit.entryIndex ?? -1;
  switch (edit.section) {
    case "summary":
      return "Summary";
    case "workExperiences":
      return resume.workExperiences[i]?.company || resume.workExperiences[i]?.jobTitle || "Work experience";
    case "educations":
      return resume.educations[i]?.school || "Education";
    case "projects":
      return resume.projects[i]?.project || "Project";
    default:
      return "Skills";
  }
};

/** Where to find a bullet when the model's numbers don't match: the one place in that section whose text is the text it quoted. */
const findByText = (resume: Resume, target: EditSection, quoted: string): { entryIndex?: number; bulletIndex: number } | undefined => {
  const wanted = lettersOnly(quoted);
  if (!wanted) return undefined;
  const matches: { entryIndex?: number; bulletIndex: number }[] = [];
  const entries = Math.max(entryCount(resume, target), 1);
  for (let entryIndex = 0; entryIndex < entries; entryIndex++) {
    for (let bulletIndex = 0; ; bulletIndex++) {
      const place = { section: target, entryIndex: entryCount(resume, target) ? entryIndex : undefined, bulletIndex };
      const current = textAt(resume, place);
      if (current === undefined) break;
      if (lettersOnly(current) === wanted) matches.push({ entryIndex: place.entryIndex, bulletIndex });
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
};

const isAllowed = (resume: Resume, target: EditSection, entryIndex: number | undefined, after: string, corpus: Corpus): boolean => {
  if (usesFiguresOutside(after, figuresAllowedAt(resume, corpus, { section: target, entryIndex }))) return false; // a figure that isn't this entry's own
  if (target === "skills") return isEvidenced(after, corpus); // a skill the resume gives no evidence of
  return true;
};

const isAdd = (e: Json): boolean => {
  const action = typeof e.action === "string" ? e.action : typeof e.kind === "string" ? e.kind : "";
  return action.trim().toLowerCase() === "add";
};

/** The bullets an add would go among, so a new one can be told apart from one the resume already has. */
const existingBullets = (resume: Resume, target: EditSection, entryIndex: number | undefined): string[] => {
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const current = textAt(resume, { section: target, entryIndex, bulletIndex: i });
    if (current === undefined) return out;
    out.push(current);
  }
};

/**
 * An add puts something new into the resume, so it is held to a stricter standard than rewording. It must go in a real place (a position
 * among the entry's bullets), say which part of the resume it comes from, repeat nothing that is already there, use only figures from its own
 * entry, and use only words the resume already uses, so it can't introduce a tool, skill or employer. The summary can't be added to.
 */
const checkedAdd = (
  e: Json,
  target: EditSection,
  resume: Resume,
  corpus: Corpus,
  taken: Set<string>,
  drop: (reason: DropReason) => null
): Omit<ResumeEdit, "id"> | null => {
  if (target === "summary") return drop("add-to-summary");

  const entryIndex = target === "skills" ? undefined : index(e.entry ?? e.entryIndex);
  const count = bulletCount(resume, { section: target, entryIndex });
  if (count === undefined) return drop("no-such-place");

  const position = index(e.position ?? e.bulletIndex ?? e.bullet);
  if (position === undefined || position > count) return drop("no-such-place");

  const after = text(e.after, MAX_TEXT);
  const basedOn = text(e.basedOn, MAX_BASED_ON);
  if (!after || !basedOn) return drop("add-without-source");
  if (usesFiguresOutside(after, figuresAllowedAt(resume, corpus, { section: target, entryIndex }))) return drop("figure-not-in-entry");
  if (!isEvidenced(after, corpus)) return drop("word-not-in-resume");

  const key = lettersOnly(after);
  if (existingBullets(resume, target, entryIndex).some((current) => lettersOnly(current) === key)) return drop("already-there");
  const place = `add:${target}:${entryIndex ?? ""}:${key}`;
  if (taken.has(place)) return drop("already-there");
  taken.add(place);

  return {
    kind: "add",
    section: target,
    ...(entryIndex !== undefined && { entryIndex }),
    bulletIndex: position,
    where: labelFor(resume, { section: target, entryIndex }),
    before: "",
    after,
    reason: text(e.reason, MAX_REASON),
    basedOn,
  };
};

/** Why an edit was thrown away. Counted, so that "why so few suggestions?" can be answered without reading anyone's resume. */
export type DropReason =
  | "unknown-section"
  | "add-to-summary"
  | "add-without-source"
  | "no-such-place"
  | "quoted-text-not-found"
  | "no-change"
  | "figure-not-in-entry"
  | "word-not-in-resume"
  | "already-there"
  | "too-many";

export type DropCounts = Partial<Record<DropReason, number>>;

/**
 * Turns the model's suggested edits into ones that can be trusted. Each edit must point at a real place in the resume (when its numbers are
 * off, it is found by the text it quotes), must really change the wording rather than just its punctuation, and must not bring in a figure
 * or skill that the resume doesn't contain. The "before" text always comes from the resume itself, never from the model. `dropped`, when
 * given, is filled with how many edits were thrown away and why.
 */
export const normalizeEdits = (raw: unknown, resume: Resume, dropped: DropCounts = {}): ResumeEdit[] => {
  const corpus = corpusOf(resume);
  const taken = new Set<string>();
  const edits: ResumeEdit[] = [];
  const drop = (reason: DropReason): null => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
    return null;
  };

  for (const entry of Array.isArray(raw) ? raw : []) {
    if (edits.length >= MAX_EDITS) {
      drop("too-many");
      continue;
    }
    const e = asObject(entry);
    const target = section(e.section);
    if (!target) {
      drop("unknown-section");
      continue;
    }

    if (isAdd(e)) {
      const added = checkedAdd(e, target, resume, corpus, taken, drop);
      if (!added) continue;
      if (edits.filter((edit) => edit.kind === "add").length >= MAX_ADDS) {
        drop("too-many");
        continue;
      }
      edits.push({ ...added, id: `edit-${edits.length + 1}` });
      continue;
    }

    let entryIndex = target === "workExperiences" || target === "educations" || target === "projects" ? index(e.entry ?? e.entryIndex) : undefined;
    let bulletIndex = target === "summary" ? undefined : index(e.bullet ?? e.bulletIndex);

    let before = textAt(resume, { section: target, entryIndex, bulletIndex });
    const quoted = text(e.before, MAX_TEXT);
    // The model counts places badly now and then. If it quoted the text it means and that isn't what is at its numbers, go by the text; if the
    // text can't be found either, the edit is ambiguous and is dropped rather than risk rewording the wrong bullet.
    if (target !== "summary" && quoted && (before === undefined || lettersOnly(before) !== lettersOnly(quoted))) {
      const found = findByText(resume, target, quoted);
      if (!found) {
        drop("quoted-text-not-found");
        continue;
      }
      entryIndex = found.entryIndex;
      bulletIndex = found.bulletIndex;
      before = textAt(resume, { section: target, entryIndex, bulletIndex });
    }
    if (before === undefined) {
      drop("no-such-place");
      continue;
    }

    const after = text(e.after, MAX_TEXT);
    if (!after || lettersOnly(after) === lettersOnly(before)) {
      drop("no-change");
      continue;
    }
    if (!isAllowed(resume, target, entryIndex, after, corpus)) {
      drop(usesFiguresOutside(after, figuresAllowedAt(resume, corpus, { section: target, entryIndex })) ? "figure-not-in-entry" : "word-not-in-resume");
      continue;
    }

    const place = `${target}:${entryIndex ?? ""}:${bulletIndex ?? ""}`;
    if (taken.has(place)) {
      drop("already-there");
      continue;
    }
    taken.add(place);

    edits.push({
      id: `edit-${edits.length + 1}`,
      kind: "replace",
      section: target,
      ...(entryIndex !== undefined && { entryIndex }),
      ...(bulletIndex !== undefined && { bulletIndex }),
      where: labelFor(resume, { section: target, entryIndex }),
      before,
      after,
      reason: text(e.reason, MAX_REASON),
    });
  }
  return edits;
};
