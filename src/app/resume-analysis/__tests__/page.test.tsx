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
      <p data-testid="preview-bullet">{resume.workExperiences[0].descriptions[1]}</p>
      <p data-testid="preview-skills">{resume.skills.descriptions[0]}</p>
      <p data-testid="preview-count">{resume.workExperiences[0].descriptions.length}</p>
      <p data-testid="preview-last">{resume.workExperiences[0].descriptions[resume.workExperiences[0].descriptions.length - 1]}</p>
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

  const analyse = async (analysis = result()) => {
    fetchMock.mockResolvedValue(ok(analysis));
    render(<ResumeAnalysisPage />);
    fireEvent.click(screen.getByRole("radio", { name: /upload a file/i })); // a saved builder resume would otherwise be preselected
    chooseFile(pdf());
    paste();
    fireEvent.click(analyseButton());
    await screen.findByRole("heading", { name: "Your Resume Analysis" });
  };

  const accept = (n: number) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Accept suggestion ${n}:`) }));
  const reject = (n: number) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Reject suggestion ${n}:`) }));
  const summary = () => screen.getByTestId("preview-summary").textContent;
  const bullet = () => screen.getByTestId("preview-bullet").textContent;
  const skills = () => screen.getByTestId("preview-skills").textContent;
  const count = () => screen.getByTestId("decision-count").textContent;

  describe("the report", () => {
    test("shows the score in numbers and words, the job and the verdict", async () => {
      await analyse();

      expect(screen.getByRole("img", { name: "Match score 82 out of 100: Strong match" })).toBeInTheDocument();
      expect(screen.getByText("Strong match")).toBeInTheDocument();
      expect(screen.getByText("For Senior Data Analyst at Northern Lights Energy")).toBeInTheDocument();
      expect(screen.getByText(/add the missing tools/i)).toBeInTheDocument();
    });

    test("replaces the form, and moves keyboard focus to the report", async () => {
      await analyse();
      expect(screen.getByRole("heading", { name: "Your Resume Analysis" })).toHaveFocus();
      expect(screen.queryByLabelText("Job description")).not.toBeInTheDocument();
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

    test("shows where the score comes from, each part with what it is worth and why points were lost", async () => {
      await analyse();

      expect(screen.getByText("Where the Score Comes From")).toBeInTheDocument();
      const skills = screen.getByRole("meter", { name: "Required skills" });
      expect(skills).toHaveAttribute("aria-valuenow", "34");
      expect(skills).toHaveAttribute("aria-valuemax", "40");
      expect(screen.getByText("34 / 40")).toBeInTheDocument();
      expect(screen.getByText("No audio middleware.")).toBeInTheDocument();
      expect(screen.getAllByRole("meter")).toHaveLength(5);
    });

    test("leaves the breakdown out when there isn't one", async () => {
      await analyse(result({ breakdown: [] }));
      expect(screen.queryByText("Where the Score Comes From")).not.toBeInTheDocument();
      expect(screen.queryAllByRole("meter")).toHaveLength(0);
    });

    test("explains above the suggestions what wording can and can't do, when the model says so", async () => {
      await analyse(result({ matchScore: 43, editNote: "Wording can fix the keywords, but not a gap in seniority." }));
      expect(screen.getByTestId("edit-note")).toHaveTextContent("Wording can fix the keywords, but not a gap in seniority.");
    });

    test("shows no note when there is none", async () => {
      await analyse();
      expect(screen.queryByTestId("edit-note")).not.toBeInTheDocument();
    });

    test("shows strengths and gaps", async () => {
      await analyse();
      expect(screen.getByText("Forecasting experience")).toBeInTheDocument();
      expect(screen.getByText("No Snowflake")).toBeInTheDocument();
    });

    test("says so when nothing needs changing, or nothing is missing", async () => {
      await analyse(result({ edits: [], missingKeywords: [], matchedKeywords: [], strengths: [], gaps: [] }));

      expect(screen.getByText(/no wording changes are suggested/i)).toBeInTheDocument();
      expect(screen.getByText(/nothing important is missing/i)).toBeInTheDocument();
      expect(screen.getByText(/none of the job.s keywords were found/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /apply .*to resume builder/i })).toBeDisabled();
    });
  });

  describe("accepting and rejecting suggestions", () => {
    test("shows each suggestion with its place, before, after and reason, none decided yet", async () => {
      await analyse();

      const second = screen.getByText("Shows the mentoring the job wants").closest("li")!;
      expect(within(second).getByText(/Work experience . Brightwave Retail/)).toBeInTheDocument();
      expect(within(second).getByText("Led a team of 4 analysts")).toBeInTheDocument();
      expect(within(second).getByText("Led a team of 4 analysts, mentoring juniors")).toBeInTheDocument();
      expect(count()).toBe("0 of 3 accepted");
      for (const n of [1, 2, 3]) {
        expect(screen.getByRole("button", { name: new RegExp(`^Accept suggestion ${n}:`) })).toHaveAttribute("aria-pressed", "false");
      }
    });

    test("starts with the preview showing the resume as it is", async () => {
      await analyse();
      expect(summary()).toBe(RESUME.profile.summary);
      expect(bullet()).toBe("Led a team of 4 analysts");
      expect(skills()).toBe("Tableau, Forecasting");
    });

    test("accepting a suggestion shows it in the preview straight away, and nothing else", async () => {
      await analyse();

      accept(2);

      expect(bullet()).toBe("Led a team of 4 analysts, mentoring juniors");
      expect(summary()).toBe(RESUME.profile.summary);
      expect(skills()).toBe("Tableau, Forecasting");
      expect(screen.getByRole("button", { name: /^Accept suggestion 2:/ })).toHaveAttribute("aria-pressed", "true");
      expect(count()).toBe("1 of 3 accepted");
    });

    test("each suggestion can be accepted on its own, in any order", async () => {
      await analyse();

      accept(3);
      accept(1);

      expect(summary()).toBe("Reworded for the job.");
      expect(skills()).toBe("Forecasting, Tableau");
      expect(bullet()).toBe("Led a team of 4 analysts");
    });

    test("pressing Accept again takes the change back out of the preview", async () => {
      await analyse();
      accept(1);
      expect(summary()).toBe("Reworded for the job.");

      accept(1);

      expect(summary()).toBe(RESUME.profile.summary);
      expect(screen.getByRole("button", { name: /^Accept suggestion 1:/ })).toHaveAttribute("aria-pressed", "false");
    });

    test("rejecting leaves the preview alone, and changing your mind works both ways", async () => {
      await analyse();

      reject(1);
      expect(summary()).toBe(RESUME.profile.summary);
      expect(screen.getByRole("button", { name: /^Reject suggestion 1:/ })).toHaveAttribute("aria-pressed", "true");
      expect(count()).toBe("0 of 3 accepted, 1 rejected");

      accept(1);
      expect(summary()).toBe("Reworded for the job.");
      expect(screen.getByRole("button", { name: /^Reject suggestion 1:/ })).toHaveAttribute("aria-pressed", "false");
      expect(count()).toBe("1 of 3 accepted");
    });

    test("Accept All, Reject All and Reset", async () => {
      await analyse();

      fireEvent.click(screen.getByRole("button", { name: "Accept All" }));
      expect(summary()).toBe("Reworded for the job.");
      expect(bullet()).toBe("Led a team of 4 analysts, mentoring juniors");
      expect(skills()).toBe("Forecasting, Tableau");
      expect(count()).toBe("3 of 3 accepted");

      fireEvent.click(screen.getByRole("button", { name: "Reject All" }));
      expect(summary()).toBe(RESUME.profile.summary);
      expect(count()).toBe("0 of 3 accepted, 3 rejected");

      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(count()).toBe("0 of 3 accepted");
      expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    test("the preview uses the template and colours already chosen in the builder", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      expect(screen.getByTestId("preview")).toHaveAttribute("data-color", "#123456");
    });

    test("falls back to the default look when the builder has nothing saved", async () => {
      await analyse();
      expect(screen.getByTestId("preview")).toHaveAttribute("data-color", initialSettings.themeColor);
    });
  });

  describe("suggestions that add something new", () => {
    const NEW_BULLET = "Mentored junior analysts on forecasting";
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
            reason: "The job wants mentoring",
            basedOn: 'The summary says "mentors analysts"',
          },
        ],
      });

    test("marks it as new, shows what it is based on, and has no before text", async () => {
      await analyse(withAdd());

      const card = screen.getByText("The job wants mentoring").closest("li")!;
      expect(within(card).getByText("New")).toBeInTheDocument();
      expect(within(card).getByText(NEW_BULLET)).toBeInTheDocument();
      expect(within(card).getByText("Add")).toBeInTheDocument();
      expect(within(card).getByText(/based on your resume:/i)).toBeInTheDocument();
      expect(within(card).getByText(/mentors analysts/)).toBeInTheDocument();
      expect(within(card).queryByText("Before")).not.toBeInTheDocument();
    });

    test("a rewording is not marked as new, and shows no source", async () => {
      await analyse(withAdd());
      const card = screen.getByText("Targets the role").closest("li")!;
      expect(within(card).queryByText("New")).not.toBeInTheDocument();
      expect(within(card).queryByText(/based on your resume/i)).not.toBeInTheDocument();
      expect(within(card).getByText("After")).toBeInTheDocument();
    });

    test("accepting it puts the new bullet into the preview, and rejecting it takes nothing out", async () => {
      await analyse(withAdd());
      expect(screen.getByTestId("preview-count")).toHaveTextContent("2");

      accept(2);
      expect(screen.getByTestId("preview-count")).toHaveTextContent("3");
      expect(screen.getByTestId("preview-last")).toHaveTextContent(NEW_BULLET);

      accept(2);
      expect(screen.getByTestId("preview-count")).toHaveTextContent("2");

      reject(2);
      expect(screen.getByTestId("preview-count")).toHaveTextContent("2");
    });

    test("applying loads the new bullet into the builder, and Undo takes it out again", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse(withAdd());
      accept(2);

      fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));
      fireEvent.click(screen.getByRole("button", { name: "Replace My Resume" }));

      const saved = JSON.parse(localStorage.getItem(STATE_KEY)!);
      expect(saved.resume.workExperiences[0].descriptions).toEqual([...RESUME.workExperiences[0].descriptions, NEW_BULLET]);

      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
    });
  });

  describe("applying the accepted changes", () => {
    const apply = () => {
      fireEvent.click(screen.getByRole("button", { name: /apply .*to resume builder/i }));
      fireEvent.click(screen.getByRole("button", { name: "Replace My Resume" }));
    };

    test("is switched off until something is accepted", async () => {
      await analyse();
      expect(screen.getByRole("button", { name: "Apply Changes to Resume Builder" })).toBeDisabled();
      expect(screen.getByText(/accept a suggestion to add it/i)).toBeInTheDocument();
    });

    test("says how many changes it will apply", async () => {
      await analyse();
      accept(1);
      expect(screen.getByRole("button", { name: "Apply 1 Change to Resume Builder" })).toBeEnabled();
      accept(2);
      expect(screen.getByRole("button", { name: "Apply 2 Changes to Resume Builder" })).toBeEnabled();
    });

    test("asks before replacing, and Cancel changes nothing", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(1);

      fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/replaces the resume in the builder/i);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
      expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    });

    test("loads the resume with only the accepted changes, keeps the person's settings and backs up the old resume", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(2);
      reject(1);

      apply();

      expect(await screen.findByText("Loaded into the resume builder")).toBeInTheDocument();
      const saved = JSON.parse(localStorage.getItem(STATE_KEY)!);
      expect(saved.resume).toEqual(applyEdits(RESUME, [EDITS[1]]));
      expect(saved.resume.profile.summary).toBe(RESUME.profile.summary); // the rejected one
      expect(saved.settings.themeColor).toBe("#123456");
      expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!).state).toEqual(original);
      expect(screen.getByRole("link", { name: "Open Resume Builder" })).toHaveAttribute("href", "/resume-builder");
    });

    test("Undo puts the old resume back", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(1);
      apply();

      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
      expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
      expect(screen.getByRole("button", { name: /apply 1 change/i })).toBeInTheDocument();
    });

    test("changing your mind after applying offers to apply again, and Undo still leads back to the original resume", async () => {
      localStorage.setItem(STATE_KEY, JSON.stringify(original));
      await analyse();
      accept(1);
      apply();
      await screen.findByText("Loaded into the resume builder");

      accept(2); // more accepted since the apply
      expect(screen.queryByText("Loaded into the resume builder")).not.toBeInTheDocument();
      apply();

      const saved = JSON.parse(localStorage.getItem(STATE_KEY)!);
      expect(saved.resume).toEqual(applyEdits(RESUME, [EDITS[0], EDITS[1]]));
      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(original);
    });

    test("works when the builder had nothing saved, with no Undo to offer", async () => {
      await analyse();
      accept(1);

      apply();

      expect(await screen.findByText("Loaded into the resume builder")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STATE_KEY)!).resume).toEqual(applyEdits(RESUME, [EDITS[0]]));
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
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

    test("a new analysis starts with no suggestions accepted", async () => {
      await analyse();
      accept(1);
      fireEvent.click(screen.getByRole("button", { name: /change resume or job/i }));

      fetchMock.mockResolvedValue(ok(result()));
      fireEvent.click(analyseButton());
      await screen.findByRole("heading", { name: "Your Resume Analysis" });

      expect(count()).toBe("0 of 3 accepted");
      expect(summary()).toBe(RESUME.profile.summary);
    });

    test("on a narrow screen the analysis and the preview share the space behind tabs", async () => {
      await analyse();

      const analysisTab = screen.getByRole("tab", { name: "Analysis" });
      const previewTab = screen.getByRole("tab", { name: "Live Preview" });
      expect(analysisTab).toHaveAttribute("aria-selected", "true");
      expect(previewTab).toHaveAttribute("aria-selected", "false");

      fireEvent.click(previewTab);

      expect(previewTab).toHaveAttribute("aria-selected", "true");
      expect(analysisTab).toHaveAttribute("aria-selected", "false");
      expect(document.getElementById("panel-report")).toHaveClass("hidden");
      expect(document.getElementById("panel-preview")).not.toHaveClass("hidden");
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
