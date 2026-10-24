import { normalizeEdits } from "lib/resume-analysis/normalize-edits";
import { RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const bullet = (over: Record<string, unknown> = {}) => ({
  section: "workExperiences",
  entry: 0,
  bullet: 1,
  after: "Led a team of 4 analysts, mentoring juniors",
  reason: "Shows leadership",
  ...over,
});

describe("normalizeEdits", () => {
  test("turns a good suggestion into an edit that points at the right place", () => {
    const [edit] = normalizeEdits([bullet()], RESUME);

    expect(edit).toEqual({
      id: "edit-1",
      kind: "replace",
      section: "workExperiences",
      entryIndex: 0,
      bulletIndex: 1,
      where: "Brightwave Retail",
      before: "Led a team of 4 analysts",
      after: "Led a team of 4 analysts, mentoring juniors",
      reason: "Shows leadership",
    });
  });

  test("takes the before text from the resume, never from the model", () => {
    const [edit] = normalizeEdits([bullet({ before: "Led a team of 4 analysts", reason: "r" })], RESUME);
    expect(edit.before).toBe(RESUME.workExperiences[0].descriptions[1]);
  });

  test("handles a summary, which has no entry or bullet", () => {
    const [edit] = normalizeEdits([{ section: "summary", after: "Data analyst who builds forecasting models.", reason: "r", entry: 3, bullet: 4 }], RESUME);

    expect(edit).toMatchObject({ section: "summary", where: "Summary", before: RESUME.profile.summary, after: "Data analyst who builds forecasting models." });
    expect(edit).not.toHaveProperty("entryIndex");
    expect(edit).not.toHaveProperty("bulletIndex");
  });

  test("allows a summary to be written when the resume had none", () => {
    const noSummary = { ...RESUME, profile: { ...RESUME.profile, summary: "" } };
    const [edit] = normalizeEdits([{ section: "summary", after: "Data analyst in retail and logistics.", reason: "r" }], noSummary);
    expect(edit.before).toBe("");
  });

  test("labels each section by what it points at", () => {
    const edits = normalizeEdits(
      [
        bullet({ entry: 1, bullet: 0, after: "Automated daily route reporting in Python" }),
        { section: "projects", entry: 0, bullet: 0, after: "Public dashboard of tram delays built with SQL", reason: "r" },
        { section: "skills", bullet: 0, after: "Forecasting, Tableau", reason: "r" },
      ],
      RESUME
    );
    expect(edits.map((e) => e.where)).toEqual(["Coastline Logistics", "Open Transport Tracker", "Skills"]);
    expect(edits.map((e) => e.id)).toEqual(["edit-1", "edit-2", "edit-3"]);
  });

  test("accepts section names in any case, and numbers sent as strings", () => {
    const [edit] = normalizeEdits([bullet({ section: "WorkExperiences", entry: "0", bullet: "1" })], RESUME);
    expect(edit).toMatchObject({ section: "workExperiences", entryIndex: 0, bulletIndex: 1 });
  });

  test("accepts entryIndex and bulletIndex as well as entry and bullet", () => {
    const [edit] = normalizeEdits([{ section: "workExperiences", entryIndex: 1, bulletIndex: 1, after: "Built Power BI dashboards for 60 depot managers", reason: "r" }], RESUME);
    expect(edit).toMatchObject({ entryIndex: 1, bulletIndex: 1 });
  });

  describe("pointing at the wrong place", () => {
    test.each([
      ["an entry that doesn't exist", { entry: 9 }],
      ["a bullet that doesn't exist", { bullet: 9 }],
      ["no entry", { entry: undefined }],
      ["no bullet", { bullet: undefined }],
      ["a negative number", { bullet: -1 }],
      ["a fraction", { entry: 0.5 }],
      ["text instead of a number", { bullet: "second" }],
    ])("drops an edit with %s", (_name, over) => {
      expect(normalizeEdits([bullet(over)], RESUME)).toEqual([]);
    });

    test("finds the right place by the text the model quoted when its numbers are wrong", () => {
      const [edit] = normalizeEdits([bullet({ entry: 1, bullet: 0, before: "Led a team of 4 analysts" })], RESUME);
      expect(edit).toMatchObject({ entryIndex: 0, bulletIndex: 1, before: "Led a team of 4 analysts" });
    });

    test("finds it even when the numbers point at nothing", () => {
      const [edit] = normalizeEdits([bullet({ entry: 7, bullet: 7, before: "led a team of 4 analysts." })], RESUME);
      expect(edit).toMatchObject({ entryIndex: 0, bulletIndex: 1 });
    });

    test("trusts the numbers when the quoted text matches them", () => {
      const [edit] = normalizeEdits([bullet({ before: "Led a team of 4 analysts" })], RESUME);
      expect(edit).toMatchObject({ entryIndex: 0, bulletIndex: 1 });
    });

    test("drops the edit when the quoted text can't be found, rather than guessing", () => {
      expect(normalizeEdits([bullet({ entry: 1, bullet: 0, before: "Something the resume never said", after: "Led 4 analysts well" })], RESUME)).toEqual([]);
    });

    test("does not guess when the quoted text appears in more than one place", () => {
      const twice = { ...RESUME, workExperiences: RESUME.workExperiences.map((w) => ({ ...w, descriptions: ["Same bullet", ...w.descriptions] })) };
      expect(normalizeEdits([bullet({ entry: 9, bullet: 9, before: "Same bullet", after: "Same bullet, reworded" })], twice)).toEqual([]);
    });
  });

  describe("what an edit may not do", () => {
    test.each([
      ["an unknown section", { section: "hobbies" }],
      ["no section", { section: undefined }],
      ["a section that can't be edited", { section: "profile" }],
      ["the extras, which are facts and not wording", { section: "custom", entry: undefined, bullet: 0, after: "Microsoft Certified: Data Analyst Expert (2022)" }],
      ["no new text", { after: "" }],
      ["only spaces", { after: "   " }],
      ["text that isn't text", { after: 5 }],
      ["the same text", { after: "Led a team of 4 analysts" }],
      ["a change of only punctuation", { after: "Led a team of 4 analysts." }],
      ["a change of only capitals", { after: "LED A TEAM OF 4 ANALYSTS" }],
    ])("drops an edit with %s", (_name, over) => {
      expect(normalizeEdits([bullet(over)], RESUME)).toEqual([]);
    });

    test("drops an edit that brings in a number the resume doesn't have", () => {
      expect(normalizeEdits([bullet({ after: "Led a team of 40 analysts" })], RESUME)).toEqual([]);
      expect(normalizeEdits([bullet({ after: "Grew revenue by 300%" })], RESUME)).toEqual([]);
    });

    test("does not mistake part of a longer number for one in the resume", () => {
      expect(normalizeEdits([{ section: "summary", after: "Data analyst with 15 years of experience", reason: "r" }], RESUME)).toEqual([]);
    });

    test("keeps an edit whose figures all come from its own entry", () => {
      expect(normalizeEdits([bullet({ after: "Led 4 analysts since 2021, cutting stock-outs by 18%" })], RESUME)).toHaveLength(1);
    });

    test("drops an edit that moves a figure from one job onto another", () => {
      // 12 hours was saved at Coastline Logistics (entry 1), not at Brightwave Retail (entry 0).
      expect(normalizeEdits([bullet({ after: "Led 4 analysts, saving 12 hours a week" })], RESUME)).toEqual([]);
      // ...but it is fine on the entry it belongs to.
      expect(normalizeEdits([bullet({ entry: 1, bullet: 0, after: "Automated daily route reporting in Python, saving 12 hours every week" })], RESUME)).toHaveLength(1);
    });

    test("lets the summary use any figure the resume has, but no others", () => {
      expect(normalizeEdits([{ section: "summary", after: "Data analyst who led 4 analysts and saved 12 hours a week", reason: "r" }], RESUME)).toHaveLength(1);
      expect(normalizeEdits([{ section: "summary", after: "Data analyst with 15 years of experience", reason: "r" }], RESUME)).toEqual([]);
    });

    test("gives a skills line no figures of its own", () => {
      expect(normalizeEdits([{ section: "skills", bullet: 0, after: "Tableau, Forecasting 4", reason: "r" }], RESUME)).toEqual([]);
    });

    test("drops a skills line that adds a skill the resume has no evidence of", () => {
      expect(normalizeEdits([{ section: "skills", bullet: 0, after: "Tableau, Forecasting, Snowflake, dbt", reason: "r" }], RESUME)).toEqual([]);
    });

    test("never lets a certification, award or publication be reworded", () => {
      for (const after of ["AWS Certified Solutions Architect", "Microsoft Certified: Data Analyst Expert (2022)", "Microsoft Certified"]) {
        expect(normalizeEdits([{ section: "custom", bullet: 0, after, reason: "r" }], RESUME)).toEqual([]);
      }
    });

    test("keeps a skills line that only rearranges what is there", () => {
      const [edit] = normalizeEdits([{ section: "skills", bullet: 0, after: "Forecasting, Tableau, Python", reason: "r" }], RESUME);
      expect(edit.after).toBe("Forecasting, Tableau, Python");
    });
  });

  describe("the list as a whole", () => {
    test("keeps only the first edit for any one place", () => {
      const edits = normalizeEdits([bullet({ after: "First wording of it, with 4 people" }), bullet({ after: "Second wording of it, with 4 people" })], RESUME);
      expect(edits).toHaveLength(1);
      expect(edits[0].after).toMatch(/^First/);
    });

    test("skips bad entries and numbers the good ones in order", () => {
      const edits = normalizeEdits([bullet({ section: "nope" }), bullet({ entry: 0, bullet: 0, after: "Built a demand forecasting model that cut stock-outs by 18%, reducing waste" }), bullet()], RESUME);
      expect(edits.map((e) => [e.id, e.bulletIndex])).toEqual([
        ["edit-1", 0],
        ["edit-2", 1],
      ]);
    });

    test("allows at most 20 edits", () => {
      const many = { ...RESUME, workExperiences: [{ ...RESUME.workExperiences[0], descriptions: Array.from({ length: 30 }, (_, i) => `Bullet number ${i}`) }] };
      const raw = many.workExperiences[0].descriptions.map((_, i) => bullet({ bullet: i, after: `Reworded bullet number ${i}` }));
      // "number 5" etc. are numbers in the original, but the reworded text brings none that aren't.
      expect(normalizeEdits(raw, many)).toHaveLength(20);
    });

    test("trims and bounds the text", () => {
      const [edit] = normalizeEdits([bullet({ after: `  ${"x".repeat(2000)}  `, reason: "r".repeat(2000) })], RESUME);
      expect(edit.after).toHaveLength(800);
      expect(edit.reason).toHaveLength(400);
    });

    test.each([null, undefined, "text", 3, {}, [], [null, "x", 5, []]])("returns nothing for %p", (raw) => {
      expect(normalizeEdits(raw, RESUME)).toEqual([]);
    });
  });

  describe("adding", () => {
    const add = (over: Record<string, unknown> = {}) => ({
      action: "add",
      section: "workExperiences",
      entry: 0,
      position: 2,
      after: "Mentored junior analysts on forecasting",
      reason: "The job wants mentoring",
      basedOn: 'The summary says "mentors analysts"',
      ...over,
    });
    // The fixture says "Led a team of 4 analysts" and "forecasting", but never "mentored".
    const base = { ...RESUME, profile: { ...RESUME.profile, summary: "Data analyst who mentored junior analysts on forecasting." } };

    test("turns a good add into an edit with its position and where it comes from", () => {
      const [edit] = normalizeEdits([add()], base);

      expect(edit).toEqual({
        id: "edit-1",
        kind: "add",
        section: "workExperiences",
        entryIndex: 0,
        bulletIndex: 2,
        where: "Brightwave Retail",
        before: "",
        after: "Mentored junior analysts on forecasting",
        reason: "The job wants mentoring",
        basedOn: 'The summary says "mentors analysts"',
      });
    });

    test("accepts the action under the name kind, in any case", () => {
      expect(normalizeEdits([add({ action: undefined, kind: "ADD" })], base)).toHaveLength(1);
    });

    test("can go first, last, or into an entry with no bullets", () => {
      expect(normalizeEdits([add({ position: 0 })], base)).toHaveLength(1);
      expect(normalizeEdits([add({ position: 2 })], base)).toHaveLength(1);
      expect(normalizeEdits([add({ section: "educations", entry: 0, position: 0, after: "Master of Data Science in forecasting" })], base)).toHaveLength(1);
    });

    test("can add a skills line made only of skills the resume already shows", () => {
      const [edit] = normalizeEdits([add({ section: "skills", entry: undefined, position: 1, after: "Python, SQL, Power BI" })], RESUME);
      expect(edit).toMatchObject({ kind: "add", section: "skills", bulletIndex: 1, where: "Skills" });
      expect(edit).not.toHaveProperty("entryIndex");
    });

    test.each([
      ["the summary", { section: "summary" }],
      ["the extras", { section: "custom" }],
      ["an entry that doesn't exist", { entry: 9 }],
      ["no entry", { entry: undefined }],
      ["no position", { position: undefined }],
      ["a position past the end", { position: 3 }],
      ["a negative position", { position: -1 }],
      ["a fractional position", { position: 0.5 }],
      ["no text", { after: "" }],
      ["no source", { basedOn: undefined }],
      ["a blank source", { basedOn: "   " }],
    ])("drops an add to %s", (_name, over) => {
      expect(normalizeEdits([add(over)], base)).toEqual([]);
    });

    test("drops an add that brings in a figure that isn't its entry's own", () => {
      expect(normalizeEdits([add({ after: "Mentored 12 junior analysts on forecasting" })], base)).toEqual([]); // 12 belongs to the other job
      expect(normalizeEdits([add({ after: "Mentored junior analysts for 15 years" })], base)).toEqual([]); // not in the resume at all
    });

    test("allows an add to use a figure from its own entry", () => {
      expect(normalizeEdits([add({ after: "Mentored junior analysts on forecasting in a team of 4 analysts" })], base)).toHaveLength(1);
    });

    test("drops an add that uses a word the resume never uses, so it can't bring in a new tool or skill", () => {
      expect(normalizeEdits([add({ after: "Mentored junior analysts on Snowflake" })], base)).toEqual([]);
      expect(normalizeEdits([add({ after: "Mentored junior analysts using Kubernetes" })], base)).toEqual([]);
      expect(normalizeEdits([add({ section: "skills", entry: undefined, position: 1, after: "Python, SQL, dbt" })], RESUME)).toEqual([]);
    });

    test("drops an add that repeats a bullet the resume already has", () => {
      expect(normalizeEdits([add({ after: "Led a team of 4 analysts" })], base)).toEqual([]);
      expect(normalizeEdits([add({ after: "led a team of 4 analysts." })], base)).toEqual([]);
    });

    test("drops a second add of the same text to the same entry, but allows it somewhere else", () => {
      const twice = normalizeEdits([add(), add({ position: 0 })], base);
      expect(twice).toHaveLength(1);

      const elsewhere = normalizeEdits([add(), add({ entry: 1, position: 0, after: "Mentored junior analysts on forecasting" })], base);
      expect(elsewhere).toHaveLength(2);
    });

    test("allows two different adds at the same position", () => {
      const edits = normalizeEdits([add({ after: "Mentored junior analysts" }), add({ after: "Mentored analysts on forecasting" })], base);
      expect(edits.map((e) => e.after)).toEqual(["Mentored junior analysts", "Mentored analysts on forecasting"]);
    });

    test("allows at most 6 adds, and still lets rewords through after them", () => {
      const many = Array.from({ length: 10 }, (_, i) => add({ position: 0, after: `Mentored analysts on forecasting ${"junior ".repeat(i + 1)}`.trim() }));
      const edits = normalizeEdits([...many, bullet()], base);
      expect(edits.filter((e) => e.kind === "add")).toHaveLength(6);
      expect(edits.filter((e) => e.kind === "replace")).toHaveLength(1);
    });

    test("trims the text and the source", () => {
      const [edit] = normalizeEdits([add({ after: `  ${"mentored ".repeat(300)}  `, basedOn: `  ${"x".repeat(1000)}  ` })], base);
      expect(edit.after.length).toBeLessThanOrEqual(800);
      expect(edit.basedOn).toHaveLength(300);
    });

    test("numbers adds and rewords together, in order", () => {
      const edits = normalizeEdits([bullet(), add(), bullet({ bullet: 0, after: "Built a demand forecasting model that cut stock-outs by 18%, reducing waste" })], base);
      expect(edits.map((e) => [e.id, e.kind])).toEqual([
        ["edit-1", "replace"],
        ["edit-2", "add"],
        ["edit-3", "replace"],
      ]);
    });
  });
});
