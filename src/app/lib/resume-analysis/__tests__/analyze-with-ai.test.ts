/**
 * @jest-environment node
 */
import { analyzeResumeWithAi } from "lib/resume-analysis/analyze-with-ai";
import { AiRequestError } from "lib/ai/gemini";
import type { Resume } from "lib/redux/types";
import { JOB_DESCRIPTION, RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const fetchMock = jest.fn();
const originalEnv = process.env;

const geminiAnswer = (answer: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: typeof answer === "string" ? answer : JSON.stringify(answer) }] } }] }),
  text: async () => "",
});

const clone = (): Resume => JSON.parse(JSON.stringify(RESUME));

const modelAnswer = (overrides: Record<string, unknown> = {}) => {
  const tailored = clone();
  tailored.profile.summary = "Senior data analyst who builds forecasting models and mentors analysts.";
  tailored.workExperiences[0].descriptions = ["Led a team of 4 analysts", "Built a demand forecasting model that cut stock-outs by 18%"];
  return {
    job: { title: "Senior Data Analyst", company: "Northern Lights Energy" },
    matchScore: 82,
    verdict: "Strong fit. Add the missing tools if you have used them.",
    matchedKeywords: ["Python", "SQL", "Power BI"],
    missingKeywords: [{ keyword: "dbt", importance: "medium", advice: "Mention it if you have used it." }],
    strengths: ["Forecasting experience"],
    gaps: ["No Snowflake"],
    changes: [
      { section: "summary", where: "Summary", before: RESUME.profile.summary, after: tailored.profile.summary, reason: "Targets the role" },
    ],
    tailoredResume: tailored,
    ...overrides,
  };
};

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
  test("gives the model the resume and the job in separate, labelled blocks", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));

    await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    const [instructions, resumeBlock, jobBlock] = sentPrompt();
    expect(instructions).toMatch(/never invent or add an employer/i);
    expect(resumeBlock).toBe(`<resume>\n${JSON.stringify(RESUME)}\n</resume>`);
    expect(jobBlock).toBe(`<job_description>\n${JOB_DESCRIPTION}\n</job_description>`);
  });

  test("returns the report, the original resume and the tailored resume", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(modelAnswer()));

    const result = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(result.analysis.matchScore).toBe(82);
    expect(result.analysis.job).toEqual({ title: "Senior Data Analyst", company: "Northern Lights Energy" });
    expect(result.analysis.missingKeywords).toEqual([{ keyword: "dbt", importance: "medium", advice: "Mention it if you have used it." }]);
    expect(result.resume).toBe(RESUME);
    expect(result.tailoredResume.profile.summary).toBe("Senior data analyst who builds forecasting models and mentors analysts.");
    expect(result.tailoredResume.workExperiences[0].descriptions[0]).toBe("Led a team of 4 analysts");
    expect(result.analysis.changes).toHaveLength(1);
  });

  test("puts back anything the model was not allowed to change", async () => {
    const answer = modelAnswer();
    answer.tailoredResume.profile.name = "Someone Else";
    answer.tailoredResume.workExperiences[0].company = "Google";
    answer.tailoredResume.workExperiences.push({ company: "Invented Inc", jobTitle: "CEO", date: "2024", descriptions: ["Ran it"] });
    answer.tailoredResume.skills.featuredSkills.push({ skill: "Snowflake", rating: 5 });
    fetchMock.mockResolvedValue(geminiAnswer(answer));

    const { tailoredResume } = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(tailoredResume.profile.name).toBe("Priya Nair");
    expect(tailoredResume.workExperiences.map((w) => w.company)).toEqual(["Brightwave Retail", "Coastline Logistics"]);
    expect(tailoredResume.skills.featuredSkills.map((s) => s.skill)).toEqual(["Python", "SQL", "Power BI"]);
  });

  test("does not report an edit that was undone because it invented a number", async () => {
    const answer = modelAnswer();
    answer.tailoredResume.workExperiences[0].descriptions = ["Grew revenue by 300%"];
    answer.changes.push({
      section: "workExperiences",
      where: "Brightwave Retail",
      before: "Led a team of 4 analysts",
      after: "Grew revenue by 300%",
      reason: "Sounds impressive",
    });
    fetchMock.mockResolvedValue(geminiAnswer(answer));

    const result = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(result.tailoredResume.workExperiences[0].descriptions).toEqual(RESUME.workExperiences[0].descriptions);
    expect(result.analysis.changes.map((c) => c.after)).toEqual([answer.tailoredResume.profile.summary]);
  });

  test("uses the original resume when the model sends no tailored one", async () => {
    const { tailoredResume: _omitted, ...withoutTailored } = modelAnswer();
    fetchMock.mockResolvedValue(geminiAnswer(withoutTailored));

    const result = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(result.tailoredResume).toEqual(RESUME);
    expect(result.analysis.changes).toEqual([]);
  });

  test("copes with an answer that is not shaped as asked", async () => {
    fetchMock.mockResolvedValue(geminiAnswer({ matchScore: "high", tailoredResume: "nope", missingKeywords: 7 }));

    const result = await analyzeResumeWithAi(RESUME, JOB_DESCRIPTION);

    expect(result.analysis.matchScore).toBe(0);
    expect(result.analysis.missingKeywords).toEqual([]);
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
