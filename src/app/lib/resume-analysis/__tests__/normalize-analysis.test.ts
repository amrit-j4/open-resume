import { normalizeAnalysis } from "lib/resume-analysis/normalize-analysis";

describe("normalizeAnalysis", () => {
  test("returns an empty analysis for anything that is not an object", () => {
    for (const input of [null, undefined, "x", 3, [], true]) {
      expect(normalizeAnalysis(input)).toEqual({
        matchScore: 0,
        breakdown: [],
        editNote: "",
        verdict: "",
        job: { title: "", company: "" },
        matchedKeywords: [],
        missingKeywords: [],
        strengths: [],
        gaps: [],
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
    });

    expect(analysis).toEqual({
      matchScore: 78,
      breakdown: [],
      editNote: "",
      verdict: "Strong fit.",
      job: { title: "Senior Data Analyst", company: "Northern Lights" },
      matchedKeywords: ["Python", "SQL"],
      missingKeywords: [{ keyword: "dbt", importance: "high", advice: "Mention it if you have used it." }],
      strengths: ["Forecasting"],
      gaps: ["No Snowflake"],
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

  test("bounds every list and string", () => {
    const analysis = normalizeAnalysis({
      verdict: "v".repeat(2000),
      matchedKeywords: Array.from({ length: 100 }, (_, i) => `kw${i}`),
      missingKeywords: Array.from({ length: 100 }, (_, i) => ({ keyword: `m${i}`, importance: "low", advice: "a".repeat(2000) })),
      strengths: Array.from({ length: 50 }, (_, i) => `s${i}`),
      gaps: Array.from({ length: 50 }, (_, i) => `g${i}`),
    });
    expect(analysis.verdict).toHaveLength(500);
    expect(analysis.matchedKeywords).toHaveLength(30);
    expect(analysis.missingKeywords).toHaveLength(20);
    expect(analysis.missingKeywords[0].advice).toHaveLength(400);
    expect(analysis.strengths).toHaveLength(10);
    expect(analysis.gaps).toHaveLength(10);
  });

  test("ignores values of the wrong type inside lists", () => {
    const analysis = normalizeAnalysis({ strengths: ["ok", 5, null, {}, "", "  ", "fine"], gaps: "not a list" });
    expect(analysis.strengths).toEqual(["ok", "fine"]);
    expect(analysis.gaps).toEqual([]);
  });

  describe("score breakdown", () => {
    const parts = (scores: Record<string, unknown>, note = "") =>
      ["skills", "experience", "keywords", "education", "clarity"].map((category) => ({ category, score: scores[category], note }));

    test("lists the five parts in a fixed order, with what each is worth", () => {
      const { breakdown } = normalizeAnalysis({ breakdown: [...parts({ skills: 30, experience: 10, keywords: 15, education: 8, clarity: 4 })].reverse() });

      expect(breakdown.map((b) => [b.key, b.label, b.score, b.max])).toEqual([
        ["skills", "Required skills", 30, 40],
        ["experience", "Experience fit", 10, 25],
        ["keywords", "Job keywords", 15, 20],
        ["education", "Education and certifications", 8, 10],
        ["clarity", "Clarity and results", 4, 5],
      ]);
    });

    test("the score is the sum of the parts, so the two can never disagree", () => {
      const { matchScore } = normalizeAnalysis({ matchScore: 95, breakdown: parts({ skills: 30, experience: 10, keywords: 15, education: 8, clarity: 4 }) });
      expect(matchScore).toBe(67);
    });

    test("keeps each part within what it is worth, and whole", () => {
      const { breakdown, matchScore } = normalizeAnalysis({ breakdown: parts({ skills: 99, experience: -4, keywords: 12.6, education: "7", clarity: "3.4" }) });
      expect(breakdown.map((b) => b.score)).toEqual([40, 0, 13, 7, 3]);
      expect(matchScore).toBe(63);
    });

    test("shows no breakdown, and keeps the model's score, unless all five parts are usable", () => {
      const four = parts({ skills: 30, experience: 10, keywords: 15, education: 8, clarity: 4 }).slice(0, 4);
      for (const breakdown of [four, parts({ skills: 30, experience: "lots", keywords: 15, education: 8, clarity: 4 }), "nope", null, [], [{ category: "other", score: 5 }]]) {
        const analysis = normalizeAnalysis({ matchScore: 72, breakdown });
        expect(analysis.breakdown).toEqual([]);
        expect(analysis.matchScore).toBe(72);
      }
    });

    test("accepts the category under the name key, in any case", () => {
      const named = ["Skills", "EXPERIENCE", "keywords", "education", "clarity"].map((key) => ({ key, score: 1 }));
      expect(normalizeAnalysis({ breakdown: named }).breakdown).toHaveLength(5);
    });

    test("trims and bounds each note", () => {
      const { breakdown } = normalizeAnalysis({ breakdown: parts({ skills: 1, experience: 1, keywords: 1, education: 1, clarity: 1 }, `  ${"n".repeat(1000)}  `) });
      expect(breakdown.every((b) => b.note.length === 250)).toBe(true);
    });
  });

  describe("edit note", () => {
    test("keeps and trims it", () => {
      expect(normalizeAnalysis({ editNote: "  Wording can't fix seniority.  " }).editNote).toBe("Wording can't fix seniority.");
    });

    test("is empty when missing or not text, and bounded", () => {
      expect(normalizeAnalysis({}).editNote).toBe("");
      expect(normalizeAnalysis({ editNote: 5 }).editNote).toBe("");
      expect(normalizeAnalysis({ editNote: "x".repeat(2000) }).editNote).toHaveLength(500);
    });
  });
});
