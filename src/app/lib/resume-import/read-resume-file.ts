import mammoth from "mammoth";
import { AiRequestError } from "lib/ai/gemini";
import { extractResumeWithAi } from "lib/resume-import/extract-with-ai";
import type { Resume } from "lib/redux/types";

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_LENGTH = 40;
const MAX_TEXT_LENGTH = 60_000;

const isPdf = (bytes: Buffer) => bytes.subarray(0, 5).toString("latin1") === "%PDF-";
// A .docx is a zip archive, which starts with "PK".
const isDocx = (bytes: Buffer) => bytes[0] === 0x50 && bytes[1] === 0x4b;

/**
 * Reads an uploaded PDF or Word (.docx) file into the resume builder's shape. The file type is decided from its first bytes, not its name.
 * Throws `AiRequestError` with a message that is safe to show: 413 too large, 415 wrong type, 422 unreadable, plus whatever the model
 * call throws.
 */
export const readResumeFile = async (file: File): Promise<Resume> => {
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new AiRequestError("This file is too large. The limit is 5 MB.", 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (isPdf(bytes)) {
    return extractResumeWithAi({ kind: "pdf", data: bytes });
  }

  if (isDocx(bytes)) {
    let textContent: string;
    try {
      textContent = (await mammoth.extractRawText({ buffer: bytes })).value.trim();
    } catch {
      throw new AiRequestError("We couldn't read this file. Try another one.", 422);
    }
    if (textContent.length < MIN_TEXT_LENGTH) {
      throw new AiRequestError("We couldn't find enough text in this file to read a resume.", 422);
    }
    return extractResumeWithAi({ kind: "text", text: textContent.slice(0, MAX_TEXT_LENGTH) });
  }

  throw new AiRequestError("Only PDF and Word (.docx) files are supported.", 415);
};
