import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportResumePage from "../page";
import { getAccessToken } from "../../lib/auth-gate";
import { getHasUsedAppBefore, saveStateToLocalStorage } from "../../lib/redux/local-storage";

const push = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("../../lib/auth-gate", () => ({ getAccessToken: jest.fn() }));
jest.mock("../../lib/redux/local-storage", () => ({
  getHasUsedAppBefore: jest.fn(),
  saveStateToLocalStorage: jest.fn(),
}));

const token = getAccessToken as jest.Mock;
const hasUsedBefore = getHasUsedAppBefore as jest.Mock;
const save = saveStateToLocalStorage as jest.Mock;
const fetchMock = jest.fn();

const IMPORTED = {
  profile: { name: "Alex Morgan", email: "", phone: "", url: "", summary: "", location: "" },
  workExperiences: [{ company: "Harbourview", jobTitle: "Engineer", date: "2022", descriptions: ["Built"] }],
  educations: [],
  projects: [],
  skills: { featuredSkills: [{ skill: "Go", rating: 4 }], descriptions: [] },
  custom: { descriptions: [] },
};

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const chooseFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });
const pdf = (name = "resume.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });
const importButton = () => screen.getByRole("button", { name: /import resume|reading your resume/i });

beforeEach(() => {
  push.mockReset();
  save.mockReset();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("access-token");
  hasUsedBefore.mockReset().mockReturnValue(false);
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("ImportResumePage", () => {
  test("starts with the import button disabled", () => {
    render(<ImportResumePage />);
    expect(importButton()).toBeDisabled();
  });

  test("rejects a file that is not a PDF or Word document", () => {
    render(<ImportResumePage />);

    chooseFile(new File(["hello"], "notes.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Upload a PDF or Word (.docx) file.");
    expect(importButton()).toBeDisabled();
  });

  test("rejects a file over 5 MB", () => {
    render(<ImportResumePage />);
    const big = pdf("big.pdf");
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });

    chooseFile(big);

    expect(screen.getByRole("alert")).toHaveTextContent("too large");
    expect(importButton()).toBeDisabled();
  });

  test.each(["resume.pdf", "Resume.DOCX"])("accepts %s and shows its name", (name) => {
    render(<ImportResumePage />);

    chooseFile(pdf(name));

    expect(screen.getByText(name)).toBeInTheDocument();
    expect(importButton()).toBeEnabled();
  });

  test("lets the visitor remove the chosen file", () => {
    render(<ImportResumePage />);
    chooseFile(pdf());

    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));

    expect(screen.queryByText("resume.pdf")).not.toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  test("warns that a saved resume will be replaced", () => {
    hasUsedBefore.mockReturnValue(true);
    render(<ImportResumePage />);
    chooseFile(pdf());

    expect(screen.getByText(/replaces the resume currently saved/i)).toBeInTheDocument();
  });

  test("uploads with the access token, saves the resume and opens the builder", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ resume: IMPORTED }) });
    render(<ImportResumePage />);
    chooseFile(pdf());

    fireEvent.click(importButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/resume-builder"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/resume-import");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer access-token" });
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);

    const saved = save.mock.calls[0][0];
    expect(saved.resume).toEqual(IMPORTED);
    // Only sections with content are shown.
    expect(saved.settings.formToShow).toEqual({
      workExperiences: true,
      educations: false,
      projects: false,
      skills: true,
      custom: false,
    });
  });

  test("asks a signed-out visitor to sign in, without uploading", async () => {
    token.mockResolvedValue(null);
    render(<ImportResumePage />);
    chooseFile(pdf());

    fireEvent.click(importButton());

    expect(await screen.findByText(/create a free .* account or sign in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(importButton()).toBeEnabled();
  });

  test("shows the server's message when the import fails, and saves nothing", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "We couldn't find enough text in this file to read a resume." }),
    });
    render(<ImportResumePage />);
    chooseFile(pdf());

    fireEvent.click(importButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't find enough text");
    expect(save).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(importButton()).toBeEnabled();
  });

  test("tells the visitor when the server cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ImportResumePage />);
    chooseFile(pdf());

    fireEvent.click(importButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't reach the server");
  });
});
