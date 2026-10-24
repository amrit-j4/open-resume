import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ResumeAnalysisPage from "../page";
import { matchBand } from "../AnalysisReport";
import { getAccessToken } from "../../lib/auth-gate";
import { initialSettings } from "../../lib/redux/settingsSlice";
import { JOB_DESCRIPTION, RESUME } from "../../lib/resume-analysis/__fixtures__/analysis";
import type { ResumeAnalysisResult } from "../../lib/resume-analysis/types";

jest.mock("../../lib/auth-gate", () => ({ getAccessToken: jest.fn() }));

const token = getAccessToken as jest.Mock;
const fetchMock = jest.fn();

const STATE_KEY = "job4online-resume-state";
const BACKUP_KEY = "job4online-resume-backup";

const TAILORED = { ...RESUME, profile: { ...RESUME.profile, summary: "Reworded for the job." } };

const result = (overrides: Partial<ResumeAnalysisResult["analysis"]> = {}): ResumeAnalysisResult => ({
  analysis: {
    matchScore: 82,
    verdict: "Strong fit. Add the missing tools if you have used them.",
    job: { title: "Senior Data Analyst", company: "Northern Lights Energy" },
    matchedKeywords: ["Python", "SQL"],
    missingKeywords: [
      { keyword: "dbt", importance: "high", advice: "Mention it if you have used it." },
      { keyword: "Airflow", importance: "low", advice: "Worth learning." },
    ],
    strengths: ["Forecasting experience"],
    gaps: ["No Snowflake"],
    changes: [{ section: "summary", where: "Summary", before: RESUME.profile.summary, after: "Reworded for the job.", reason: "Targets the role" }],
    ...overrides,
  },
  resume: RESUME,
  tailoredResume: TAILORED,
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failed = (status: number, error: string) => ({ ok: false, status, json: async () => ({ error }) });

const pdf = (name = "resume.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const analyseButton = () => screen.getByRole("button", { name: /analyse resume|analysing/i });
const chooseFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });
const paste = (text = JOB_DESCRIPTION) => fireEvent.change(screen.getByLabelText("Job description"), { target: { value: text } });
const useLink = (url = "https://example.com/jobs/1") => {
  fireEvent.click(screen.getByRole("radio", { name: /link to the job/i }));
  fireEvent.change(screen.getByLabelText("Link to the job"), { target: { value: url } });
};
const saveBuilderResume = () =>
  localStorage.setItem(STATE_KEY, JSON.stringify({ resume: RESUME, settings: { ...initialSettings, themeColor: "#123456" } }));

const sentForm = () => fetchMock.mock.calls[0][1].body as FormData;

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("access-token");
  global.fetch = fetchMock as unknown as typeof fetch;
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe("the form", () => {
  test("starts on uploading a file, and offers the builder resume only when one is saved", () => {
    render(<ResumeAnalysisPage />);

    expect(screen.getByRole("radio", { name: /upload a file/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /use my builder resume/i })).toBeDisabled();
    expect(screen.getByText(/nothing saved in this browser yet/i)).toBeInTheDocument();
  });

  test("starts on the builder resume when one is saved", async () => {
    saveBuilderResume();
    render(<ResumeAnalysisPage />);

    await waitFor(() => expect(screen.getByRole("radio", { name: /use my builder resume/i })).toBeChecked());
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.queryByText(/drag and drop/i)).not.toBeInTheDocument();
  });

  test("ignores a saved builder resume that has nothing in it", () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ resume: { ...RESUME, profile: { ...RESUME.profile, name: "" }, workExperiences: [], educations: [], projects: [], skills: { featuredSkills: [], descriptions: [] } }, settings: initialSettings }));
    render(<ResumeAnalysisPage />);
    expect(screen.getByRole("radio", { name: /use my builder resume/i })).toBeDisabled();
  });

  test("shows what is wrong next to the fields, and sends nothing, when the form is incomplete", () => {
    render(<ResumeAnalysisPage />);

    fireEvent.click(analyseButton());

    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toEqual(expect.arrayContaining([expect.stringMatching(/choose your resume file/i), expect.stringMatching(/whole job description/i)]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
  });

  test("does not accept a job description that is only a few words", () => {
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    paste("Senior Data Analyst");

    fireEvent.click(analyseButton());

    expect(screen.getByRole("alert")).toHaveTextContent(/whole job description/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(["not a link", "example.com/jobs", "ftp://example.com/job", ""])("rejects %p as a link", (url) => {
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    useLink(url);

    fireEvent.click(analyseButton());

    expect(screen.getByRole("alert")).toHaveTextContent(/full link that starts with http/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects a file that is not a PDF or Word document", () => {
    render(<ResumeAnalysisPage />);

    chooseFile(new File(["hi"], "notes.txt"));

    expect(screen.getByRole("alert")).toHaveTextContent("Upload a PDF or Word (.docx) file.");
  });

  test("clears an error once the field is corrected", () => {
    render(<ResumeAnalysisPage />);
    fireEvent.click(analyseButton());
    expect(screen.getByText(/whole job description/i)).toBeInTheDocument();

    paste();

    expect(screen.queryByText(/whole job description/i)).not.toBeInTheDocument();
  });

  test("labels its inputs for assistive technology", () => {
    render(<ResumeAnalysisPage />);
    expect(screen.getByLabelText("Job description")).toHaveAttribute("name", "jobText");
    fireEvent.click(screen.getByRole("radio", { name: /link to the job/i }));
    const link = screen.getByLabelText("Link to the job");
    expect(link).toHaveAttribute("type", "url");
    expect(link).toHaveAttribute("inputmode", "url");
    expect(link).toHaveAttribute("spellcheck", "false");
  });
});

describe("analysing", () => {
  test("sends an uploaded file and pasted text with the access token, then shows the report", async () => {
    fetchMock.mockResolvedValue(ok(result()));
    render(<ResumeAnalysisPage />);
    const file = pdf();
    chooseFile(file);
    paste();

    fireEvent.click(analyseButton());

    expect(await screen.findByRole("heading", { name: "Your Resume Analysis" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/resume-analysis");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer access-token" });
    expect((sentForm().get("file") as File).name).toBe("resume.pdf");
    expect(sentForm().get("jobText")).toBe(JOB_DESCRIPTION);
    expect(sentForm().get("resume")).toBeNull();
    expect(sentForm().get("jobUrl")).toBeNull();
  });

  test("sends the builder's resume as JSON, and a link, when those are chosen", async () => {
    saveBuilderResume();
    fetchMock.mockResolvedValue(ok(result()));
    render(<ResumeAnalysisPage />);
    await waitFor(() => expect(screen.getByRole("radio", { name: /use my builder resume/i })).toBeChecked());
    useLink("https://example.com/jobs/1");

    fireEvent.click(analyseButton());

    await screen.findByRole("heading", { name: "Your Resume Analysis" });
    expect(JSON.parse(sentForm().get("resume") as string)).toEqual(RESUME);
    expect(sentForm().get("jobUrl")).toBe("https://example.com/jobs/1");
    expect(sentForm().get("file")).toBeNull();
    expect(sentForm().get("jobText")).toBeNull();
  });

  test("trims the link", async () => {
    fetchMock.mockResolvedValue(ok(result()));
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    useLink("  https://example.com/jobs/1  ");

    fireEvent.click(analyseButton());

    await screen.findByRole("heading", { name: "Your Resume Analysis" });
    expect(sentForm().get("jobUrl")).toBe("https://example.com/jobs/1");
  });

  test("shows a busy state, locks the form and offers Cancel while it works", async () => {
    let finish: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    paste();

    fireEvent.click(analyseButton());

    await waitFor(() => expect(analyseButton()).toHaveTextContent("Analysing…"));
    expect(analyseButton()).toBeDisabled();
    expect(screen.getByLabelText("Job description")).toBeDisabled();
    expect(screen.getByText(/30 to 60 seconds/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    finish(ok(result()));
    await screen.findByRole("heading", { name: "Your Resume Analysis" });
    expect(analyseButton()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  test("Cancel stops the request without showing an error", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))
    );
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    paste();
    fireEvent.click(analyseButton());
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(analyseButton()).toHaveTextContent("Analyse Resume"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("asks a signed-out visitor to sign in, without sending anything, and retries on request", async () => {
    token.mockResolvedValue(null);
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    paste();

    fireEvent.click(analyseButton());

    expect(await screen.findByText(/create a free .* account or sign in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    token.mockResolvedValue("fresh-token");
    fetchMock.mockResolvedValue(ok(result()));
    fireEvent.click(screen.getByRole("button", { name: /i.ve signed in/i }));

    await screen.findByRole("heading", { name: "Your Resume Analysis" });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer fresh-token" });
  });

  test("shows the server's message when the analysis fails, and lets the visitor try again", async () => {
    fetchMock.mockResolvedValue(failed(422, "We couldn't find a job description on that page. Paste the description instead."));
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    useLink();

    fireEvent.click(analyseButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/paste the description instead/i);
    expect(analyseButton()).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Your Resume Analysis" })).not.toBeInTheDocument();
  });

  test("tells the visitor when the server cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    paste();

    fireEvent.click(analyseButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the server/i);
  });

  test("treats an answer without a report as a failure", async () => {
    fetchMock.mockResolvedValue(ok({}));
    render(<ResumeAnalysisPage />);
    chooseFile(pdf());
    paste();

    fireEvent.click(analyseButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't analyse/i);
  });
});

describe("the report", () => {
  const analyse = async (analysis = result()) => {
    fetchMock.mockResolvedValue(ok(analysis));
    render(<ResumeAnalysisPage />);
    fireEvent.click(screen.getByRole("radio", { name: /upload a file/i })); // a saved builder resume would otherwise be preselected
    chooseFile(pdf());
    paste();
    fireEvent.click(analyseButton());
    await screen.findByRole("heading", { name: "Your Resume Analysis" });
  };

  test("shows the score in numbers and words, the job and the verdict", async () => {
    await analyse();

    expect(screen.getByRole("img", { name: "Match score 82 out of 100: Strong match" })).toBeInTheDocument();
    expect(screen.getByText("Strong match")).toBeInTheDocument();
    expect(screen.getByText("For Senior Data Analyst at Northern Lights Energy")).toBeInTheDocument();
    expect(screen.getByText(/add the missing tools/i)).toBeInTheDocument();
  });

  test("moves keyboard focus to the report", async () => {
    await analyse();
    expect(screen.getByRole("heading", { name: "Your Resume Analysis" })).toHaveFocus();
  });

  test("lists matched and missing keywords, with a plain-text priority and the advice", async () => {
    await analyse();

    expect(screen.getByText("Python")).toBeInTheDocument();
    const dbt = screen.getByText("dbt").closest("li")!;
    expect(within(dbt).getByText("High priority")).toBeInTheDocument();
    expect(within(dbt).getByText("Mention it if you have used it.")).toBeInTheDocument();
    expect(within(screen.getByText("Airflow").closest("li")!).getByText("Low priority")).toBeInTheDocument();
    expect(screen.getByText(/add one only if it.s true/i)).toBeInTheDocument();
  });

  test("shows strengths, gaps and each suggested change with its before, after and reason", async () => {
    await analyse();

    expect(screen.getByText("Forecasting experience")).toBeInTheDocument();
    expect(screen.getByText("No Snowflake")).toBeInTheDocument();
    const change = screen.getByText("Targets the role").closest("li")!;
    expect(within(change).getByText(RESUME.profile.summary)).toBeInTheDocument();
    expect(within(change).getByText("Reworded for the job.")).toBeInTheDocument();
  });

  test("says so when nothing needs changing, or nothing is missing", async () => {
    await analyse(result({ changes: [], missingKeywords: [], matchedKeywords: [], strengths: [], gaps: [] }));

    expect(screen.getByText(/no wording changes are suggested/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing important is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/none of the job.s keywords were found/i)).toBeInTheDocument();
  });

  test("warns that a weak match can only be reworded", async () => {
    await analyse(result({ matchScore: 12 }));
    expect(screen.getByText("Weak match")).toBeInTheDocument();
    expect(screen.getByText(/weak match, and tailoring can only reword/i)).toBeInTheDocument();
  });

  describe("applying the tailored resume", () => {
    const original = { resume: RESUME, settings: { ...initialSettings, themeColor: "#123456" } };

    test("asks before replacing, and Cancel changes nothing", async () => {
      saveBuilderResume();
      await analyse();

      fireEvent.click(screen.getByRole("button", { name: "Apply to Resume Builder" }));
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/replaces the resume in the builder/i);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
      expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    });

    test("loads the tailored resume, keeps the person's settings and backs up the old resume", async () => {
      saveBuilderResume();
      await analyse();

      fireEvent.click(screen.getByRole("button", { name: "Apply to Resume Builder" }));
      fireEvent.click(screen.getByRole("button", { name: "Replace My Resume" }));

      expect(await screen.findByText("Loaded into the resume builder")).toBeInTheDocument();
      const saved = JSON.parse(localStorage.getItem(STATE_KEY)!);
      expect(saved.resume).toEqual(TAILORED);
      expect(saved.settings.themeColor).toBe("#123456");
      expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!).state).toEqual(original);
      expect(screen.getByRole("link", { name: "Open Resume Builder" })).toHaveAttribute("href", "/resume-builder");
    });

    test("Undo puts the old resume back", async () => {
      saveBuilderResume();
      await analyse();
      fireEvent.click(screen.getByRole("button", { name: "Apply to Resume Builder" }));
      fireEvent.click(screen.getByRole("button", { name: "Replace My Resume" }));

      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
      expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
      expect(screen.getByRole("button", { name: "Apply to Resume Builder" })).toBeInTheDocument();
    });

    test("works when the builder had nothing saved, with no Undo to offer", async () => {
      await analyse();

      fireEvent.click(screen.getByRole("button", { name: "Apply to Resume Builder" }));
      fireEvent.click(screen.getByRole("button", { name: "Replace My Resume" }));

      expect(await screen.findByText("Loaded into the resume builder")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!).resume).toEqual(TAILORED);
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    });
  });
});

describe("matchBand", () => {
  test.each([
    [100, "Strong match"],
    [75, "Strong match"],
    [74, "Good match"],
    [55, "Good match"],
    [54, "Partial match"],
    [30, "Partial match"],
    [29, "Weak match"],
    [0, "Weak match"],
  ])("a score of %i is a %s", (score, label) => {
    expect(matchBand(score).label).toBe(label);
  });
});
