/**
 * @jest-environment node
 */
import { analyzeResumeWithAi } from "lib/resume-analysis/analyze-with-ai";
import { AiRequestError } from "lib/ai/gemini";
import { applyEdits } from "lib/resume-analysis/apply-edits";
import { JOB_DESCRIPTION, RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const fetchMock = jest.fn();
const originalEnv = process.env;

const geminiAnswer = (answer: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: typeof answer === "string" ? answer : JSON.stringify(answer) }] } }] }),
  text: async () => "",
});

const modelAnswer = (overrides: Record<string, unknown> = {}) => ({
  job: { title: "Senior Data Analyst", company: "Northern Lights Energy" },
  matchScore: 82,
  verdict: "Strong fit. Add the missing tools if you have used them.",
  matchedKeywords: ["Python", "SQL", "Power BI"],
  missingKeywords: [{ keyword: "dbt", importance: "medium", advice: "Mention it if you have used it." }],
  strengths: ["Forecasting experience"],
  gaps: ["No Snowflake"],
  edits: [
    { section: "summary", after: "Senior data analyst who builds forecasting models and mentors analysts.", reason: "Targets the role" },
    { section: "workExperiences", entry: 0, bullet: 1, after: "Led a team of 4 analysts, mentoring juniors", reason: "Shows the mentoring the job wants" },
  ],
  ...overrides,
});

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env = { ...originalEnv, GEMINI_API_KEY: "test-key" };
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

const sentPrompt = () => JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts.map((p: { text: string }) => p.text) as string[];

describe("analyzeResumeWithAi", () => {
  test("tells the model the extras can't be edited, and an edit to them is dropped", async () => {
    fetchMock.mockResolvedValue(
      geminiAnswer(modelAnswer({ edits: [{ section: "custom", bullet: 0, after: "Microsoft Certified: Data Analyst Expert (2022)", reason: "r" }] }))
    );

    const { analysis, tailoredResume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(sentPrompt()[0]).toMatch(/never edit .*the extras/i);
    expect(analysis.edits).toEqual([]);
    expect(tailoredResume.custom).toEqual(RESUME.custom);
  });

  test("gives the model an indexed outline of the resume and the job, in separate labelled blocks", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));

    await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    const [instructions, resumeBlock, jobBlock] = sentPrompt();
    expect(instructions).toMatch(/never invent or add an employer/i);
    expect(resumeBlock).toMatch(/^<resume>\n/);
    expect(resumeBlock).toContain("[1] Led a team of 4 analysts");
    expect(resumeBlock).not.toContain('"workExperiences"'); // an outline, not JSON
    expect(jobBlock).toBe(`<job_description>\n${JOB_DESCRIPTION}\n</job_description>`);
  });

  test("returns the report, the original resume and checked edits", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));

    const { analysis, resume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(analysis.matchScore).toBe(82);
    expect(analysis.job).toEqual({ title: "Senior Data Analyst", company: "Northern Lights Energy" });
    expect(analysis.missingKeywords).toEqual([{ keyword: "dbt", importance: "medium", advice: "Mention it if you have used it." }]);
    expect(resume).toBe(RESUME);
    expect(analysis.edits).toEqual([
      expect.objectContaining({ id: "edit-1", section: "summary", where: "Summary", before: RESUME.profile.summary }),
      expect.objectContaining({ id: "edit-2", section: "workExperiences", entryIndex: 0, bulletIndex: 1, where: "Brightwave Retail", before: "Led a team of 4 analysts" }),
    ]);
  });

  test("the tailored resume is the original with every edit applied", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));

    const { analysis, tailoredResume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(tailoredResume).toEqual(applyEdits(RESUME, analysis.edits));
    expect(tailoredResume.profile.summary).toBe("Senior data analyst who builds forecasting models and mentors analysts.");
    expect(tailoredResume.workExperiences[0].descriptions[1]).toBe("Led a team of 4 analysts, mentoring juniors");
    // Everything the edits didn't touch is the original.
    expect(tailoredResume.workExperiences[1]).toEqual(RESUME.workExperiences[1]);
    expect(tailoredResume.profile.name).toBe(RESUME.profile.name);
  });

  test("a suggested new bullet is added to the tailored resume, with where it comes from", async () => {
    const resume = { ...RESUME, profile: { ...RESUME.profile, summary: "Data analyst who mentored junior analysts on forecasting." } };
    fetchMock.mockResolvedValue(
      geminiAnswer(
        modelAnswer({
          edits: [
            {
              action: "add",
              section: "workExperiences",
              entry: 0,
              position: 2,
              after: "Mentored junior analysts on forecasting",
              reason: "The job wants mentoring",
              basedOn: "The summary says the candidate mentored junior analysts",
            },
          ],
        })
      )
    );

    const { analysis, tailoredResume } = await analyzeResumeWithAi(resume, JOB_DESCRIPTION);

    expect(analysis.edits).toEqual([
      expect.objectContaining({ kind: "add", where: "Brightwave Retail", before: "", bulletIndex: 2, basedOn: "The summary says the candidate mentored junior analysts" }),
    ]);
    expect(tailoredResume.workExperiences[0].descriptions).toEqual([...RESUME.workExperiences[0].descriptions, "Mentored junior analysts on forecasting"]);
  });

  test("an add that invents something never reaches the report or the tailored resume", async () => {
    fetchMock.mockResolvedValue(
      geminiAnswer(
        modelAnswer({
          edits: [
            { action: "add", section: "workExperiences", entry: 0, position: 0, after: "Built Snowflake pipelines with dbt", reason: "The job wants it", basedOn: "Nothing" },
            { action: "add", section: "workExperiences", entry: 0, position: 0, after: "Led a team of 4 analysts", reason: "x", basedOn: "The bullet above" },
            { action: "add", section: "workExperiences", entry: 0, position: 0, after: "Led 50 analysts", reason: "x", basedOn: "Invented" },
          ],
        })
      )
    );

    const { analysis, tailoredResume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(analysis.edits).toEqual([]);
    expect(tailoredResume).toEqual(RESUME);
  });

  test("asks the model to score five parts that add up, and to explain what wording can't fix", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));
    await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    const [instructions] = sentPrompt();
    for (const part of ['"skills" (up to 40)', '"experience" (up to 25)', '"keywords" (up to 20)', '"education" (up to 10)', '"clarity" (up to 5)']) {
      expect(instructions).toContain(part);
    }
    expect(instructions).toMatch(/"matchScore" is the sum of the five/);
    expect(instructions).toMatch(/"editNote"/);
  });

  test("returns the breakdown, makes the score its sum, and passes on the note", async () => {
    fetchMock.mockResolvedValue(
      geminiAnswer(
        modelAnswer({
          matchScore: 90,
          editNote: "Wording can fix the keywords, but not the seniority gap.",
          breakdown: [
            { category: "skills", score: 30, note: "No audio middleware." },
            { category: "experience", score: 8, note: "Much more senior than the job." },
            { category: "keywords", score: 15, note: "" },
            { category: "education", score: 10, note: "" },
            { category: "clarity", score: 5, note: "" },
          ],
        })
      )
    );

    const { analysis } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(analysis.matchScore).toBe(68);
    expect(analysis.breakdown.map((b) => b.score)).toEqual([30, 8, 15, 10, 5]);
    expect(analysis.breakdown[1].note).toBe("Much more senior than the job.");
    expect(analysis.editNote).toBe("Wording can fix the keywords, but not the seniority gap.");
  });

  test("tells the model what an add may and may not be", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));
    await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);
    const [instructions] = sentPrompt();
    expect(instructions).toMatch(/"add" may only state something the resume already says/);
    expect(instructions).toMatch(/"basedOn"/);
    expect(instructions).toMatch(/Never use an "add" for something the job asks for that the resume doesn't show/);
  });

  test("an edit that would invent something never reaches the report or the tailored resume", async () => {
    fetchMock.mockResolvedValue(
      geminiAnswer(
        modelAnswer({
          edits: [
            { section: "workExperiences", entry: 0, bullet: 0, after: "Grew revenue by 300%", reason: "Impressive" },
            { section: "skills", bullet: 0, after: "Tableau, Snowflake, dbt", reason: "Matches the job" },
            { section: "workExperiences", entry: 0, bullet: 1, after: "Led a team of 4 analysts, mentoring juniors", reason: "fine" },
          ],
        })
      )
    );

    const { analysis, tailoredResume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(analysis.edits.map((e) => e.after)).toEqual(["Led a team of 4 analysts, mentoring juniors"]);
    expect(JSON.stringify(tailoredResume)).not.toMatch(/300%|snowflake|dbt/i);
  });

  test("gives back the original resume when the model suggests nothing", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer({ edits: [] })));

    const { analysis, tailoredResume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(analysis.edits).toEqual([]);
    expect(tailoredResume).toEqual(RESUME);
  });

  test("copes with an answer that is not shaped as asked", async () => {
    fetchMock.mockResolvedValue(geminiAnswer({ matchScore: "high", edits: "nope", missingKeywords: 7 }));

    const result = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(result.analysis.matchScore).toBe(0);
    expect(result.analysis.missingKeywords).toEqual([]);
    expect(result.analysis.edits).toEqual([]);
    expect(result.tailoredResume).toEqual(RESUME);
  });

  test("copes with an answer that is a list instead of an object", async () => {
    fetchMock.mockResolvedValue(geminiAnswer([1, 2, 3]));
    const result = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);
    expect(result.analysis.matchScore).toBe(0);
    expect(result.tailoredResume).toEqual(RESUME);
  });

  test("fails with 503 when no API key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(analyzeResumeWithAi(RESUME, JOB_DESCRIPTION)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fails with 502 when the model API rejects the request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const error = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION).catch((e) => e);
    expect(error).toBeInstanceOf(AiRequestError);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/couldn't analyse/i);
  });

  test("fails with 422 when the model answers with something that isn't JSON", async () => {
    fetchMock.mockResolvedValue(geminiAnswer("Sorry, I can't do that."));
    await expect(analyzeResumeWithAi(RESUME, JOB_DESCRIPTION)).rejects.toMatchObject({ status: 422 });
  });

  test("fails with 502 when the model API can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    await expect(analyzeResumeWithAi(RESUME, JOB_DESCRIPTION)).rejects.toMatchObject({ status: 502 });
  });
});
