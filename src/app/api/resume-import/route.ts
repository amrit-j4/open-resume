import { NextResponse } from "next/server";
import { AiRequestError } from "lib/ai/gemini";
import { authorize } from "lib/resume-import/authorize";
import { startUsage } from "lib/resume-import/usage-limit";
import { readResumeFile } from "lib/resume-import/read-resume-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/**
 * POST multipart/form-data with a `file` field (PDF or Word .docx, up to 5 MB). Answers `{ resume }` in the resume builder's shape.
 * Nothing is stored: the file is read in memory and sent to the AI model.
 */
export async function POST(req: Request) {
  const caller = await authorize(req);
  if (!caller) {
    return fail("Sign in to import a resume.", 401);
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("Upload a PDF or Word file.", 400);
  }
  if (!file || typeof file === "string") return fail("Upload a PDF or Word file.", 400);

  // Each import costs an AI call: limit how many one person can run, and how many at once.
  const usage = startUsage(caller, "import");
  if (!usage.allowed) {
    return NextResponse.json({ error: usage.message }, { status: 429, headers: { "Retry-After": String(usage.retryAfterSeconds) } });
  }

  let refund = false;
  try {
    return NextResponse.json({ resume: await readResumeFile(file) });
  } catch (error) {
    // A failure on our side or the model's isn't the person's fault, so it doesn't use up their allowance.
    refund = error instanceof AiRequestError && error.status >= 500;
    if (error instanceof AiRequestError) return fail(error.message, error.status);
    console.error("Resume import failed", error);
    return fail("We couldn't read this file. Try another one.", 422);
  } finally {
    usage.done({ refund });
  }
}
