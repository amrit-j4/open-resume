import type { Resume } from "lib/redux/types";
import type { EditSection, ResumeEdit } from "lib/resume-analysis/types";

type Location = Pick<ResumeEdit, "section" | "entryIndex" | "bulletIndex">;

const isIndex = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** The list of bullets an edit points into, or undefined when the place doesn't exist in this resume. */
const bulletsAt = (resume: Resume, { section, entryIndex }: Location): string[] | undefined => {
  switch (section) {
    case "workExperiences":
    case "educations":
    case "projects":
      return isIndex(entryIndex) ? resume[section][entryIndex]?.descriptions : undefined;
    case "skills":
      return resume.skills.descriptions;
    default:
      return undefined;
  }
};

/** The text an edit would replace, or undefined when the place doesn't exist in this resume. */
export const textAt = (resume: Resume, location: Location): string | undefined => {
  if (location.section === "summary") return resume.profile.summary;
  const bullets = bulletsAt(resume, location);
  return isIndex(location.bulletIndex) ? bullets?.[location.bulletIndex] : undefined;
};

/** How many bullets the place an edit points into has, which is how far an add can be positioned. Undefined when the place doesn't exist. */
export const bulletCount = (resume: Resume, location: Pick<Location, "section" | "entryIndex">): number | undefined =>
  location.section === "summary" ? undefined : bulletsAt(resume, location)?.length;

/** How many entries a section has, for checking an index. Sections without entries have none. */
export const entryCount = (resume: Resume, section: EditSection): number =>
  section === "workExperiences" || section === "educations" || section === "projects" ? resume[section].length : 0;

type Applicable = Pick<ResumeEdit, "section" | "entryIndex" | "bulletIndex" | "after"> & { kind?: ResumeEdit["kind"] };

/**
 * Returns a copy of the resume with the edits applied. Edits that point at a place that doesn't exist are skipped, and the resume given is
 * never changed.
 *
 * Every edit is placed by the resume as it was before any edit, so none of them depends on another: any subset can be applied, in any order.
 * Replaces are done first, in place. Adds are then slotted in around the original bullets (an add at position 2 goes before the original
 * third bullet, wherever replaces happened); adds at the same position keep the order they were given in.
 */
export const applyEdits = (resume: Resume, edits: Applicable[]): Resume => {
  const next: Resume = {
    ...resume,
    profile: { ...resume.profile },
    workExperiences: resume.workExperiences.map((entry) => ({ ...entry, descriptions: [...entry.descriptions] })),
    educations: resume.educations.map((entry) => ({ ...entry, descriptions: [...entry.descriptions] })),
    projects: resume.projects.map((entry) => ({ ...entry, descriptions: [...entry.descriptions] })),
    skills: { ...resume.skills, featuredSkills: [...resume.skills.featuredSkills], descriptions: [...resume.skills.descriptions] },
    custom: { descriptions: [...resume.custom.descriptions] },
  };

  const adds: Applicable[] = [];
  for (const edit of edits) {
    if (edit.kind === "add") {
      adds.push(edit);
      continue;
    }
    if (edit.section === "summary") {
      next.profile.summary = edit.after;
      continue;
    }
    const bullets = bulletsAt(next, edit);
    if (bullets && isIndex(edit.bulletIndex) && edit.bulletIndex < bullets.length) {
      bullets[edit.bulletIndex] = edit.after;
    }
  }

  // Group the adds by the list they go into, then rebuild each list once, walking the original positions.
  const groups = new Map<string[], Applicable[]>();
  for (const edit of adds) {
    const bullets = bulletsAt(next, edit);
    if (!bullets || !isIndex(edit.bulletIndex) || edit.bulletIndex > bullets.length) continue;
    groups.set(bullets, [...(groups.get(bullets) ?? []), edit]);
  }
  groups.forEach((group, bullets) => {
    const original = [...bullets];
    const rebuilt: string[] = [];
    for (let position = 0; position <= original.length; position++) {
      group.filter((edit) => edit.bulletIndex === position).forEach((edit) => rebuilt.push(edit.after));
      if (position < original.length) rebuilt.push(original[position]);
    }
    bullets.splice(0, bullets.length, ...rebuilt);
  });

  return next;
};

/**
 * The resume as an indexed outline, which is how the model reads it: every place an edit can point at has its 0-based number beside it, so
 * "work experience 1, bullet 2" is unambiguous.
 */
export const outlineOf = (resume: Resume): string => {
  const lines: string[] = [];
  const bullets = (items: string[], indent = "  ") => items.forEach((text, i) => lines.push(`${indent}[${i}] ${text}`));
  const join = (...parts: string[]) => parts.filter(Boolean).join(" | ");

  lines.push(`NAME: ${resume.profile.name}`);
  lines.push(`SUMMARY: ${resume.profile.summary || "(none)"}`);

  if (resume.workExperiences.length) lines.push("", "WORK EXPERIENCES (section: workExperiences)");
  resume.workExperiences.forEach((entry, i) => {
    lines.push(`[${i}] ${join(entry.company, entry.jobTitle, entry.date)}`);
    bullets(entry.descriptions);
  });

  if (resume.educations.length) lines.push("", "EDUCATIONS (section: educations)");
  resume.educations.forEach((entry, i) => {
    lines.push(`[${i}] ${join(entry.school, entry.degree, entry.date, entry.gpa && `GPA ${entry.gpa}`)}`);
    bullets(entry.descriptions);
  });

  if (resume.projects.length) lines.push("", "PROJECTS (section: projects)");
  resume.projects.forEach((entry, i) => {
    lines.push(`[${i}] ${join(entry.project, entry.date)}`);
    bullets(entry.descriptions);
  });

  if (resume.skills.featuredSkills.length) {
    lines.push("", `FEATURED SKILLS (not editable): ${resume.skills.featuredSkills.map((s) => `${s.skill} (${s.rating}/5)`).join(", ")}`);
  }
  if (resume.skills.descriptions.length) {
    lines.push("", "SKILL LINES (section: skills)");
    bullets(resume.skills.descriptions, "");
  }
  if (resume.custom.descriptions.length) {
    lines.push("", "EXTRAS: certifications, awards, publications, languages and more (read-only, never edit)");
    resume.custom.descriptions.forEach((text) => lines.push(`- ${text}`));
  }
  return lines.join("\n");
};
