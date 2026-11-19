import { NextResponse } from "next/server";
import { AiRequestError } from "lib/ai/gemini";
import { authorize } from "lib/resume-import/authorize";
import { startUsage } from "lib/resume-import/usage-limit";
import { MAX_RESUME_FILE_BYTES, readResumeFile } from "lib/resume-import/read-resume-file";
import { API_URL } from "lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Never answer 502/504 from here: Cloudflare, which fronts this app, replaces an origin's 502/504 with its own "Bad gateway" page, so the person
// (and the browser's network tab) would never see our message or know which step failed. A failure of something we call is a 500 instead.
const fail = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status: status === 502 || status === 504 ? 500 : status });

type ListedResume = { id: string; name: string; url: string; contentType: string | null; source: string };

/**
 * POST `{ id }` with the signed-in person's bearer token. Reads one of THEIR OWN uploaded resumes back into the builder's shape, so they can
 * edit it: answers `{ resume, name }`.
 *
 * The file is found through the Job4online API with the person's own token (the list only holds their resumes, so someone else's id is a 404),
 * and opened through the API's signed link. The browser never fetches the file itself, so it needs no storage access, and no URL from the request
 * is ever fetched. Nothing is stored here; it costs the same AI call as an import and counts against the same allowance.
 */
export async function POST(req: Request) {
  const caller = await authorize(req);
  // Only a signed-in person has resumes of their own; the shared-secret caller has none.
  if (!caller || caller.kind !== "user") return fail("Sign in to edit a resume.", 401);
  const authorization = req.headers.get("authorization")!;

  const id = ((await req.json().catch(() => null)) as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !id) return fail("Choose a resume to edit.", 400);

  let resume: ListedResume | undefined;
  // A Blob, not a File: production runs Node 18, which has no global `File`, and the reader only needs the bytes and their size.
  let file: Blob;
  try {
    const list = await fetch(`${API_URL}/seeker/resumes`, { headers: { Authorization: authorization }, cache: "no-store" });
    if (list.status === 401 || list.status === 403) return fail("Sign in to edit a resume.", 401);
    if (!list.ok) return fail("We couldn't load your resumes. Please try again.", 502);
    resume = ((await list.json()) as ListedResume[]).find((r) => r.id === id && r.source === "Upload");
    if (!resume) return fail("We couldn't find that resume.", 404);

    const signed = await fetch(`${API_URL}/storage/signed-url?url=${encodeURIComponent(resume.url)}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!signed.ok) return fail("We couldn't open that resume. Please try again.", 502);
    const { url } = (await signed.json()) as { url?: string };
    if (!url) return fail("We couldn't open that resume. Please try again.", 502);

    const stored = await fetch(url, { cache: "no-store" });
    if (!stored.ok) return fail("We couldn't open that resume. Please try again.", 502);
    file = await stored.blob();
    if (file.size > MAX_RESUME_FILE_BYTES) return fail("This file is too large to edit. The limit is 5 MB.", 413);
  } catch (error) {
    // Logged so a failure here can be found in the server log instead of only showing the person a generic message.
    console.error("Could not load the resume to edit", error);
    return fail("We couldn't open that resume. Please try again.", 502);
  }

  const usage = startUsage(caller, "import");
  if (!usage.allowed) {
    return NextResponse.json({ error: usage.message }, { status: 429, headers: { "Retry-After": String(usage.retryAfterSeconds) } });
  }

  let refund = false;
  try {
    return NextResponse.json({ resume: await readResumeFile(file), name: resume.name });
  } catch (error) {
    // A failure on our side or the model's isn't the person's fault, so it doesn't use up their allowance.
    refund = error instanceof AiRequestError && error.status >= 500;
    if (error instanceof AiRequestError) return fail(error.message, error.status);
    console.error("Resume edit failed", error);
    return fail("We couldn't read this resume. Try another one.", 422);
  } finally {
    usage.done({ refund });
  }
}
