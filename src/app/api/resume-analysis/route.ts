import { NextResponse } from "next/server";
import { AiRequestError } from "lib/ai/gemini";
import { authorize } from "lib/resume-import/authorize";
import { startUsage } from "lib/resume-import/usage-limit";
import { normalizeResume } from "lib/resume-import/normalize";
import { readResumeFile } from "lib/resume-import/read-resume-file";
import { analyzeResumeWithAi } from "lib/resume-analysis/analyze-with-ai";
import { extractJobText, MAX_JOB_TEXT_LENGTH } from "lib/resume-analysis/job-page/extract-job-text";
import { fetchJobPage } from "lib/resume-analysis/job-page/fetch-job-page";
import type { Resume } from "lib/redux/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_JOB_TEXT_LENGTH = 80;
const MAX_RESUME_JSON_LENGTH = 200_000;

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

const tooManyRequests = ({ message, retryAfterSeconds }: { message: string; retryAfterSeconds: number }) =>
  NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });

const hasContent = (resume: Resume) =>
  Boolean(resume.profile.name || resume.workExperiences.length || resume.educations.length || resume.projects.length || resume.skills.featuredSkills.length);

/** The resume to analyse: an uploaded file, or the one from the builder sent as JSON. Exactly one must be given. */
const resumeFrom = async (form: FormData): Promise<Resume> => {
  const file = form.get("file");
  const json = form.get("resume");
  const hasFile = file !== null && typeof file !== "string";
  const hasJson = typeof json === "string" && json.trim() !== "";

  if (hasFile === hasJson) {
    throw new AiRequestError("Upload a resume file, or choose the resume from the builder.", 400);
  }
  if (hasFile) return readResumeFile(file as File);

  if ((json as string).length > MAX_RESUME_JSON_LENGTH) {
    throw new AiRequestError("This resume is too large to analyse.", 413);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json as string);
  } catch {
    throw new AiRequestError("We couldn't read that resume. Try uploading it instead.", 400);
  }
  const resume = normalizeResume(parsed);
  if (!hasContent(resume)) {
    throw new AiRequestError("That resume is empty. Add your details in the builder, or upload a file.", 400);
  }
  return resume;
};

/** The job description: pasted text, or the text found on a job page. Exactly one must be given. */
const jobFrom = async (form: FormData): Promise<{ text: string; source: "text" | "link"; url?: string }> => {
  const pasted = form.get("jobText");
  const link = form.get("jobUrl");
  const hasText = typeof pasted === "string" && pasted.trim() !== "";
  const hasLink = typeof link === "string" && link.trim() !== "";

  if (hasText === hasLink) {
    throw new AiRequestError("Paste the job description, or enter a link to the job.", 400);
  }

  if (hasText) {
    // Form submissions turn every line break into \r\n; the model should see plain \n.
    const text = (pasted as string).replace(/\r\n?/g, "\n").trim();
    if (text.length < MIN_JOB_TEXT_LENGTH) {
      throw new AiRequestError("That job description is too short to compare with. Paste the whole description.", 400);
    }
    return { text: text.slice(0, MAX_JOB_TEXT_LENGTH), source: "text" };
  }

  const page = await fetchJobPage(link as string);
  const job = extractJobText(page.html);
  if (!job) {
    throw new AiRequestError(
      "We couldn't find a job description on that page. It may need you to sign in or load with JavaScript. Paste the description instead.",
      422
    );
  }
  return { text: job.text, source: "link", url: page.url };
};

/**
 * POST multipart/form-data. The resume is a `file` (PDF or Word, up to 5 MB) or a `resume` field holding the builder's resume as JSON. The
 * job is `jobText` (pasted) or `jobUrl` (a link to the job page). Answers `{ analysis, resume, tailoredResume, job }`: a match score and report,
 * the resume as read, and the same resume reworded for the job. Nothing is stored.
 */
export async function POST(req: Request) {
  const caller = await authorize(req);
  if (!caller) {
    return fail("Sign in to analyse a resume.", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Send the resume and the job as a form.", 400);
  }

  // Each analysis costs an AI call: limit how many one person can run, and how many at once.
  const usage = startUsage(caller, "analysis");
  if (!usage.allowed) return tooManyRequests(usage);

  let refund = false;
  try {
    // The job comes first: it is quick, and a bad link shouldn't cost an AI call on the resume.
    const job = await jobFrom(form);
    const resume = await resumeFrom(form);
    const result = await analyzeResumeWithAi(resume, job.text);
    return NextResponse.json({ ...result, job: { source: job.source, url: job.url } });
  } catch (error) {
    // A failure on our side or the model's isn't the person's fault, so it doesn't use up their allowance.
    refund = !(error instanceof AiRequestError) || error.status >= 500;
    if (error instanceof AiRequestError) return fail(error.message, error.status);
    console.error("Resume analysis failed", error);
    return fail("We couldn't analyse this resume. Please try again.", 500);
  } finally {
    usage.done({ refund });
  }
}
