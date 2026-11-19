import { API_URL } from "lib/site-config";

/**
 * Replaces the file of one of the signed-in seeker's existing resumes with the generated PDF (the "edit resume" flow). The resume keeps its place
 * and name in their list; the API embeds the new file again for job matching. Throws with a message that is safe to show.
 */
export const replaceResumeInAccount = async (
  pdfUrl: string,
  resumeId: string,
  accessToken: string
): Promise<void> => {
  const blob = await (await fetch(pdfUrl)).blob();

  const body = new FormData();
  // The API keeps the resume's own name; the file name here only has to be a PDF's.
  body.append("file", new File([blob], "resume.pdf", { type: "application/pdf" }));

  const res = await fetch(`${API_URL}/seeker/resumes/${encodeURIComponent(resumeId)}/file`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Your session has expired. Sign in again and retry."
        : res.status === 404
          ? "This resume is no longer in your account. Choose Stop editing to save it as a new resume instead."
          : "We couldn't update your resume. Please try again."
    );
  }
};

/**
 * Saves the generated PDF to the signed-in seeker's Job4online resumes. `purpose=Resume` makes the API file it as a resume and build its
 * embedding for job matching before it answers. Throws with a message that is safe to show.
 */
export const saveResumeToAccount = async (
  pdfUrl: string,
  fileName: string,
  accessToken: string
): Promise<void> => {
  const blob = await (await fetch(pdfUrl)).blob();
  const name = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  const body = new FormData();
  body.append("file", new File([blob], name, { type: "application/pdf" }));
  body.append("kind", "Document");
  body.append("purpose", "Resume");

  const res = await fetch(`${API_URL}/storage/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Your session has expired. Sign in again and retry."
        : "We couldn't save your resume. Please try again."
    );
  }
};
