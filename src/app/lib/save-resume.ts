import { API_URL } from "lib/site-config";

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

  const res = await fetch(`${API_URL}/files`, {
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
