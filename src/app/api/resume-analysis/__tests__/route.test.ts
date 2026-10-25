/**
 * @jest-environment node
 */
import { POST } from "../route";
import { AiRequestError } from "lib/ai/gemini";
import { authorize } from "lib/resume-import/authorize";
import { resetUsage } from "lib/resume-import/usage-limit";
import { readResumeFile } from "lib/resume-import/read-resume-file";
import { analyzeResumeWithAi } from "lib/resume-analysis/analyze-with-ai";
import { fetchJobPage } from "lib/resume-analysis/job-page/fetch-job-page";
import { JOB_DESCRIPTION, RESUME } from "lib/resume-analysis/__fixtures__/analysis";

jest.mock("../../../lib/resume-import/authorize", () => ({ authorize: jest.fn() }));
jest.mock("../../../lib/resume-import/read-resume-file", () => ({ readResumeFile: jest.fn() }));
jest.mock("../../../lib/resume-analysis/analyze-with-ai", () => ({ analyzeResumeWithAi: jest.fn() }));
jest.mock("../../../lib/resume-analysis/job-page/fetch-job-page", () => ({ fetchJobPage: jest.fn() }));

const authorized = authorize as jest.Mock;
const readFile = readResumeFile as jest.Mock;
const analyze = analyzeResumeWithAi as jest.Mock;
const fetchPage = fetchJobPage as jest.Mock;

const RESULT = {
  analysis: { matchScore: 80, verdict: "Good", job: { title: "", company: "" }, matchedKeywords: [], missingKeywords: [], strengths: [], gaps: [], edits: [] },
  resume: RESUME,
  tailoredResume: RESUME,
};

const send = (fields: Record<string, string | File>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return POST(new Request("http://localhost/api/resume-analysis", { method: "POST", body }));
};

const pdf = () => new File(["%PDF-1.7"], "resume.pdf");
const jobPage = (description: string) =>
  `<html><head><title>Job</title></head><body><h1>Senior Data Analyst</h1><p>${description}</p></body></html>`;

beforeEach(() => {
  resetUsage();
  authorized.mockReset().mockResolvedValue({ kind: "user", id: "user-1" });
  readFile.mockReset().mockResolvedValue(RESUME);
  analyze.mockReset().mockResolvedValue(RESULT);
  fetchPage.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("POST /api/resume-analysis", () => {
  test("answers 401 and does nothing when the caller is not authorised", async () => {
    authorized.mockResolvedValue(null);

    const res = await send({ file: pdf(), jobText: JOB_DESCRIPTION });

    expect(res.status).toBe(401);
    expect(readFile).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });

  test("answers 429 with Retry-After once the daily limit is used, without calling the model", async () => {
    process.env.RESUME_ANALYSIS_DAILY_LIMIT = "1";
    expect((await send({ file: pdf(), jobText: JOB_DESCRIPTION })).status).toBe(200);
    analyze.mockClear();

    const res = await send({ file: pdf(), jobText: JOB_DESCRIPTION });

    delete process.env.RESUME_ANALYSIS_DAILY_LIMIT;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).error).toContain("limit of 1 resume analyses");
    expect(analyze).not.toHaveBeenCalled();
  });

  test("does not use up the allowance when the model fails", async () => {
    process.env.RESUME_ANALYSIS_DAILY_LIMIT = "1";
    analyze.mockRejectedValueOnce(new AiRequestError("The model is down.", 502));

    expect((await send({ file: pdf(), jobText: JOB_DESCRIPTION })).status).toBe(502);
    const retry = await send({ file: pdf(), jobText: JOB_DESCRIPTION });

    delete process.env.RESUME_ANALYSIS_DAILY_LIMIT;
    expect(retry.status).toBe(200);
  });

  test("answers 400 when the body is not a form", async () => {
    const res = await POST(new Request("http://localhost/api/resume-analysis", { method: "POST", body: "plain" }));
    expect(res.status).toBe(400);
  });

  describe("resume input", () => {
    test("reads an uploaded file and analyses it against pasted text", async () => {
      const res = await send({ file: pdf(), jobText: JOB_DESCRIPTION });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ...RESULT, job: { source: "text" } });
      expect(readFile).toHaveBeenCalledWith(expect.any(File));
      expect(analyze).toHaveBeenCalledWith(RESUME, JOB_DESCRIPTION);
    });

    test("uses the builder's resume sent as JSON, without reading a file", async () => {
      const res = await send({ resume: JSON.stringify(RESUME), jobText: JOB_DESCRIPTION });

      expect(res.status).toBe(200);
      expect(readFile).not.toHaveBeenCalled();
      expect(analyze.mock.calls[0][0]).toEqual(RESUME);
    });

    test("tidies the builder's resume before analysing it", async () => {
      await send({ resume: JSON.stringify({ ...RESUME, profile: { ...RESUME.profile, name: "  Priya Nair  ", email: 5 } }), jobText: JOB_DESCRIPTION });

      const sent = analyze.mock.calls[0][0];
      expect(sent.profile.name).toBe("Priya Nair");
      expect(sent.profile.email).toBe("");
    });

    test.each([
      ["neither a file nor a resume", {}],
      ["both a file and a resume", { file: pdf(), resume: JSON.stringify(RESUME) }],
      ["an empty resume field", { resume: "   " }],
    ])("answers 400 for %s", async (_name, fields) => {
      const res = await send({ ...fields, jobText: JOB_DESCRIPTION });
      expect(res.status).toBe(400);
      expect(analyze).not.toHaveBeenCalled();
    });

    test("answers 400 for a resume field that isn't JSON", async () => {
      const res = await send({ resume: "{ not json", jobText: JOB_DESCRIPTION });
      expect(res.status).toBe(400);
    });

    test("answers 400 for a resume with nothing in it", async () => {
      const res = await send({ resume: JSON.stringify({}), jobText: JOB_DESCRIPTION });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/empty/i);
    });

    test("answers 413 for a resume that is far too large", async () => {
      const res = await send({ resume: JSON.stringify({ profile: { summary: "x".repeat(250_000) } }), jobText: JOB_DESCRIPTION });
      expect(res.status).toBe(413);
    });

    test("passes on a file the reader refuses", async () => {
      readFile.mockRejectedValue(new AiRequestError("Only PDF and Word (.docx) files are supported.", 415));

      const res = await send({ file: new File(["x"], "a.txt"), jobText: JOB_DESCRIPTION });

      expect(res.status).toBe(415);
      expect((await res.json()).error).toMatch(/PDF and Word/);
    });
  });

  describe("job input", () => {
    test("trims pasted text", async () => {
      await send({ file: pdf(), jobText: `   ${JOB_DESCRIPTION}\n\n  ` });
      expect(analyze.mock.calls[0][1]).toBe(JOB_DESCRIPTION);
    });

    test("caps very long pasted text", async () => {
      await send({ file: pdf(), jobText: "word ".repeat(20_000) });
      expect(analyze.mock.calls[0][1]).toHaveLength(30_000);
    });

    test.each([
      ["neither text nor a link", {}],
      ["both text and a link", { jobText: JOB_DESCRIPTION, jobUrl: "https://example.com/job" }],
      ["only spaces", { jobText: "    " }],
    ])("answers 400 for %s", async (_name, fields) => {
      const res = await send({ file: pdf(), ...fields });
      expect(res.status).toBe(400);
      expect(analyze).not.toHaveBeenCalled();
    });

    test("answers 400 for pasted text that is too short to compare with", async () => {
      const res = await send({ file: pdf(), jobText: "Chef wanted" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/too short/i);
    });

    test("fetches a link, takes the job text from the page and analyses it", async () => {
      fetchPage.mockResolvedValue({ url: "https://example.com/jobs/1", html: jobPage(JOB_DESCRIPTION + " " + JOB_DESCRIPTION) });

      const res = await send({ file: pdf(), jobUrl: "https://example.com/jobs/1" });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ job: { source: "link", url: "https://example.com/jobs/1" } });
      expect(fetchPage).toHaveBeenCalledWith("https://example.com/jobs/1");
      expect(analyze.mock.calls[0][1]).toContain("Senior Data Analyst");
      expect(analyze.mock.calls[0][1]).toContain("Python and SQL");
    });

    test("reports the address the link finally led to", async () => {
      fetchPage.mockResolvedValue({ url: "https://example.com/final", html: jobPage(JOB_DESCRIPTION + " " + JOB_DESCRIPTION) });
      const res = await send({ file: pdf(), jobUrl: "https://short.example/x" });
      expect((await res.json()).job.url).toBe("https://example.com/final");
    });

    test("tells the visitor to paste the description when a page has none", async () => {
      fetchPage.mockResolvedValue({ url: "https://example.com/spa", html: "<html><body><div id='root'></div></body></html>" });

      const res = await send({ file: pdf(), jobUrl: "https://example.com/spa" });

      expect(res.status).toBe(422);
      expect((await res.json()).error).toMatch(/paste the description/i);
      expect(analyze).not.toHaveBeenCalled();
    });

    test("passes on a link the fetcher refuses, before spending an AI call on the resume", async () => {
      fetchPage.mockRejectedValue(new AiRequestError("That link isn't a public web page. Paste the job description instead.", 400));

      const res = await send({ file: pdf(), jobUrl: "http://169.254.169.254/" });

      expect(res.status).toBe(400);
      expect(readFile).not.toHaveBeenCalled();
      expect(analyze).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    test("passes on the status and message of an analysis failure", async () => {
      analyze.mockRejectedValue(new AiRequestError("We couldn't analyse this resume right now. Please try again.", 502));

      const res = await send({ file: pdf(), jobText: JOB_DESCRIPTION });

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "We couldn't analyse this resume right now. Please try again." });
    });

    test("answers 500 without leaking details for an unexpected failure", async () => {
      analyze.mockRejectedValue(new Error("secret internal detail"));

      const res = await send({ file: pdf(), jobText: JOB_DESCRIPTION });

      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain("secret internal detail");
    });
  });
});
