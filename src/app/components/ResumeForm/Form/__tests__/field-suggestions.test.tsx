import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { FieldSuggestions } from "../FieldSuggestions";
import { SuggestionsContext, type SuggestionsApi } from "../suggestions-context";
import { ProfileForm } from "../../ProfileForm";
import { WorkExperiencesForm } from "../../WorkExperiencesForm";
import { EducationsForm } from "../../EducationsForm";
import { ProjectsForm } from "../../ProjectsForm";
import { SkillsForm } from "../../SkillsForm";
import { CustomForm } from "../../CustomForm";
import { store } from "../../../../lib/redux/store";
import type { ResumeEdit } from "../../../../lib/resume-analysis/types";

const edit: ResumeEdit = { id: "e1", kind: "replace", section: "summary", where: "Summary", before: "Old", after: "New wording", reason: "Because", };

const api = (over: Partial<SuggestionsApi> = {}): SuggestionsApi => ({
  forField: () => [],
  accept: jest.fn(),
  dismiss: jest.fn(),
  restore: jest.fn(),
  undo: jest.fn(),
  ...over,
});

describe("the builder's own forms", () => {
  test.each([
    ["the objective", ProfileForm],
    ["work experience", WorkExperiencesForm],
    ["education", EducationsForm],
    ["projects", ProjectsForm],
    ["skills", SkillsForm],
    ["the custom section", CustomForm],
  ])("show nothing extra for %s when there are no suggestions to show", (_name, Form) => {
    render(
      <Provider store={store}>
        <Form />
      </Provider>
    );

    expect(screen.queryByText("Suggestions for this job")).not.toBeInTheDocument();
    expect(screen.queryByText(/suggested/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept|dismiss/i })).not.toBeInTheDocument();
    expect(document.querySelector("textarea[id^='suggestion-']")).toBeNull();
  });
});

describe("FieldSuggestions", () => {
  test("renders nothing at all without a provider", () => {
    const { container } = render(<FieldSuggestions section="summary" />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing when its field has no suggestions", () => {
    const { container } = render(
      <SuggestionsContext.Provider value={api()}>
        <FieldSuggestions section="summary" />
      </SuggestionsContext.Provider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("asks for the suggestions of the field it is on, and the entry it is in", () => {
    const forField = jest.fn(() => []);
    render(
      <SuggestionsContext.Provider value={api({ forField })}>
        <FieldSuggestions section="workExperiences" entryIndex={2} />
      </SuggestionsContext.Provider>
    );
    expect(forField).toHaveBeenCalledWith("workExperiences", 2);
  });

  test("shows a waiting suggestion, and passes the text in the box when it is accepted", () => {
    const accept = jest.fn();
    render(
      <SuggestionsContext.Provider value={api({ forField: () => [{ id: "e1", edit, state: "pending" }], accept })}>
        <FieldSuggestions section="summary" />
      </SuggestionsContext.Provider>
    );

    expect(screen.getByText("Suggestions for this job")).toBeInTheDocument();
    expect(screen.getByLabelText("New wording")).toHaveValue("New wording");
    screen.getByRole("button", { name: "Accept" }).click();
    expect(accept).toHaveBeenCalledWith("e1", "New wording");
  });

  test("accepted, dismissed and out-of-date suggestions each look different", () => {
    render(
      <SuggestionsContext.Provider
        value={api({
          forField: () => [
            { id: "a", edit: { ...edit, id: "a" }, state: "accepted", appliedText: "Went in" },
            { id: "d", edit: { ...edit, id: "d", after: "Passed over" }, state: "dismissed" },
            { id: "s", edit: { ...edit, id: "s" }, state: "stale" },
          ],
        })}
      >
        <FieldSuggestions section="summary" />
      </SuggestionsContext.Provider>
    );

    expect(screen.getByText(/Accepted:/)).toBeInTheDocument();
    expect(screen.getByText("Went in", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByText(/no longer fits/i)).toBeInTheDocument();
    expect(screen.queryByText("Passed over")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 1 dismissed" })).toHaveAttribute("aria-expanded", "false");
  });
});
