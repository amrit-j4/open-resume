const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

/** A failure with the HTTP status the API route should answer and a message that is safe to show the user. */
export class AiRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

interface GenerateJsonOptions {
  /** Shown when the model API fails or is unreachable. */
  failureMessage: string;
  /** Shown when the model answers with nothing usable. */
  unreadableMessage: string;
}

/** Models sometimes wrap JSON in a ```json fence despite being asked not to. */
const stripFences = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const afterFence = trimmed.slice(trimmed.indexOf("\n") + 1);
  return (afterFence.endsWith("```") ? afterFence.slice(0, -3) : afterFence).trim();
};

const ATTEMPTS = 2;

/** Whether trying again could help: the model API failed in a way that is often temporary, or its answer came back unusable. */
const isRetryable = (error: unknown) => error instanceof AiRequestError && (error.status === 502 || error.status === 422);

const generateJsonOnce = async (parts: GeminiPart[], options: GenerateJsonOptions): Promise<unknown> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiRequestError("This feature isn't set up yet.", 503);
  }
  const model = process.env.GEMINI_GENERATION_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Could not reach the Gemini API", error);
    throw new AiRequestError(options.failureMessage, 502);
  }

  if (!res.ok) {
    console.error("Gemini rejected the request", res.status, await res.text());
    throw new AiRequestError(options.failureMessage, 502);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const answer = candidate?.content?.parts?.[0]?.text;
  if (!answer) {
    // Why it stopped (for example MAX_TOKENS or SAFETY) helps to tell a limit from a bug. Only the reason is logged, never the content.
    console.error("Gemini gave no answer", { finishReason: candidate?.finishReason, blockReason: data.promptFeedback?.blockReason });
    throw new AiRequestError(options.unreadableMessage, 422);
  }

  try {
    return JSON.parse(stripFences(answer));
  } catch {
    console.error("Gemini's answer was not valid JSON", { finishReason: candidate?.finishReason, length: answer.length });
    throw new AiRequestError(options.unreadableMessage, 422);
  }
};

/**
 * Sends the parts to Gemini and returns its answer parsed as JSON. The key stays on the server (GEMINI_API_KEY); the model defaults to
 * gemini-2.5-flash (GEMINI_GENERATION_MODEL overrides it). A temporary failure or an unusable answer is retried once. Throws
 * `AiRequestError`: 503 when no key is configured, 502 when the model API fails, 422 when the answer is empty or not JSON.
 */
export const generateJson = async (parts: GeminiPart[], options: GenerateJsonOptions): Promise<unknown> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await generateJsonOnce(parts, options);
    } catch (error) {
      if (attempt >= ATTEMPTS || !isRetryable(error)) throw error;
    }
  }
};
