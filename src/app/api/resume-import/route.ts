import { NextResponse } from "next/server";
import { AiRequestError } from "lib/ai/gemini";
import { isAuthorized } from "lib/resume-import/authorize";
import { readResumeFile } from "lib/resume-import/read-resume-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/**
 * POST multipart/form-data with a `file` field (PDF or Word .docx, up to 5 MB). Answers `{ resume }` in the resume builder's shape.
 * Nothing is stored: the file is read in memory and sent to the AI model.
 */
export async function POST(req: Request) {
  if (!(await isAuthorized(req))) {
    return fail("Sign in to import a resume.", 401);
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("Upload a PDF or Word file.", 400);
  }
  if (!file || typeof file === "string") return fail("Upload a PDF or Word file.", 400);

  try {
    return NextResponse.json({ resume: await readResumeFile(file) });
  } catch (error) {
    if (error instanceof AiRequestError) return fail(error.message, error.status);
    console.error("Resume import failed", error);
    return fail("We couldn't read this file. Try another one.", 422);
  }
}
