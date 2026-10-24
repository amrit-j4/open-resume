import { applyEdits } from "lib/resume-analysis/apply-edits";
import {
  applySuggestion,
  applyUpdate,
  buildSuggestions,
  forgetRewrite,
  locate,
  undoSuggestion,
  type Rewrites,
  type Suggestion,
} from "lib/resume-analysis/suggestions";
import type { ResumeEdit } from "lib/resume-analysis/types";
import type { Resume } from "lib/redux/types";
import { RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const [LED, FORECAST] = [RESUME.workExperiences[0].descriptions[1], RESUME.workExperiences[0].descriptions[0]];

const edit = (over: Partial<ResumeEdit>): ResumeEdit => ({ id: "e", kind: "replace", section: "summary", where: "", before: "", after: "NEW", reason: "", ...over });

const reword = (over: Partial<ResumeEdit> = {}) =>
  edit({ id: "reword", section: "workExperiences", entryIndex: 0, bulletIndex: 1, before: LED, after: "Led and mentored a team of 4 analysts", ...over });
const addLast = (over: Partial<ResumeEdit> = {}) =>
  edit({ id: "add", kind: "add", section: "workExperiences", entryIndex: 0, bulletIndex: 2, before: "", after: "Mentored junior analysts", basedOn: "x", ...over });
const addFirst = (over: Partial<ResumeEdit> = {}) => addLast({ id: "first", bulletIndex: 0, after: "Owned the forecasting roadmap", ...over });
const summary = (over: Partial<ResumeEdit> = {}) => edit({ id: "summary", section: "summary", before: RESUME.profile.summary, after: "A sharper summary.", ...over });
const skillsAdd = (over: Partial<ResumeEdit> = {}) => addLast({ id: "skills", section: "skills", entryIndex: undefined, bulletIndex: 1, after: "Python, SQL", ...over });

const build = (...edits: ResumeEdit[]): Suggestion[] => buildSuggestions(RESUME, edits);
const swapJobs = (resume: Resume): Resume => ({ ...resume, workExperiences: [resume.workExperiences[1], resume.workExperiences[0]] });
const withBullets = (resume: Resume, entry: number, bullets: string[]): Resume => ({
  ...resume,
  workExperiences: resume.workExperiences.map((w, i) => (i === entry ? { ...w, descriptions: bullets } : w)),
});

describe("buildSuggestions", () => {
  test("records the entry an edit was in, and for an add the line it goes after", () => {
    const [r, a, first, s, k] = build(reword(), addLast(), addFirst(), summary(), skillsAdd());

    expect(r.entryKey).toBeTruthy();
    expect(r.anchorText).toBeUndefined();
    expect(a.entryKey).toBe(r.entryKey);
    expect(a.anchorText).toBe(LED); // position 2 follows the second bullet
    expect(first.anchorText).toBeUndefined(); // position 0 goes first
    expect(s.entryKey).toBeUndefined();
    expect(k.anchorText).toBe("Tableau, Forecasting");
  });

  test("gives different entries different keys, and keeps the edits as they were", () => {
    const edits = [reword(), reword({ id: "other", entryIndex: 1, bulletIndex: 0, before: RESUME.workExperiences[1].descriptions[0] })];
    const [a, b] = build(...edits);
    expect(a.entryKey).not.toBe(b.entryKey);
    expect(a.edit).toBe(edits[0]);
  });

  test("copes with an entry that doesn't exist", () => {
    const [s] = build(reword({ entryIndex: 9 }));
    expect(s.entryKey).toBeUndefined();
  });
});

describe("locate", () => {
  test("the summary is always found", () => {
    const [s] = build(summary());
    expect(locate(RESUME, s, {})).toEqual({ kind: "summary" });
    expect(locate({ ...RESUME, profile: { ...RESUME.profile, summary: "Rewritten by hand" } }, s, {})).toEqual({ kind: "summary" });
  });

  test("finds a reword by the text it replaces", () => {
    const [s] = build(reword());
    expect(locate(RESUME, s, {})).toEqual({ kind: "replace", section: "workExperiences", entryIndex: 0, bulletIndex: 1 });
  });

  test("still finds it when lines were added, removed or moved", () => {
    const [s] = build(reword());
    expect(locate(withBullets(RESUME, 0, ["Brand new line", ...RESUME.workExperiences[0].descriptions]), s, {})).toMatchObject({ bulletIndex: 2 });
    expect(locate(withBullets(RESUME, 0, [LED, FORECAST]), s, {})).toMatchObject({ bulletIndex: 0 });
    expect(locate(withBullets(RESUME, 0, [LED]), s, {})).toMatchObject({ bulletIndex: 0 });
  });

  test("ignores capitals, spaces and punctuation when matching", () => {
    const [s] = build(reword());
    expect(locate(withBullets(RESUME, 0, [FORECAST, `  ${LED.toUpperCase()}.  `]), s, {})).toMatchObject({ bulletIndex: 1 });
  });

  test("follows an entry that was moved, by its header", () => {
    const [s] = build(reword());
    expect(locate(swapJobs(RESUME), s, {})).toMatchObject({ entryIndex: 1, bulletIndex: 1 });
  });

  test("falls back to the same entry number when its header was edited", () => {
    const [s] = build(reword());
    const renamed = { ...RESUME, workExperiences: RESUME.workExperiences.map((w, i) => (i === 0 ? { ...w, company: "Brightwave Retail Group" } : w)) };
    expect(locate(renamed, s, {})).toMatchObject({ entryIndex: 0, bulletIndex: 1 });
  });

  test.each([
    ["the line was reworded by hand", (r: Resume) => withBullets(r, 0, [FORECAST, "Led a different team"])],
    ["the line was removed", (r: Resume) => withBullets(r, 0, [FORECAST])],
    ["the entry was deleted", (r: Resume) => ({ ...r, workExperiences: [r.workExperiences[1]] })],
    ["every entry was deleted", (r: Resume) => ({ ...r, workExperiences: [] })],
  ])("is null when %s", (_name, change) => {
    const [s] = build(reword());
    expect(locate(change(RESUME), s, {})).toBeNull();
  });

  test("is null for a reword that is already in place", () => {
    const [s] = build(reword());
    expect(locate(withBullets(RESUME, 0, [FORECAST, "Led and mentored a team of 4 analysts"]), s, {})).toBeNull();
  });

  describe("an add", () => {
    test("goes after the line it followed, wherever that line is now", () => {
      const [s] = build(addLast());
      expect(locate(RESUME, s, {})).toEqual({ kind: "add", section: "workExperiences", entryIndex: 0, insertAt: 2 });
      expect(locate(withBullets(RESUME, 0, ["New first line", ...RESUME.workExperiences[0].descriptions]), s, {})).toMatchObject({ insertAt: 3 });
      expect(locate(withBullets(RESUME, 0, [LED, FORECAST]), s, {})).toMatchObject({ insertAt: 1 });
    });

    test("goes first when it went first", () => {
      const [s] = build(addFirst());
      expect(locate(withBullets(RESUME, 0, ["x", "y", "z"]), s, {})).toMatchObject({ insertAt: 0 });
    });

    test("still finds its line after that line was reworded by an accepted suggestion", () => {
      const [s] = build(addLast());
      const reworded = withBullets(RESUME, 0, [FORECAST, "Led and mentored a team of 4 analysts"]);
      const rewrites: Rewrites = { [LED.toLowerCase().replace(/[^a-z0-9]/g, "")]: ["ledandmentoredateamof4analysts"] };

      expect(locate(reworded, s, rewrites)).toMatchObject({ insertAt: 2 });
      // Without that knowledge it falls back to the position it had, which is the same place here.
      expect(locate(reworded, s, {})).toMatchObject({ insertAt: 2 });
    });

    test("falls back to its original position, kept within the list, when its line is gone", () => {
      const [s] = build(addLast());
      expect(locate(withBullets(RESUME, 0, ["Only line"]), s, {})).toMatchObject({ insertAt: 1 });
      expect(locate(withBullets(RESUME, 0, []), s, {})).toMatchObject({ insertAt: 0 });
    });

    test("goes into an entry that has no bullets yet", () => {
      const [s] = build(addFirst({ section: "educations", entryIndex: 0 }));
      expect(locate(RESUME, s, {})).toEqual({ kind: "add", section: "educations", entryIndex: 0, insertAt: 0 });
    });

    test("goes into the skills", () => {
      const [s] = build(skillsAdd());
      expect(locate(RESUME, s, {})).toEqual({ kind: "add", section: "skills", entryIndex: undefined, insertAt: 1 });
    });

    test("is null when its entry was deleted", () => {
      const [s] = build(addLast());
      expect(locate({ ...RESUME, workExperiences: [] }, s, {})).toBeNull();
    });
  });
});

describe("applySuggestion", () => {
  test("rewords the summary", () => {
    const [s] = build(summary());
    const applied = applySuggestion(RESUME, s, "Edited before accepting", {})!;
    expect(applied.update).toEqual({ kind: "summary", value: "Edited before accepting" });
    expect(applyUpdate(RESUME, applied.update).profile.summary).toBe("Edited before accepting");
  });

  test("rewords one bullet with the text given, which can differ from the suggestion", () => {
    const [s] = build(reword());
    const applied = applySuggestion(RESUME, s, "My own wording", {})!;
    expect(applyUpdate(RESUME, applied.update).workExperiences[0].descriptions).toEqual([FORECAST, "My own wording"]);
  });

  test("adds a bullet at its place", () => {
    const [s] = build(addFirst());
    const applied = applySuggestion(RESUME, s, "Owned the forecasting roadmap", {})!;
    expect(applyUpdate(RESUME, applied.update).workExperiences[0].descriptions).toEqual(["Owned the forecasting roadmap", FORECAST, LED]);
  });

  test("adds a skills line", () => {
    const [s] = build(skillsAdd());
    const applied = applySuggestion(RESUME, s, "Python, SQL", {})!;
    expect(applyUpdate(RESUME, applied.update).skills.descriptions).toEqual(["Tableau, Forecasting", "Python, SQL"]);
  });

  test("remembers a reword, and nothing for an add or the summary", () => {
    const [r, a, s] = build(reword(), addLast(), summary());
    const key = LED.toLowerCase().replace(/[^a-z0-9]/g, "");
    expect(applySuggestion(RESUME, r, "Led and mentored a team of 4 analysts", {})!.rewrites).toEqual({ [key]: ["ledandmentoredateamof4analysts"] });
    expect(applySuggestion(RESUME, a, "x", {})!.rewrites).toEqual({});
    expect(applySuggestion(RESUME, s, "x", {})!.rewrites).toEqual({});
  });

  test("is null when the suggestion no longer applies", () => {
    const [s] = build(reword());
    expect(applySuggestion(withBullets(RESUME, 0, [FORECAST]), s, "x", {})).toBeNull();
  });

  test("never changes the resume or the rewrites it is given", () => {
    const before = JSON.stringify(RESUME);
    const rewrites: Rewrites = {};
    const [r] = build(reword());
    const applied = applySuggestion(RESUME, r, "x", rewrites)!;
    applyUpdate(RESUME, applied.update);
    expect(JSON.stringify(RESUME)).toBe(before);
    expect(rewrites).toEqual({});
  });
});

describe("undoSuggestion", () => {
  test("puts a reworded summary back", () => {
    const [s] = build(summary());
    const accepted = applyUpdate(RESUME, applySuggestion(RESUME, s, "A sharper summary.", {})!.update);
    const undone = undoSuggestion(accepted, s, "A sharper summary.")!;
    expect(applyUpdate(accepted, undone).profile.summary).toBe(RESUME.profile.summary);
  });

  test("puts a reworded bullet back to its original wording", () => {
    const [s] = build(reword());
    const accepted = applyUpdate(RESUME, applySuggestion(RESUME, s, "Led and mentored a team of 4 analysts", {})!.update);
    expect(applyUpdate(accepted, undoSuggestion(accepted, s, "Led and mentored a team of 4 analysts")!)).toEqual(RESUME);
  });

  test("takes an added bullet out again, and leaves everything else", () => {
    const [s] = build(addFirst());
    const accepted = applyUpdate(RESUME, applySuggestion(RESUME, s, "Owned the forecasting roadmap", {})!.update);
    expect(accepted.workExperiences[0].descriptions).toHaveLength(3);
    expect(applyUpdate(accepted, undoSuggestion(accepted, s, "Owned the forecasting roadmap")!)).toEqual(RESUME);
  });

  test("works after the person has changed other things since", () => {
    const [s] = build(reword());
    const accepted = applyUpdate(RESUME, applySuggestion(RESUME, s, "Led and mentored a team of 4 analysts", {})!.update);
    const later = swapJobs(withBullets(accepted, 0, ["Typed by hand", ...accepted.workExperiences[0].descriptions]));

    const undone = applyUpdate(later, undoSuggestion(later, s, "Led and mentored a team of 4 analysts")!);

    expect(undone.workExperiences[1].descriptions).toEqual(["Typed by hand", FORECAST, LED]);
  });

  test("is null when the text that was put in has since been changed by hand", () => {
    const [s] = build(reword());
    const accepted = applyUpdate(RESUME, applySuggestion(RESUME, s, "Led and mentored a team of 4 analysts", {})!.update);
    expect(undoSuggestion(withBullets(accepted, 0, [FORECAST, "Rewritten again"]), s, "Led and mentored a team of 4 analysts")).toBeNull();
    expect(undoSuggestion({ ...accepted, profile: { ...accepted.profile, summary: "changed" } }, build(summary())[0], "A sharper summary.")).toBeNull();
  });

  test("undoes a skills add", () => {
    const [s] = build(skillsAdd());
    const accepted = applyUpdate(RESUME, applySuggestion(RESUME, s, "Python, SQL", {})!.update);
    expect(applyUpdate(accepted, undoSuggestion(accepted, s, "Python, SQL")!)).toEqual(RESUME);
  });
});

describe("forgetRewrite", () => {
  test("removes one recorded reword and drops an empty entry", () => {
    const [s] = build(reword());
    const key = LED.toLowerCase().replace(/[^a-z0-9]/g, "");
    expect(forgetRewrite({ [key]: ["ab", "cd"] }, s, "ab")).toEqual({ [key]: ["cd"] });
    expect(forgetRewrite({ [key]: ["ab"] }, s, "AB.")).toEqual({});
    expect(forgetRewrite({}, s, "ab")).toEqual({});
  });
});

describe("accepting suggestions one at a time", () => {
  /** Accepts the suggestions in the given order, the way the page does, and returns the resume that results. */
  const acceptInOrder = (suggestions: Suggestion[], order: number[]): Resume => {
    let resume = RESUME;
    let rewrites: Rewrites = {};
    for (const i of order) {
      const applied = applySuggestion(resume, suggestions[i], suggestions[i].edit.after, rewrites);
      expect(applied).not.toBeNull();
      resume = applyUpdate(resume, applied!.update);
      rewrites = applied!.rewrites;
    }
    return resume;
  };

  const permutations = (n: number): number[][] =>
    n <= 1 ? [Array.from({ length: n }, (_, i) => i)] : permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, at) => [...p.slice(0, at), n - 1, ...p.slice(at)]));

  test("gives the same resume as applying them all at once, whatever order they are accepted in", () => {
    const edits = [
      reword(),
      reword({ id: "reword0", bulletIndex: 0, before: FORECAST, after: "Built and shipped a demand forecasting model" }),
      addFirst(),
      addLast(),
      summary(),
      skillsAdd(),
    ];
    const suggestions = buildSuggestions(RESUME, edits);
    const expected = applyEdits(RESUME, edits);

    const orders = permutations(edits.length);
    expect(orders).toHaveLength(720);
    for (const order of orders) {
      expect(acceptInOrder(suggestions, order)).toEqual(expected);
    }
  });

  test("two adds at the same position come out in the order they were accepted", () => {
    const edits = [addLast({ id: "one", after: "First addition" }), addLast({ id: "two", after: "Second addition" })];
    const suggestions = buildSuggestions(RESUME, edits);

    const forward = acceptInOrder(suggestions, [0, 1]).workExperiences[0].descriptions;
    const backward = acceptInOrder(suggestions, [1, 0]).workExperiences[0].descriptions;

    expect(forward.slice(2).sort()).toEqual(["First addition", "Second addition"]);
    expect(backward.slice(2).sort()).toEqual(["First addition", "Second addition"]);
    expect(forward.slice(0, 2)).toEqual(RESUME.workExperiences[0].descriptions);
  });
});
