/**
 * Which resume in the person's Job4online account the builder is editing, if any. Set when they arrive from "Edit" on their resumes page, and
 * read when they save so the result replaces that resume instead of being added next to it.
 *
 * Kept in sessionStorage, not localStorage: it belongs to this tab's visit. Anything that puts a different resume in the builder (an import, a
 * sample, a blank resume) clears it, so a later save can never overwrite a resume the person is no longer editing.
 */
export type EditingResume = { id: string; name: string };

const KEY = "job4online-resume-editing";

export const getEditingResume = (): EditingResume | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<EditingResume>;
    return typeof value.id === "string" && typeof value.name === "string"
      ? { id: value.id, name: value.name }
      : null;
  } catch {
    return null;
  }
};

export const setEditingResume = (editing: EditingResume) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(editing));
  } catch {
    // Ignore: the person can still save, it will just be added as a new resume.
  }
};

export const clearEditingResume = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
};
