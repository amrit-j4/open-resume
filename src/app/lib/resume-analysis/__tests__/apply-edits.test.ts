import { applyEdits, bulletCount, entryCount, outlineOf, textAt } from "lib/resume-analysis/apply-edits";
import type { ResumeEdit } from "lib/resume-analysis/types";
import { RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const edit = (over: Partial<ResumeEdit>): ResumeEdit => ({ id: "e", kind: "replace", section: "summary", where: "", before: "", after: "NEW", reason: "", ...over });
const add = (over: Partial<ResumeEdit>): ResumeEdit => edit({ kind: "add", ...over });

describe("textAt", () => {
  test.each([
    [{ section: "summary" as const }, RESUME.profile.summary],
    [{ section: "workExperiences" as const, entryIndex: 0, bulletIndex: 1 }, "Led a team of 4 analysts"],
    [{ section: "workExperiences" as const, entryIndex: 1, bulletIndex: 0 }, "Automated daily route reporting in Python, saving 12 hours a week"],
    [{ section: "projects" as const, entryIndex: 0, bulletIndex: 0 }, "Public dashboard of tram delays built with SQL and Tableau"],
    [{ section: "skills" as const, bulletIndex: 0 }, "Tableau, Forecasting"],
  ])("finds the text at %j", (location, expected) => {
    expect(textAt(RESUME, location)).toBe(expected);
  });

  test.each([
    [{ section: "workExperiences" as const, entryIndex: 5, bulletIndex: 0 }],
    [{ section: "workExperiences" as const, entryIndex: 0, bulletIndex: 9 }],
    [{ section: "workExperiences" as const, bulletIndex: 0 }], // no entry given
    [{ section: "workExperiences" as const, entryIndex: 0 }], // no bullet given
    [{ section: "workExperiences" as const, entryIndex: -1, bulletIndex: 0 }],
    [{ section: "workExperiences" as const, entryIndex: 0.5, bulletIndex: 0 }],
    [{ section: "educations" as const, entryIndex: 0, bulletIndex: 0 }], // that entry has no bullets
    [{ section: "skills" as const, bulletIndex: 4 }],
    [{ section: "skills" as const }],
  ])("is undefined where nothing exists: %j", (location) => {
    expect(textAt(RESUME, location)).toBeUndefined();
  });
});

describe("bulletCount", () => {
  test("counts the bullets a place has", () => {
    expect(bulletCount(RESUME, { section: "workExperiences", entryIndex: 0 })).toBe(2);
    expect(bulletCount(RESUME, { section: "projects", entryIndex: 0 })).toBe(1);
    expect(bulletCount(RESUME, { section: "educations", entryIndex: 0 })).toBe(0);
    expect(bulletCount(RESUME, { section: "skills" })).toBe(1);
  });

  test("is undefined where there is no list to add to", () => {
    expect(bulletCount(RESUME, { section: "summary" })).toBeUndefined();
    expect(bulletCount(RESUME, { section: "workExperiences", entryIndex: 9 })).toBeUndefined();
    expect(bulletCount(RESUME, { section: "workExperiences" })).toBeUndefined();
  });
});

describe("entryCount", () => {
  test("counts the entries of the sections that have them, and nothing for the rest", () => {
    expect(entryCount(RESUME, "workExperiences")).toBe(2);
    expect(entryCount(RESUME, "educations")).toBe(1);
    expect(entryCount(RESUME, "projects")).toBe(1);
    expect(entryCount(RESUME, "summary")).toBe(0);
    expect(entryCount(RESUME, "skills")).toBe(0);
  });
});

describe("applyEdits", () => {
  test("returns an equal copy when there are no edits", () => {
    const result = applyEdits(RESUME, []);
    expect(result).toEqual(RESUME);
    expect(result).not.toBe(RESUME);
  });

  test("replaces the summary", () => {
    expect(applyEdits(RESUME, [edit({ section: "summary", after: "A new summary." })]).profile.summary).toBe("A new summary.");
  });

  test("replaces one bullet and nothing else", () => {
    const result = applyEdits(RESUME, [edit({ section: "workExperiences", entryIndex: 0, bulletIndex: 1, after: "Led four analysts" })]);

    expect(result.workExperiences[0].descriptions).toEqual([RESUME.workExperiences[0].descriptions[0], "Led four analysts"]);
    expect(result.workExperiences[1]).toEqual(RESUME.workExperiences[1]);
    expect({ ...result, workExperiences: [] }).toEqual({ ...RESUME, workExperiences: [] });
  });

  test("replaces lines in every kind of section, and never touches the extras", () => {
    const result = applyEdits(RESUME, [
      edit({ section: "educations", entryIndex: 0, bulletIndex: 0, after: "x" }), // doesn't exist: skipped
      edit({ section: "projects", entryIndex: 0, bulletIndex: 0, after: "Reworded project" }),
      edit({ section: "skills", bulletIndex: 0, after: "Reworded skills" }),
      edit({ section: "custom" as never, bulletIndex: 0, after: "Reworded extra" }), // not an editable section
    ]);

    expect(result.projects[0].descriptions).toEqual(["Reworded project"]);
    expect(result.skills.descriptions).toEqual(["Reworded skills"]);
    expect(result.custom).toEqual(RESUME.custom);
    expect(result.educations).toEqual(RESUME.educations);
  });

  test("skips an edit that points at nothing, and applies the others", () => {
    const result = applyEdits(RESUME, [
      edit({ section: "workExperiences", entryIndex: 9, bulletIndex: 0, after: "lost" }),
      edit({ section: "workExperiences", entryIndex: 0, bulletIndex: 9, after: "lost" }),
      edit({ section: "workExperiences", entryIndex: 0, bulletIndex: 0, after: "kept" }),
    ]);

    expect(result.workExperiences[0].descriptions[0]).toBe("kept");
    expect(JSON.stringify(result)).not.toContain("lost");
  });

  test("gives the same result whatever order the edits come in", () => {
    const edits = [
      edit({ id: "a", section: "workExperiences", entryIndex: 0, bulletIndex: 0, after: "one" }),
      edit({ id: "b", section: "workExperiences", entryIndex: 1, bulletIndex: 1, after: "two" }),
      edit({ id: "c", section: "summary", after: "three" }),
      edit({ id: "d", section: "skills", bulletIndex: 0, after: "four" }),
    ];
    expect(applyEdits(RESUME, [...edits].reverse())).toEqual(applyEdits(RESUME, edits));
  });

  test("never changes the resume it was given", () => {
    const before = JSON.stringify(RESUME);
    applyEdits(RESUME, [
      edit({ section: "summary", after: "x" }),
      edit({ section: "workExperiences", entryIndex: 0, bulletIndex: 0, after: "y" }),
      edit({ section: "skills", bulletIndex: 0, after: "z" }),
    ]);
    expect(JSON.stringify(RESUME)).toBe(before);
  });
});

describe("applyEdits: adding", () => {
  const bullets = (resume: typeof RESUME) => resume.workExperiences[0].descriptions;
  const [first, second] = RESUME.workExperiences[0].descriptions;

  test.each([
    [0, ["NEW", first, second]],
    [1, [first, "NEW", second]],
    [2, [first, second, "NEW"]],
  ])("an add at position %i goes there among the original bullets", (position, expected) => {
    const result = applyEdits(RESUME, [add({ section: "workExperiences", entryIndex: 0, bulletIndex: position })]);
    expect(bullets(result)).toEqual(expected);
  });

  test("an add can go into an entry that has no bullets yet", () => {
    const result = applyEdits(RESUME, [add({ section: "educations", entryIndex: 0, bulletIndex: 0, after: "Dean's List" })]);
    expect(result.educations[0].descriptions).toEqual(["Dean's List"]);
  });

  test("an add can go into the skills, and into a project", () => {
    const result = applyEdits(RESUME, [
      add({ section: "skills", bulletIndex: 1, after: "Python, SQL" }),
      add({ section: "projects", entryIndex: 0, bulletIndex: 0, after: "Open source" }),
    ]);
    expect(result.skills.descriptions).toEqual(["Tableau, Forecasting", "Python, SQL"]);
    expect(result.projects[0].descriptions).toEqual(["Open source", RESUME.projects[0].descriptions[0]]);
  });

  test("adds at the same position keep the order they were given in", () => {
    const result = applyEdits(RESUME, [
      add({ id: "a", section: "workExperiences", entryIndex: 0, bulletIndex: 1, after: "FIRST" }),
      add({ id: "b", section: "workExperiences", entryIndex: 0, bulletIndex: 1, after: "SECOND" }),
    ]);
    expect(bullets(result)).toEqual([first, "FIRST", "SECOND", second]);
  });

  test("a replace and an add are placed by the original bullets, whichever way round they are given", () => {
    const replace = edit({ section: "workExperiences", entryIndex: 0, bulletIndex: 1, after: "REWORDED" });
    const added = add({ section: "workExperiences", entryIndex: 0, bulletIndex: 1, after: "ADDED" });

    expect(bullets(applyEdits(RESUME, [replace, added]))).toEqual([first, "ADDED", "REWORDED"]);
    expect(bullets(applyEdits(RESUME, [added, replace]))).toEqual([first, "ADDED", "REWORDED"]);
  });

  test("every subset of the edits applies the same way, so each can be accepted on its own", () => {
    const edits = [
      edit({ id: "r0", section: "workExperiences", entryIndex: 0, bulletIndex: 0, after: "R0" }),
      add({ id: "a0", section: "workExperiences", entryIndex: 0, bulletIndex: 0, after: "A0" }),
      add({ id: "a2", section: "workExperiences", entryIndex: 0, bulletIndex: 2, after: "A2" }),
      edit({ id: "r1", section: "workExperiences", entryIndex: 0, bulletIndex: 1, after: "R1" }),
    ];
    const expected = (ids: string[]) => {
      const has = (id: string) => ids.includes(id);
      return [has("a0") ? "A0" : null, has("r0") ? "R0" : first, has("r1") ? "R1" : second, has("a2") ? "A2" : null].filter(Boolean);
    };

    for (let mask = 0; mask < 16; mask++) {
      const chosen = edits.filter((_, i) => mask & (1 << i));
      expect(bullets(applyEdits(RESUME, chosen))).toEqual(expected(chosen.map((e) => e.id)));
      expect(bullets(applyEdits(RESUME, [...chosen].reverse()))).toEqual(expected(chosen.map((e) => e.id)));
    }
  });

  test.each([
    ["past the end", { section: "workExperiences" as const, entryIndex: 0, bulletIndex: 3 }],
    ["an entry that doesn't exist", { section: "workExperiences" as const, entryIndex: 9, bulletIndex: 0 }],
    ["no position", { section: "workExperiences" as const, entryIndex: 0 }],
    ["a negative position", { section: "workExperiences" as const, entryIndex: 0, bulletIndex: -1 }],
    ["the summary", { section: "summary" as const, bulletIndex: 0 }],
  ])("skips an add with %s", (_name, place) => {
    expect(applyEdits(RESUME, [add({ ...place, after: "LOST" })])).toEqual(RESUME);
  });

  test("never changes the resume it was given", () => {
    const before = JSON.stringify(RESUME);
    applyEdits(RESUME, [add({ section: "workExperiences", entryIndex: 0, bulletIndex: 0 }), add({ section: "skills", bulletIndex: 0 })]);
    expect(JSON.stringify(RESUME)).toBe(before);
  });
});

describe("outlineOf", () => {
  const outline = outlineOf(RESUME);

  test("numbers every place an edit can point at, from zero", () => {
    expect(outline).toContain("[0] Brightwave Retail | Senior Data Analyst | Feb 2021 - Present");
    expect(outline).toContain("  [1] Led a team of 4 analysts");
    expect(outline).toContain("[1] Coastline Logistics | Data Analyst | Jan 2017 - Jan 2021");
    expect(outline).toContain("  [0] Automated daily route reporting in Python, saving 12 hours a week");
    expect(outline).toContain("[0] University of Melbourne | Master of Data Science | 2015 - 2016");
    expect(outline).toContain("[0] Tableau, Forecasting");
  });

  test("shows the extras as read-only context, without numbers to point at", () => {
    expect(outline).toContain("EXTRAS: certifications, awards, publications, languages and more (read-only, never edit)");
    expect(outline).toContain("- Microsoft Certified: Data Analyst Associate (2022)");
    expect(outline).not.toContain("[0] Microsoft Certified");
    expect(outline).not.toContain("section: custom");
  });

  test("names each section the way an edit does", () => {
    for (const label of ["section: workExperiences", "section: educations", "section: projects", "section: skills"]) {
      expect(outline).toContain(label);
    }
  });

  test("shows the summary, and the skills that can't be edited", () => {
    expect(outline).toContain(`SUMMARY: ${RESUME.profile.summary}`);
    expect(outline).toContain("FEATURED SKILLS (not editable): Python (5/5), SQL (5/5), Power BI (4/5)");
  });

  test("leaves out sections the resume doesn't have", () => {
    const sparse = outlineOf({ ...RESUME, educations: [], projects: [], skills: { featuredSkills: [], descriptions: [] }, custom: { descriptions: [] } });
    for (const label of ["EDUCATIONS", "PROJECTS", "FEATURED SKILLS", "SKILL LINES", "EXTRAS"]) expect(sparse).not.toContain(label);
    expect(sparse).toContain("WORK EXPERIENCES");
  });

  test("says so when there is no summary", () => {
    expect(outlineOf({ ...RESUME, profile: { ...RESUME.profile, summary: "" } })).toContain("SUMMARY: (none)");
  });
});
