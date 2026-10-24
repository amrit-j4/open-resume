import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ResumeAnalysisPage from "../page";
import { matchBand } from "../AnalysisReport";
import { getAccessToken } from "../../lib/auth-gate";
import { initialSettings } from "../../lib/redux/settingsSlice";
import { applyEdits } from "../../lib/resume-analysis/apply-edits";
import { JOB_DESCRIPTION, RESUME } from "../../lib/resume-analysis/__fixtures__/analysis";
import type { ResumeAnalysisResult, ResumeEdit } from "../../lib/resume-analysis/types";

jest.mock("../../lib/auth-gate", () => ({ getAccessToken: jest.fn() }));
// The real preview builds a PDF with pdf.js, which needs a browser. This stand-in shows what it would be given.
jest.mock("../ResumeLivePreview", () => ({
  ResumeLivePreview: ({ resume, settings }: { resume: typeof RESUME; settings: { themeColor: string } }) => (
    <div data-testid="preview" data-color={settings.themeColor}>
      <p data-testid="preview-summary">{resume.profile.summary}</p>
      <p data-testid="preview-bullets">{resume.workExperiences[0].descriptions.join(" | ")}</p>
      <p data-testid="preview-skills">{resume.skills.descriptions.join(" | ")}</p>
    </div>
  ),
}));

const token = getAccessToken as jest.Mock;
const fetchMock = jest.fn();

const STATE_KEY = "job4online-resume-state";
const BACKUP_KEY = "job4online-resume-backup";

const EDITS: ResumeEdit[] = [
  { id: "edit-1", kind: "replace", section: "summary", where: "Summary", before: RESUME.profile.summary, after: "Reworded for the job.", reason: "Targets the role" },
  {
    id: "edit-2",
    kind: "replace",
    section: "workExperiences",
    entryIndex: 0,
    bulletIndex: 1,
    where: "Brightwave Retail",
    before: "Led a team of 4 analysts",
    after: "Led a team of 4 analysts, mentoring juniors",
    reason: "Shows the mentoring the job wants",
  },
  { id: "edit-3", kind: "replace", section: "skills", bulletIndex: 0, where: "Skills", before: "Tableau, Forecasting", after: "Forecasting, Tableau", reason: "Leads with what the job values" },
];

const BREAKDOWN = [
  { key: "skills", label: "Required skills", score: 34, max: 40, note: "No audio middleware." },
  { key: "experience", label: "Experience fit", score: 18, max: 25, note: "" },
  { key: "keywords", label: "Job keywords", score: 18, max: 20, note: "" },
  { key: "education", label: "Education and certifications", score: 8, max: 10, note: "" },
  { key: "clarity", label: "Clarity and results", score: 4, max: 5, note: "" },
] as ResumeAnalysisResult["analysis"]["breakdown"];

const result = (overrides: Partial<ResumeAnalysisResult["analysis"]> = {}): ResumeAnalysisResult => {
  const edits = overrides.edits ?? EDITS;
  return {
    analysis: {
      matchScore: 82,
      breakdown: BREAKDOWN,
      editNote: "",
      verdict: "Strong fit. Add the missing tools if you have used them.",
      job: { title: "Senior Data Analyst", company: "Northern Lights Energy" },
      matchedKeywords: ["Python", "SQL"],
      missingKeywords: [
        { keyword: "dbt", importance: "high", advice: "Mention it if you have used it." },
        { keyword: "Airflow", importance: "low", advice: "Worth learning." },
      ],
      strengths: ["Forecasting experience"],
      gaps: ["No Snowflake"],
      ...overrides,
      edits,
    } as ResumeAnalysisResult["analysis"],
    resume: RESUME,
    tailoredResume: applyEdits(RESUME, edits),
  };
};

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

describe("the workspace", () => {
  const original = { resume: RESUME, settings: { ...initialSettings, themeColor: "#123456" } };
  const [FORECAST, LED] = RESUME.workExperiences[0].descriptions;

  /** The analysis opens on the report. Most tests work in the editor, so this switches to it unless told not to. */
  const analyse = async (analysis = result(), { editor = true } = {}) => {
    fetchMock.mockResolvedValue(ok(analysis));
    render(<ResumeAnalysisPage />);
    fireEvent.click(screen.getByRole("radio", { name: /upload a file/i })); // a saved builder resume would otherwise be preselected
    chooseFile(pdf());
    paste();
    fireEvent.click(analyseButton());
    await screen.findByRole("heading", { name: "Your Resume Analysis" });
    if (editor) fireEvent.click(screen.getByRole("tab", { name: "Edit Resume" }));
  };

  /** The card for the suggestion with this reason. */
  const card = (reason: string) => screen.getByText(reason).closest("li") as HTMLElement;
  const accept = (reason: string, label = "Accept") => fireEvent.click(within(card(reason)).getByRole("button", { name: label }));
  const preview = (id: "summary" | "bullets" | "skills") => screen.getByTestId(`preview-${id}`).textContent;
  const count = () => screen.getByTestId("decision-count").textContent;
  const objective = () => screen.getByLabelText("Objective") as HTMLTextAreaElement;
  /** Types into the bullets box the way a browser does: its HTML changes, and the lines can be read back from it. */
  const typeBullets = (lines: string[]) => {
    const box = description();
    box.innerHTML = lines.map((line) => `<div>${line}</div>`).join("");
    Object.defineProperty(box, "innerText", { configurable: true, value: lines.join("\n") });
    fireEvent.input(box);
  };
  const applyPanel = () => within(document.getElementById("panel-preview")!);
  const description = () => screen.getAllByText((_, el) => el?.getAttribute("contenteditable") === "true")[0];

  const SUMMARY_REASON = "Targets the role";
  const BULLET_REASON = "Shows the mentoring the job wants";
  const SKILLS_REASON = "Leads with what the job values";

  describe("the layout", () => {
    test("replaces the form, and moves keyboard focus to the heading", async () => {
      await analyse();
      expect(screen.getByRole("heading", { name: "Your Resume Analysis" })).toHaveFocus();
      expect(screen.queryByLabelText("Job description")).not.toBeInTheDocument();
      expect(screen.getByText("For Senior Data Analyst at Northern Lights Energy")).toBeInTheDocument();
    });

    test("opens on the report, with Edit Resume as the next tab", async () => {
      await analyse(result(), { editor: false });

      const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
      expect(tabs.slice(0, 2)).toEqual(["Report", "Edit Resume"]);
      expect(screen.getByRole("tab", { name: "Report" })).toHaveAttribute("aria-selected", "true");
      expect(document.getElementById("panel-report")).toBeInTheDocument();
    });

    test("the Edit Resume tab shows the resume itself, with the builder's own fields filled in", async () => {
      await analyse();

      expect(screen.getByRole("tab", { name: "Edit Resume" })).toHaveAttribute("aria-selected", "true");
      expect(objective()).toHaveValue(RESUME.profile.summary);
      expect(screen.getByLabelText("Name")).toHaveValue("Priya Nair");
      expect(screen.getByDisplayValue("Brightwave Retail")).toBeInTheDocument();
      expect(description()).toHaveTextContent(FORECAST);
      expect(description()).toHaveTextContent(LED);
    });

    test("shows the live preview beside it, as the resume is now", async () => {
      await analyse();
      expect(preview("summary")).toBe(RESUME.profile.summary);
      expect(preview("bullets")).toBe(RESUME.workExperiences[0].descriptions.join(" | "));
    });

    test("uses the template and colours already chosen in the builder", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      expect(screen.getByTestId("preview")).toHaveAttribute("data-color", "#123456");
    });

    test("falls back to the default look when the builder has nothing saved", async () => {
      await analyse();
      expect(screen.getByTestId("preview")).toHaveAttribute("data-color", initialSettings.themeColor);
    });

    test("shows the score and what is left to review", async () => {
      await analyse();
      expect(screen.getByText(/82/)).toBeInTheDocument();
      expect(screen.getByText(/Strong match/)).toBeInTheDocument();
      expect(count()).toBe("3 to review, 0 accepted, 0 dismissed");
    });

    test("on a narrow screen the resume, the report and the preview share the space behind tabs", async () => {
      await analyse();
      const preview = screen.getByRole("tab", { name: "Live Preview" });

      fireEvent.click(preview);

      expect(preview).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "Edit Resume" })).toHaveAttribute("aria-selected", "false");
      expect(document.getElementById("panel-preview")).toHaveAttribute("role", "tabpanel");
      expect(document.getElementById("panel-preview")).not.toHaveClass("max-lg:hidden");
    });
  });

  describe("the report tab", () => {
    test("shows the verdict, where the score comes from, the keywords, strengths and gaps", async () => {
      await analyse();
      fireEvent.click(screen.getByRole("tab", { name: "Report" }));

      expect(screen.getByText(/add the missing tools/i)).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Match score 82 out of 100: Strong match" })).toBeInTheDocument();
      expect(screen.getByText("Where the Score Comes From")).toBeInTheDocument();
      const skills = screen.getByRole("meter", { name: "Required skills" });
      expect(skills).toHaveAttribute("aria-valuenow", "34");
      expect(skills).toHaveAttribute("aria-valuemax", "40");
      expect(screen.getByText("34 / 40")).toBeInTheDocument();
      expect(screen.getByText("No audio middleware.")).toBeInTheDocument();
      expect(screen.getAllByRole("meter")).toHaveLength(5);
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("Forecasting experience")).toBeInTheDocument();
      expect(screen.getByText("No Snowflake")).toBeInTheDocument();
    });

    test("lists missing keywords with a plain-text priority and the advice", async () => {
      await analyse();
      fireEvent.click(screen.getByRole("tab", { name: "Report" }));

      const dbt = screen.getByText("dbt").closest("li")!;
      expect(within(dbt).getByText("High priority")).toBeInTheDocument();
      expect(within(dbt).getByText("Mention it if you have used it.")).toBeInTheDocument();
      expect(within(screen.getByText("Airflow").closest("li")!).getByText("Low priority")).toBeInTheDocument();
      expect(screen.getByText(/add one only if it.s true/i)).toBeInTheDocument();
    });

    test("leaves the breakdown out when there isn't one", async () => {
      await analyse(result({ breakdown: [] }));
      fireEvent.click(screen.getByRole("tab", { name: "Report" }));
      expect(screen.queryByText("Where the Score Comes From")).not.toBeInTheDocument();
    });

    test("says so when nothing is missing", async () => {
      await analyse(result({ missingKeywords: [], matchedKeywords: [], strengths: [], gaps: [] }));
      fireEvent.click(screen.getByRole("tab", { name: "Report" }));
      expect(screen.getByText(/nothing important is missing/i)).toBeInTheDocument();
      expect(screen.getByText(/none of the job.s keywords were found/i)).toBeInTheDocument();
    });

    test("the suggestions are not repeated here: they are in the resume", async () => {
      await analyse();
      fireEvent.click(screen.getByRole("tab", { name: "Report" }));
      expect(screen.queryByText(SUMMARY_REASON)).not.toBeInTheDocument();
    });
  });

  describe("suggestions under their fields", () => {
    test("each suggestion sits under the field it is about", async () => {
      await analyse();

      const summaryField = objective().closest("label")!.parentElement!;
      expect(within(summaryField).getByText(SUMMARY_REASON)).toBeInTheDocument();
      expect(within(summaryField).queryByText(BULLET_REASON)).not.toBeInTheDocument();

      const job = screen.getByDisplayValue("Brightwave Retail").closest("div")!.parentElement!;
      expect(within(job).getByText(BULLET_REASON)).toBeInTheDocument();
      expect(within(job).queryByText(SUMMARY_REASON)).not.toBeInTheDocument();

      expect(screen.getByText(SKILLS_REASON)).toBeInTheDocument();
    });

    test("a waiting suggestion shows the current text, an editable new version and why", async () => {
      await analyse();

      const c = card(BULLET_REASON);
      expect(within(c).getByText("Suggested rewording")).toBeInTheDocument();
      expect(within(c).getByText(LED)).toBeInTheDocument();
      expect(within(c).getByLabelText("New wording")).toHaveValue("Led a team of 4 analysts, mentoring juniors");
      expect(within(c).getByRole("button", { name: "Accept" })).toBeInTheDocument();
      expect(within(c).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    });

    test("nothing changes until a suggestion is accepted", async () => {
      await analyse();
      expect(objective()).toHaveValue(RESUME.profile.summary);
      expect(preview("summary")).toBe(RESUME.profile.summary);
      expect(count()).toBe("3 to review, 0 accepted, 0 dismissed");
    });
  });

  describe("accepting", () => {
    test("accepting puts the new wording into the field and the preview, and nowhere else", async () => {
      await analyse();

      accept(SUMMARY_REASON);

      expect(objective()).toHaveValue("Reworded for the job.");
      expect(preview("summary")).toBe("Reworded for the job.");
      expect(preview("bullets")).toBe(RESUME.workExperiences[0].descriptions.join(" | "));
      expect(preview("skills")).toBe("Tableau, Forecasting");
      expect(count()).toBe("2 to review, 1 accepted, 0 dismissed");
    });

    test("accepting a bullet rewords just that line in the field and the preview", async () => {
      await analyse();

      accept(BULLET_REASON);

      expect(description()).toHaveTextContent("Led a team of 4 analysts, mentoring juniors");
      expect(description()).toHaveTextContent(FORECAST);
      expect(preview("bullets")).toBe(`${FORECAST} | Led a team of 4 analysts, mentoring juniors`);
    });

    test("an accepted suggestion turns into a note with an Undo", async () => {
      await analyse();

      accept(SUMMARY_REASON);

      expect(screen.queryByText(SUMMARY_REASON)).not.toBeInTheDocument();
      expect(screen.getByText(/Accepted:/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    });

    test("the new wording can be changed first, and what is in the box is what goes in", async () => {
      await analyse();
      const c = card(SUMMARY_REASON);

      fireEvent.change(within(c).getByLabelText("New wording"), { target: { value: "  My own better summary.  " } });
      fireEvent.click(within(c).getByRole("button", { name: "Accept" }));

      expect(objective()).toHaveValue("My own better summary.");
      expect(preview("summary")).toBe("My own better summary.");
    });

    test("an empty box can't be accepted", async () => {
      await analyse();
      const c = card(SUMMARY_REASON);

      fireEvent.change(within(c).getByLabelText("New wording"), { target: { value: "   " } });

      expect(within(c).getByRole("button", { name: "Accept" })).toBeDisabled();
    });

    test("Accept All takes every suggestion, in any combination of places", async () => {
      await analyse();

      fireEvent.click(screen.getByRole("button", { name: "Accept All" }));

      expect(objective()).toHaveValue("Reworded for the job.");
      expect(description()).toHaveTextContent("Led a team of 4 analysts, mentoring juniors");
      expect(preview("skills")).toBe("Forecasting, Tableau");
      expect(count()).toBe("0 to review, 3 accepted, 0 dismissed");
      expect(screen.getByRole("button", { name: "Accept All" })).toBeDisabled();
    });
  });

  describe("undoing", () => {
    test("Undo puts the original wording back in the field and the preview", async () => {
      await analyse();
      accept(BULLET_REASON);

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(preview("bullets")).toBe(RESUME.workExperiences[0].descriptions.join(" | "));
      expect(description()).not.toHaveTextContent("mentoring juniors");
      expect(screen.getByText(BULLET_REASON)).toBeInTheDocument(); // it is waiting again
      expect(count()).toBe("3 to review, 0 accepted, 0 dismissed");
    });

    test("only the undone suggestion is undone", async () => {
      await analyse();
      accept(SUMMARY_REASON);
      accept(BULLET_REASON);

      // The summary comes first in the form, so its Undo is the first one.
      fireEvent.click(within(document.getElementById("panel-edit")!).getAllByRole("button", { name: "Undo" })[0]);

      expect(preview("summary")).toBe(RESUME.profile.summary);
      expect(preview("bullets")).toContain("mentoring juniors");
    });
  });

  describe("dismissing", () => {
    test("a dismissed suggestion goes away, and the resume is untouched", async () => {
      await analyse();

      fireEvent.click(within(card(SUMMARY_REASON)).getByRole("button", { name: "Dismiss" }));

      expect(screen.queryByText(SUMMARY_REASON)).not.toBeInTheDocument();
      expect(objective()).toHaveValue(RESUME.profile.summary);
      expect(count()).toBe("2 to review, 0 accepted, 1 dismissed");
    });

    test("it can be shown again and restored", async () => {
      await analyse();
      fireEvent.click(within(card(SUMMARY_REASON)).getByRole("button", { name: "Dismiss" }));

      fireEvent.click(screen.getByRole("button", { name: "Show 1 dismissed" }));
      fireEvent.click(screen.getByRole("button", { name: "Restore" }));

      expect(screen.getByText(SUMMARY_REASON)).toBeInTheDocument();
      expect(count()).toBe("3 to review, 0 accepted, 0 dismissed");
    });

    test("Dismiss All clears everything that is waiting, but not what was accepted", async () => {
      await analyse();
      accept(SUMMARY_REASON);

      fireEvent.click(screen.getByRole("button", { name: "Dismiss All" }));

      expect(count()).toBe("0 to review, 1 accepted, 2 dismissed");
      expect(objective()).toHaveValue("Reworded for the job.");
    });
  });

  describe("suggestions that add something new", () => {
    const NEW_BULLET = "Mentored junior analysts on forecasting";
    const ADD_REASON = "The job wants mentoring";
    const withAdd = (): ResumeAnalysisResult =>
      result({
        edits: [
          EDITS[0],
          {
            id: "edit-2",
            kind: "add",
            section: "workExperiences",
            entryIndex: 0,
            bulletIndex: 2,
            where: "Brightwave Retail",
            before: "",
            after: NEW_BULLET,
            reason: ADD_REASON,
            basedOn: 'The summary says "mentors analysts"',
          },
        ],
      });

    test("is offered as a new line, with what it is based on", async () => {
      await analyse(withAdd());

      const c = card(ADD_REASON);
      expect(within(c).getByText("Suggested new line")).toBeInTheDocument();
      expect(within(c).getByLabelText("New line to add")).toHaveValue(NEW_BULLET);
      expect(within(c).getByText(/based on your resume:/i)).toBeInTheDocument();
      expect(within(c).getByText(/mentors analysts/)).toBeInTheDocument();
      expect(within(c).getByRole("button", { name: "Add It" })).toBeInTheDocument();
      expect(within(c).queryByText(/^Now/)).not.toBeInTheDocument();
    });

    test("adding it puts the new line at the end of the job's bullets, in the field and the preview", async () => {
      await analyse(withAdd());

      accept(ADD_REASON, "Add It");

      expect(description()).toHaveTextContent(NEW_BULLET);
      expect(preview("bullets")).toBe(`${FORECAST} | ${LED} | ${NEW_BULLET}`);
      expect(screen.getByText(/Added:/)).toBeInTheDocument();
    });

    test("Undo takes it out again", async () => {
      await analyse(withAdd());
      accept(ADD_REASON, "Add It");

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(preview("bullets")).toBe(RESUME.workExperiences[0].descriptions.join(" | "));
    });
  });

  describe("when the person edits the resume themselves", () => {
    test("typing in a field changes the preview straight away", async () => {
      await analyse();

      fireEvent.change(objective(), { target: { value: "Typed by hand." } });

      expect(preview("summary")).toBe("Typed by hand.");
    });

    test("a suggestion for a line that was reworded by hand no longer fits, and says so", async () => {
      await analyse();
      typeBullets([FORECAST, "Led a completely different team"]);

      expect(screen.queryByText(BULLET_REASON)).not.toBeInTheDocument();
      expect(screen.getByText(/you.ve changed this line since the analysis/i)).toBeInTheDocument();
      expect(count()).toBe("2 to review, 0 accepted, 0 dismissed");
    });

    test("a suggestion still finds its line when other lines were added above it", async () => {
      await analyse();
      typeBullets(["A new first line", FORECAST, LED]);

      accept(BULLET_REASON);

      expect(preview("bullets")).toBe(`A new first line | ${FORECAST} | Led a team of 4 analysts, mentoring juniors`);
    });
  });

  describe("applying to the builder", () => {
    const apply = () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply to Resume Builder" }));
      fireEvent.click(screen.getByRole("button", { name: "Replace My Resume" }));
    };

    test("the builder's saved resume is not touched while reviewing", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();

      accept(SUMMARY_REASON);
      fireEvent.change(objective(), { target: { value: "Typed by hand." } });

      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
      expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    });

    test("is switched off until the resume has changed, and says how many suggestions were accepted", async () => {
      await analyse();
      expect(screen.getByRole("button", { name: "Apply to Resume Builder" })).toBeDisabled();
      expect(screen.getByText(/accept a suggestion, or edit your resume/i)).toBeInTheDocument();
      expect(screen.getByText(/suggestions accepted/)).toBeInTheDocument();

      accept(SUMMARY_REASON);

      expect(screen.getByRole("button", { name: "Apply to Resume Builder" })).toBeEnabled();
      expect(screen.getByText(/suggestion accepted/)).toBeInTheDocument();
    });

    test("typing in the form is enough to apply", async () => {
      await analyse();
      fireEvent.change(objective(), { target: { value: "Typed by hand." } });
      expect(screen.getByRole("button", { name: "Apply to Resume Builder" })).toBeEnabled();
    });

    test("asks before replacing, and Cancel changes nothing", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(SUMMARY_REASON);

      fireEvent.click(screen.getByRole("button", { name: "Apply to Resume Builder" }));
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/replaces the resume in the builder/i);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
    });

    test("loads the resume as it is now, accepted suggestions and hand edits together, and keeps the person's settings", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(BULLET_REASON);
      fireEvent.change(objective(), { target: { value: "Typed by hand." } });

      apply();

      expect(await screen.findByText("Loaded into the resume builder")).toBeInTheDocument();
      const saved = JSON.parse(localStorage.getItem(STATE_KEY)!);
      expect(saved.resume.profile.summary).toBe("Typed by hand.");
      expect(saved.resume.workExperiences[0].descriptions).toEqual([FORECAST, "Led a team of 4 analysts, mentoring juniors"]);
      expect(saved.settings.themeColor).toBe("#123456");
      expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!).state).toEqual(original);
      expect(screen.getByRole("link", { name: "Open Resume Builder" })).toHaveAttribute("href", "/resume-builder");
    });

    test("Undo puts the old resume back", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(SUMMARY_REASON);
      apply();

      fireEvent.click(await applyPanel().findByRole("button", { name: "Undo" }));

      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
      expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    });

    test("changing the resume after applying offers to apply again, and Undo still leads back to the original resume", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(SUMMARY_REASON);
      apply();
      await screen.findByText("Loaded into the resume builder");

      accept(BULLET_REASON);
      expect(screen.queryByText("Loaded into the resume builder")).not.toBeInTheDocument();
      apply();

      expect(JSON.parse(localStorage.getItem(STATE_KEY)!).resume.workExperiences[0].descriptions[1]).toContain("mentoring juniors");
      fireEvent.click(await applyPanel().findByRole("button", { name: "Undo" }));
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
    });

    test("works when the builder had nothing saved, though there is nothing to Undo to", async () => {
      await analyse();
      accept(SUMMARY_REASON);

      apply();

      expect(await screen.findByText("Loaded into the resume builder")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!).resume.profile.summary).toBe("Reworded for the job.");
    });
  });

  describe("moving around", () => {
    test("Change Resume or Job goes back to the form with everything still filled in", async () => {
      await analyse();

      fireEvent.click(screen.getByRole("button", { name: /change resume or job/i }));

      expect(screen.getByLabelText("Job description")).toHaveValue(JOB_DESCRIPTION);
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Your Resume Analysis" })).not.toBeInTheDocument();
    });

    test("a new analysis starts fresh, with nothing accepted and the resume as read", async () => {
      await analyse();
      accept(SUMMARY_REASON);
      fireEvent.click(screen.getByRole("button", { name: /change resume or job/i }));

      fetchMock.mockResolvedValue(ok(result()));
      fireEvent.click(analyseButton());
      await screen.findByRole("heading", { name: "Your Resume Analysis" });
      fireEvent.click(screen.getByRole("tab", { name: "Edit Resume" }));

      expect(count()).toBe("3 to review, 0 accepted, 0 dismissed");
      expect(objective()).toHaveValue(RESUME.profile.summary);
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
