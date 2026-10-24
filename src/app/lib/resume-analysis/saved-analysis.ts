import type { Resume } from "lib/redux/types";
import type { Settings } from "lib/redux/settingsSlice";
import type { ResumeAnalysisResult } from "lib/resume-analysis/types";

// The last analysis is kept in this browser so a reload, or a trip back to the form, doesn't mean paying for the same AI run again.
const STORAGE_KEY = "job4online-resume-analysis";
const VERSION = 1;
// localStorage holds about 5MB, and the file is stored as base64 (a third larger). Bigger files are left out and the analysis is still kept.
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface SavedFile {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
}

/** What the person has done with the suggestions and the resume since the analysis came back. */
export interface SavedWork {
  resume: Resume;
  states: Record<string, { status: "accepted" | "dismissed"; appliedText?: string }>;
  rewrites: unknown;
}

export interface SavedAnalysis {
  version: number;
  /** Identifies the resume and job the result is for, so the same inputs can reuse it. */
  signature: string;
  source: "upload" | "builder";
  jobInput: "text" | "link";
  jobText: string;
  jobUrl: string;
  file?: SavedFile;
  result: ResumeAnalysisResult;
  settings: Settings;
  work?: SavedWork;
}

export const analysisSignature = (parts: { source: string; resume: string; jobInput: string; job: string }) => JSON.stringify(parts);

export const fileSignature = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;

export const loadSavedAnalysis = (): SavedAnalysis | undefined => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as SavedAnalysis;
    if (saved.version !== VERSION || !saved.result?.analysis || !saved.result.resume || !saved.result.tailoredResume) return undefined;
    return saved;
  } catch {
    return undefined;
  }
};

export const saveAnalysis = (saved: SavedAnalysis) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    try {
      // Most likely out of space. The file is the big part, so keep everything else.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, file: undefined }));
    } catch {
      // Not saved. The analysis still works for this visit.
    }
  }
};

export const clearSavedAnalysis = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
};

export const readFileForSaving = (file: File): Promise<SavedFile | undefined> =>
  file.size > MAX_FILE_BYTES
    ? Promise.resolve(undefined)
    : new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? { name: file.name, type: file.type, lastModified: file.lastModified, dataUrl: reader.result } : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      });

export const restoreFile = (saved: SavedFile): File | undefined => {
  try {
    const [header, data] = saved.dataUrl.split(",");
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return new File([bytes], saved.name, { type: saved.type || header.slice(5, header.indexOf(";")), lastModified: saved.lastModified });
  } catch {
    return undefined;
  }
};
