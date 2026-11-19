import { deepClone } from "lib/deep-clone";
import type { Resume } from "lib/redux/types";
import { initialSettings, type ShowForm } from "lib/redux/settingsSlice";

/** The builder's saved state for a resume read from a file: its settings show exactly the sections that have content. */
export const builderStateFromImportedResume = (resume: Resume) => {
  const settings = deepClone(initialSettings);
  const sectionHasContent: Record<ShowForm, boolean> = {
    workExperiences: resume.workExperiences.length > 0,
    educations: resume.educations.length > 0,
    projects: resume.projects.length > 0,
    skills: resume.skills.featuredSkills.length > 0 || resume.skills.descriptions.length > 0,
    custom: resume.custom.descriptions.length > 0,
  };
  for (const section of Object.keys(settings.formToShow) as ShowForm[]) {
    settings.formToShow[section] = sectionHasContent[section];
  }
  return { resume, settings };
};
