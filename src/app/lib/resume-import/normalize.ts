import type { Resume } from "lib/redux/types";

const MAX_ENTRIES = 20;
const MAX_BULLETS = 15;
const MAX_FEATURED_SKILLS = 6;
const MAX_FIELD_LENGTH = 500;
const MAX_BULLET_LENGTH = 600;

type Json = Record<string, unknown> | undefined | null;

const asObject = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown, max = MAX_FIELD_LENGTH): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

const bullets = (value: unknown): string[] =>
  asArray(value)
    .map((item) => text(item, MAX_BULLET_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);

/**
 * Turns whatever the model returned into a `Resume` the builder can load. Missing or wrongly typed values become empty ones, and every
 * list and string is bounded, so a malformed answer can't break or flood the builder.
 */
export const normalizeResume = (raw: unknown): Resume => {
  const root = asObject(raw) ?? {};
  const profile = asObject(root.profile) ?? {};
  const skills = asObject(root.skills) ?? {};
  const custom = asObject(root.custom) ?? {};

  return {
    profile: {
      name: text(profile.name),
      email: text(profile.email),
      phone: text(profile.phone),
      url: text(profile.url),
      summary: text(profile.summary, MAX_BULLET_LENGTH),
      location: text(profile.location),
    },
    workExperiences: asArray(root.workExperiences)
      .slice(0, MAX_ENTRIES)
      .map((entry) => {
        const e = asObject(entry) ?? {};
        return {
          company: text(e.company),
          jobTitle: text(e.jobTitle),
          date: text(e.date),
          descriptions: bullets(e.descriptions),
        };
      }),
    educations: asArray(root.educations)
      .slice(0, MAX_ENTRIES)
      .map((entry) => {
        const e = asObject(entry) ?? {};
        return {
          school: text(e.school),
          degree: text(e.degree),
          date: text(e.date),
          gpa: text(e.gpa),
          descriptions: bullets(e.descriptions),
        };
      }),
    projects: asArray(root.projects)
      .slice(0, MAX_ENTRIES)
      .map((entry) => {
        const e = asObject(entry) ?? {};
        return {
          project: text(e.project),
          date: text(e.date),
          descriptions: bullets(e.descriptions),
        };
      }),
    skills: {
      featuredSkills: asArray(skills.featuredSkills)
        .map((entry) => asObject(entry) ?? {})
        .filter((e) => text(e.skill))
        .slice(0, MAX_FEATURED_SKILLS)
        .map((e) => {
          const rating = Number(e.rating);
          return {
            skill: text(e.skill),
            rating: Number.isFinite(rating) && rating >= 1 ? Math.min(5, Math.round(rating)) : 4,
          };
        }),
      descriptions: bullets(skills.descriptions),
    },
    custom: { descriptions: bullets(custom.descriptions) },
  };
};
