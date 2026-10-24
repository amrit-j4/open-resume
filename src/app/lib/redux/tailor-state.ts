import { deepClone } from "lib/deep-clone";
import { loadStateFromLocalStorage, saveStateToLocalStorage } from "lib/redux/local-storage";
import type { Resume } from "lib/redux/types";
import { initialSettings, type ShowForm } from "lib/redux/settingsSlice";
import type { RootState } from "lib/redux/store";

const BACKUP_KEY = "job4online-resume-backup";

interface Backup {
  state: RootState;
  savedAt: string;
}

/** True when the resume has something in it worth analysing. */
export const resumeHasContent = (resume: Resume | undefined): resume is Resume =>
  Boolean(
    resume &&
      (resume.profile?.name ||
        resume.workExperiences?.length ||
        resume.educations?.length ||
        resume.projects?.length ||
        resume.skills?.featuredSkills?.length)
  );

/** The resume saved in this browser by the builder, or undefined when there isn't a usable one. */
export const loadBuilderResume = (): Resume | undefined => {
  const resume = loadStateFromLocalStorage()?.resume as Resume | undefined;
  return resumeHasContent(resume) ? resume : undefined;
};

/** The sections of a resume that have content, so loading it shows them in the builder. */
const sectionsWithContent = (resume: Resume): Record<ShowForm, boolean> => ({
  workExperiences: resume.workExperiences.length > 0,
  educations: resume.educations.length > 0,
  projects: resume.projects.length > 0,
  skills: resume.skills.featuredSkills.length > 0 || resume.skills.descriptions.length > 0,
  custom: resume.custom.descriptions.length > 0,
});

/**
 * Loads a tailored resume into the builder. What the builder held before is kept in a backup first, so it can be restored. The person's
 * template, colours and fonts are kept; sections that now have content are switched on, and none are switched off.
 */
export const applyTailoredResume = (tailored: Resume): void => {
  const current = loadStateFromLocalStorage() as RootState | undefined;
  const settings = deepClone(current?.settings ?? initialSettings);

  if (current) {
    try {
      const backup: Backup = { state: current, savedAt: new Date().toISOString() };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    } catch {
      // Without a backup the apply still works; there is just nothing to undo to.
    }
  }

  const show = sectionsWithContent(tailored);
  for (const section of Object.keys(show) as ShowForm[]) {
    if (show[section]) settings.formToShow[section] = true;
  }

  saveStateToLocalStorage({ resume: tailored, settings });
};

/** True when a backup of the resume from before the last apply exists. */
export const hasBackup = (): boolean => {
  try {
    return Boolean(localStorage.getItem(BACKUP_KEY));
  } catch {
    return false;
  }
};

/** Puts back what the builder held before the last apply, and removes the backup. Returns false when there was nothing to restore. */
export const restoreBackup = (): boolean => {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return false;
    const { state } = JSON.parse(raw) as Backup;
    saveStateToLocalStorage(state);
    localStorage.removeItem(BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
};
