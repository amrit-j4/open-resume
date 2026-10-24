import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { isAuthorized } from "lib/resume-import/authorize";
import { extractResumeWithAi, ResumeImportError } from "lib/resume-import/extract-with-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_LENGTH = 40;
const MAX_TEXT_LENGTH = 60_000;

const isPdf = (bytes: Buffer) => bytes.subarray(0, 5).toString("latin1") === "%PDF-";
// A .docx is a zip archive, which starts with "PK".
const isDocx = (bytes: Buffer) => bytes[0] === 0x50 && bytes[1] === 0x4b;

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
  if (file.size > MAX_FILE_BYTES) return fail("This file is too large. The limit is 5 MB.", 413);

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    if (isPdf(bytes)) {
      return NextResponse.json({ resume: await extractResumeWithAi({ kind: "pdf", data: bytes }) });
    }

    if (isDocx(bytes)) {
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      const textContent = value.trim();
      if (textContent.length < MIN_TEXT_LENGTH) {
        return fail("We couldn't find enough text in this file to read a resume.", 422);
      }
      return NextResponse.json({
        resume: await extractResumeWithAi({ kind: "text", text: textContent.slice(0, MAX_TEXT_LENGTH) }),
      });
    }
  } catch (error) {
    if (error instanceof ResumeImportError) return fail(error.message, error.status);
    console.error("Resume import failed", error);
    return fail("We couldn't read this file. Try another one.", 422);
  }

  return fail("Only PDF and Word (.docx) files are supported.", 415);
}
