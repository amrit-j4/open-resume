/**
 * @jest-environment node
 */
import { AiRequestError, generateJson } from "lib/ai/gemini";

const fetchMock = jest.fn();
const originalEnv = process.env;
const options = { failureMessage: "It failed.", unreadableMessage: "Unreadable." };
const parts = [{ text: "prompt" }];

const answer = (text: string | undefined, finishReason = "STOP") => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: text === undefined ? undefined : { parts: [{ text }] }, finishReason }] }),
  text: async () => "",
});

let errors: jest.SpyInstance;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env = { ...originalEnv, GEMINI_API_KEY: "test-key" };
  delete process.env.GEMINI_GENERATION_MODEL;
  errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe("generateJson", () => {
  test("returns the parsed answer after one call", async () => {
    fetchMock.mockResolvedValue(answer('{"a":1}'));

    await expect(generateJson(parts, options)).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body)).toEqual({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });
  });

  test("uses GEMINI_GENERATION_MODEL when set", async () => {
    process.env.GEMINI_GENERATION_MODEL = "gemini-custom";
    fetchMock.mockResolvedValue(answer("{}"));
    await generateJson(parts, options);
    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-custom:");
  });

  test("reads an answer wrapped in a code fence", async () => {
    fetchMock.mockResolvedValue(answer('```json\n{"a":1}\n```'));
    await expect(generateJson(parts, options)).resolves.toEqual({ a: 1 });
  });

  test("fails with 503 and makes no call when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateJson(parts, options)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("retrying", () => {
    test("tries again after a failed call, and returns the second answer", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "overloaded" }).mockResolvedValueOnce(answer('{"ok":true}'));

      await expect(generateJson(parts, options)).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("tries again after a network error", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(answer("{}"));
      await expect(generateJson(parts, options)).resolves.toEqual({});
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("tries again after an answer that isn't JSON", async () => {
      fetchMock.mockResolvedValueOnce(answer('{"cut off": ')).mockResolvedValueOnce(answer('{"ok":true}'));
      await expect(generateJson(parts, options)).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("tries again after an empty answer", async () => {
      fetchMock.mockResolvedValueOnce(answer(undefined, "SAFETY")).mockResolvedValueOnce(answer("{}"));
      await expect(generateJson(parts, options)).resolves.toEqual({});
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("gives up after two attempts, with the right message", async () => {
      fetchMock.mockResolvedValue(answer("not json"));
      const error = await generateJson(parts, options).catch((e) => e);
      expect(error).toBeInstanceOf(AiRequestError);
      expect(error).toMatchObject({ status: 422, message: "Unreadable." });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("gives up after two failed calls", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
      await expect(generateJson(parts, options)).rejects.toMatchObject({ status: 502, message: "It failed." });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  test("logs why the model stopped, but never what it said", async () => {
    fetchMock.mockResolvedValue(answer("personal details that must not be logged {", "MAX_TOKENS"));

    await generateJson(parts, options).catch(() => undefined);

    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).toContain("MAX_TOKENS");
    expect(logged).not.toContain("personal details");
  });
});
