import { applyTailoredResume, hasBackup, loadBuilderResume, resumeHasContent, restoreBackup } from "lib/redux/tailor-state";
import { initialSettings } from "lib/redux/settingsSlice";
import { RESUME } from "lib/resume-analysis/__fixtures__/analysis";
import type { Resume } from "lib/redux/types";

const STATE_KEY = "job4online-resume-state";
const BACKUP_KEY = "job4online-resume-backup";

const EMPTY: Resume = {
  profile: { name: "", email: "", phone: "", url: "", summary: "", location: "" },
  workExperiences: [],
  educations: [],
  projects: [],
  skills: { featuredSkills: [], descriptions: [] },
  custom: { descriptions: [] },
};

const stored = () => JSON.parse(localStorage.getItem(STATE_KEY)!);

beforeEach(() => localStorage.clear());

describe("resumeHasContent", () => {
  test("is false for nothing and for an empty resume", () => {
    expect(resumeHasContent(undefined)).toBe(false);
    expect(resumeHasContent(EMPTY)).toBe(false);
  });

  test.each([
    ["a name", { ...EMPTY, profile: { ...EMPTY.profile, name: "A" } }],
    ["a job", { ...EMPTY, workExperiences: RESUME.workExperiences }],
    ["a school", { ...EMPTY, educations: RESUME.educations }],
    ["a project", { ...EMPTY, projects: RESUME.projects }],
    ["a skill", { ...EMPTY, skills: { featuredSkills: RESUME.skills.featuredSkills, descriptions: [] } }],
  ])("is true for a resume with %s", (_name, resume) => {
    expect(resumeHasContent(resume)).toBe(true);
  });
});

describe("loadBuilderResume", () => {
  test("is undefined when nothing is saved", () => {
    expect(loadBuilderResume()).toBeUndefined();
  });

  test("is undefined for a saved resume with nothing in it", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: EMPTY, settings: initialSettings }));
    expect(loadBuilderResume()).toBeUndefined();
  });

  test("returns the saved resume", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings: initialSettings }));
    expect(loadBuilderResume()).toEqual(RESUME);
  });

  test("is undefined for damaged saved data", () => {
    localStorage.setItem(STATE_KEY, "{ not json");
    expect(loadBuilderResume()).toBeUndefined();
  });
});

describe("applyTailoredResume and restoreBackup", () => {
  const tailored: Resume = { ...RESUME, profile: { ...RESUME.profile, summary: "Reworded summary." } };

  test("saves the tailored resume and keeps the person's settings", () => {
    const settings = { ...initialSettings, themeColor: "#123456", template: "elegant" as never };
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings }));

    applyTailoredResume(tailored);

    expect(stored().resume.profile.summary).toBe("Reworded summary.");
    expect(stored().settings.themeColor).toBe("#123456");
    expect(stored().settings.template).toBe("elegant");
  });

  test("backs up what was there, and restoring puts it back exactly", () => {
    const before = { resume: RESUME, settings: { ...initialSettings, themeColor: "#123456" } };
    localStorage.setItem(STATE_KEY, JSON.stringify(before));
    expect(hasBackup()).toBe(false);

    applyTailoredResume(tailored);
    expect(hasBackup()).toBe(true);
    expect(stored().resume.profile.summary).toBe("Reworded summary.");

    expect(restoreBackup()).toBe(true);
    expect(stored()).toEqual(before);
    expect(hasBackup()).toBe(false);
  });

  test("switches on sections that now have content, and switches none off", () => {
    const settings = { ...initialSettings, formToShow: { workExperiences: false, educations: true, projects: false, skills: true, custom: false } };
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings }));

    applyTailoredResume({ ...tailored, educations: [], projects: [] });

    expect(stored().settings.formToShow).toEqual({
      workExperiences: true, // has content, so it is switched on
      educations: true, // empty now, but it was on and stays on
      projects: false,
      skills: true,
      custom: true, // the fixture has an extras line
    });
  });

  test("works when the builder has nothing saved yet: default settings and no backup", () => {
    applyTailoredResume(tailored);

    expect(stored().resume).toEqual(tailored);
    expect(stored().settings.template).toBe(initialSettings.template);
    expect(hasBackup()).toBe(false);
    expect(restoreBackup()).toBe(false);
  });

  test("applying twice keeps the backup from before the latest apply", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings: initialSettings }));
    const second: Resume = { ...tailored, profile: { ...tailored.profile, summary: "Second." } };

    applyTailoredResume(tailored);
    applyTailoredResume(second);
    restoreBackup();

    expect(stored().resume.profile.summary).toBe("Reworded summary.");
  });

  test("does not touch the resume it was given", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings: initialSettings }));
    const copy = JSON.stringify(tailored);
    applyTailoredResume(tailored);
    expect(JSON.stringify(tailored)).toBe(copy);
  });

  test("restoreBackup answers false for a damaged backup, and leaves the saved state alone", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings: initialSettings }));
    localStorage.setItem(BACKUP_KEY, "{ not json");

    expect(restoreBackup()).toBe(false);
    expect(stored().resume).toEqual(RESUME);
  });
});
