/**
 * @jest-environment node
 */
import { extractResumeWithAi, ResumeImportError } from "lib/resume-import/extract-with-ai";

const geminiAnswer = (text: string | undefined) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: text === undefined ? [] : [{ content: { parts: [{ text }] } }] }),
  text: async () => "",
});

const validJson = JSON.stringify({
  profile: { name: "Alex Morgan", email: "alex@example.com" },
  workExperiences: [{ company: "Harbourview", jobTitle: "Engineer", date: "2022 - Present", descriptions: ["Built things"] }],
});

const fetchMock = jest.fn();
const originalEnv = process.env;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env = { ...originalEnv, GEMINI_API_KEY: "test-key" };
  delete process.env.GEMINI_GENERATION_MODEL;
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

describe("extractResumeWithAi", () => {
  test("fails with 503 when no API key is configured, without calling the model", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(extractResumeWithAi({ kind: "text", text: "resume" })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends text as a <resume> block and returns the normalised resume", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(validJson));

    const resume = await extractResumeWithAi({ kind: "text", text: "Alex Morgan, engineer" });

    expect(resume.profile.name).toBe("Alex Morgan");
    expect(resume.workExperiences[0].company).toBe("Harbourview");
    expect(resume.educations).toEqual([]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(init.method).toBe("POST");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const parts = sentBody().contents[0].parts;
    expect(parts[1].text).toBe("<resume>\nAlex Morgan, engineer\n</resume>");
    expect(sentBody().generationConfig).toEqual({ responseMimeType: "application/json", temperature: 0 });
  });

  test("sends a PDF as base64 inline data", async () => {
    fetchMock.mockResolvedValue(geminiAnswer(validJson));
    const pdf = Buffer.from("%PDF-1.7 fake");

    await extractResumeWithAi({ kind: "pdf", data: pdf });

    const part = sentBody().contents[0].parts[1];
    expect(part.inline_data).toEqual({ mime_type: "application/pdf", data: pdf.toString("base64") });
    expect(part.text).toBeUndefined();
  });

  test("uses GEMINI_GENERATION_MODEL when set", async () => {
    process.env.GEMINI_GENERATION_MODEL = "gemini-custom";
    fetchMock.mockResolvedValue(geminiAnswer(validJson));

    await extractResumeWithAi({ kind: "text", text: "x" });

    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-custom:generateContent");
  });

  test("accepts an answer wrapped in a code fence", async () => {
    fetchMock.mockResolvedValue(geminiAnswer("```json\n" + validJson + "\n```"));
    const resume = await extractResumeWithAi({ kind: "text", text: "x" });
    expect(resume.profile.name).toBe("Alex Morgan");
  });

  test("fails with 502 when the model API rejects the request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "quota" });
    await expect(extractResumeWithAi({ kind: "text", text: "x" })).rejects.toMatchObject({ status: 502 });
  });

  test.each([
    ["no candidates", undefined],
    ["an empty answer", ""],
    ["an answer that is not JSON", "Sorry, I can't help with that."],
  ])("fails with 422 for %s", async (_name, answer) => {
    fetchMock.mockResolvedValue(geminiAnswer(answer));
    const error = await extractResumeWithAi({ kind: "text", text: "x" }).catch((e) => e);
    expect(error).toBeInstanceOf(ResumeImportError);
    expect(error.status).toBe(422);
  });
});
