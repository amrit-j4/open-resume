/**
 * @jest-environment node
 */
import JSZip from "jszip";
import { POST } from "../route";
import { authorize } from "lib/resume-import/authorize";
import { resetUsage } from "lib/resume-import/usage-limit";
import { extractResumeWithAi, ResumeImportError } from "lib/resume-import/extract-with-ai";

jest.mock("../../../lib/resume-import/authorize", () => ({ authorize: jest.fn() }));
jest.mock("../../../lib/resume-import/extract-with-ai", () => {
  const actual = jest.requireActual("../../../lib/resume-import/extract-with-ai");
  return { ...actual, extractResumeWithAi: jest.fn() };
});

const authorized = authorize as jest.Mock;
const extract = extractResumeWithAi as jest.Mock;

const RESUME = { profile: { name: "Alex Morgan" } };

const upload = (content: BlobPart | null, name = "resume.pdf") => {
  const body = new FormData();
  if (content !== null) body.append("file", new File([content], name));
  return new Request("http://localhost/api/resume-import", { method: "POST", body });
};

const makeDocx = async (paragraph: string) => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p></w:body></w:document>`
  );
  return zip.generateAsync({ type: "uint8array" });
};

beforeEach(() => {
  resetUsage();
  authorized.mockReset().mockResolvedValue({ kind: "user", id: "user-1" });
  extract.mockReset().mockResolvedValue(RESUME);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("POST /api/resume-import", () => {
  test("answers 401 and reads nothing when the caller is not authorised", async () => {
    authorized.mockResolvedValue(null);

    const res = await POST(upload("%PDF-1.7 data"));

    expect(res.status).toBe(401);
    expect(extract).not.toHaveBeenCalled();
  });

  test("answers 429 with Retry-After once the daily limit is used, without calling the model", async () => {
    process.env.RESUME_IMPORT_DAILY_LIMIT = "1";
    expect((await POST(upload("%PDF-1.7 data"))).status).toBe(200);
    extract.mockClear();

    const res = await POST(upload("%PDF-1.7 data"));

    delete process.env.RESUME_IMPORT_DAILY_LIMIT;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).error).toContain("limit of 1 resume imports");
    expect(extract).not.toHaveBeenCalled();
  });

  test("answers 400 when the request has no file", async () => {
    const res = await POST(upload(null));
    expect(res.status).toBe(400);
  });

  test("answers 400 when the body is not a form", async () => {
    const res = await POST(new Request("http://localhost/api/resume-import", { method: "POST", body: "plain" }));
    expect(res.status).toBe(400);
  });

  test("answers 413 for a file over 5 MB", async () => {
    const res = await POST(upload(new Uint8Array(5 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect(extract).not.toHaveBeenCalled();
  });

  test("answers 415 for a file that is neither PDF nor Word, whatever its name says", async () => {
    const res = await POST(upload("just some text", "resume.pdf"));
    expect(res.status).toBe(415);
    expect(extract).not.toHaveBeenCalled();
  });

  test("sends a PDF to the model as is and returns the resume", async () => {
    const res = await POST(upload("%PDF-1.7 resume content"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ resume: RESUME });
    expect(extract).toHaveBeenCalledTimes(1);
    const source = extract.mock.calls[0][0];
    expect(source.kind).toBe("pdf");
    expect(source.data.toString()).toBe("%PDF-1.7 resume content");
  });

  test("reads the text of a Word file and sends it to the model", async () => {
    const docx = await makeDocx("Alex Morgan is a software engineer at Harbourview Digital since 2022.");

    const res = await POST(upload(docx, "resume.docx"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ resume: RESUME });
    const source = extract.mock.calls[0][0];
    expect(source.kind).toBe("text");
    expect(source.text).toContain("Alex Morgan is a software engineer");
  });

  test("answers 422 for a Word file with too little text", async () => {
    const docx = await makeDocx("Hi");

    const res = await POST(upload(docx, "resume.docx"));

    expect(res.status).toBe(422);
    expect(extract).not.toHaveBeenCalled();
  });

  test("answers 422 for a zip that is not a Word file", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "hello");
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const res = await POST(upload(bytes, "resume.docx"));

    expect(res.status).toBe(422);
    expect(extract).not.toHaveBeenCalled();
  });

  test("passes on the status and message of a model failure", async () => {
    extract.mockRejectedValue(new ResumeImportError("This feature isn't set up yet.", 503));

    const res = await POST(upload("%PDF-1.7 data"));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "This feature isn't set up yet." });
  });

  test("answers 422 without leaking details for an unexpected failure", async () => {
    extract.mockRejectedValue(new Error("secret internal detail"));

    const res = await POST(upload("%PDF-1.7 data"));

    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).not.toContain("secret internal detail");
  });
});
