import { normalizeAnalysis } from "lib/resume-analysis/normalize-analysis";

describe("normalizeAnalysis", () => {
  test("returns an empty analysis for anything that is not an object", () => {
    for (const input of [null, undefined, "x", 3, [], true]) {
      expect(normalizeAnalysis(input)).toEqual({
        matchScore: 0,
        verdict: "",
        job: { title: "", company: "" },
        matchedKeywords: [],
        missingKeywords: [],
        strengths: [],
        gaps: [],
        changes: [],
      });
    }
  });

  test("keeps well formed data and trims text", () => {
    const analysis = normalizeAnalysis({
      job: { title: " Senior Data Analyst ", company: "Northern Lights" },
      matchScore: 78,
      verdict: " Strong fit. ",
      matchedKeywords: ["Python", "SQL"],
      missingKeywords: [{ keyword: "dbt", importance: "high", advice: "Mention it if you have used it." }],
      strengths: ["Forecasting"],
      gaps: ["No Snowflake"],
      changes: [{ section: "summary", where: "Summary", before: "Old", after: "New", reason: "Matches the job" }],
    });

    expect(analysis).toEqual({
      matchScore: 78,
      verdict: "Strong fit.",
      job: { title: "Senior Data Analyst", company: "Northern Lights" },
      matchedKeywords: ["Python", "SQL"],
      missingKeywords: [{ keyword: "dbt", importance: "high", advice: "Mention it if you have used it." }],
      strengths: ["Forecasting"],
      gaps: ["No Snowflake"],
      changes: [{ section: "summary", where: "Summary", before: "Old", after: "New", reason: "Matches the job" }],
    });
  });

  describe("matchScore", () => {
    test.each([
      [78, 78],
      [78.6, 79],
      ["82", 82],
      ["82.4", 82],
      [0.82, 82], // a fraction is read as a percentage
      [1, 1], // a whole 1 is a score of 1, not 100%
      [0, 0],
      [100, 100],
      [250, 100],
      [-5, 0],
      ["high", 0],
      [null, 0],
      [undefined, 0],
      [NaN, 0],
      [Infinity, 0],
    ])("%p becomes %p", (input, expected) => {
      expect(normalizeAnalysis({ matchScore: input }).matchScore).toBe(expected);
    });
  });

  test("defaults and cleans keyword importance", () => {
    const { missingKeywords } = normalizeAnalysis({
      missingKeywords: [
        { keyword: "A", importance: "HIGH" },
        { keyword: "B", importance: " low " },
        { keyword: "C", importance: "urgent" },
        { keyword: "D" },
        { keyword: "", importance: "high" },
        { importance: "high" },
        "not an object",
      ],
    });
    expect(missingKeywords.map((m) => [m.keyword, m.importance])).toEqual([
      ["A", "high"],
      ["B", "low"],
      ["C", "medium"],
      ["D", "medium"],
    ]);
  });

  test("never lists a keyword as both matched and missing, and drops duplicates", () => {
    const { matchedKeywords } = normalizeAnalysis({
      matchedKeywords: ["Python", "python", "SQL", "dbt"],
      missingKeywords: [{ keyword: "DBT", importance: "high", advice: "" }],
    });
    expect(matchedKeywords).toEqual(["Python", "SQL"]);
  });

  test("drops changes with an unknown section, no new text, or text that did not change", () => {
    const { changes } = normalizeAnalysis({
      changes: [
        { section: "Summary", where: "S", before: "a", after: "b", reason: "r" }, // section is matched ignoring case
        { section: "hobbies", where: "H", before: "a", after: "b", reason: "r" },
        { section: "skills", where: "K", before: "a", after: "", reason: "r" },
        { section: "skills", where: "K", before: "same", after: "same", reason: "r" },
        { where: "no section", before: "a", after: "b" },
      ],
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].section).toBe("summary");
  });

  test("drops edits that only change punctuation, spacing or capitals", () => {
    const { changes } = normalizeAnalysis({
      changes: [
        { section: "skills", where: "a", before: "Led a team", after: "Led a team.", reason: "r" },
        { section: "skills", where: "b", before: "led  a team", after: "Led a Team", reason: "r" },
        { section: "skills", where: "c", before: "Cut costs - fast", after: "Cut costs, fast", reason: "r" },
        { section: "skills", where: "d", before: "Led a team", after: "Led a team of four", reason: "r" },
      ],
    });
    expect(changes.map((c) => c.where)).toEqual(["d"]);
  });

  test("bounds every list and string", () => {
    const analysis = normalizeAnalysis({
      verdict: "v".repeat(2000),
      matchedKeywords: Array.from({ length: 100 }, (_, i) => `kw${i}`),
      missingKeywords: Array.from({ length: 100 }, (_, i) => ({ keyword: `m${i}`, importance: "low", advice: "a".repeat(2000) })),
      strengths: Array.from({ length: 50 }, (_, i) => `s${i}`),
      gaps: Array.from({ length: 50 }, (_, i) => `g${i}`),
      changes: Array.from({ length: 100 }, (_, i) => ({ section: "skills", where: "w", before: "b", after: `a${i}`, reason: "r".repeat(2000) })),
    });
    expect(analysis.verdict).toHaveLength(500);
    expect(analysis.matchedKeywords).toHaveLength(30);
    expect(analysis.missingKeywords).toHaveLength(20);
    expect(analysis.missingKeywords[0].advice).toHaveLength(400);
    expect(analysis.strengths).toHaveLength(10);
    expect(analysis.gaps).toHaveLength(10);
    expect(analysis.changes).toHaveLength(25);
    expect(analysis.changes[0].reason).toHaveLength(400);
  });

  test("ignores values of the wrong type inside lists", () => {
    const analysis = normalizeAnalysis({ strengths: ["ok", 5, null, {}, "", "  ", "fine"], gaps: "not a list" });
    expect(analysis.strengths).toEqual(["ok", "fine"]);
    expect(analysis.gaps).toEqual([]);
  });
});
