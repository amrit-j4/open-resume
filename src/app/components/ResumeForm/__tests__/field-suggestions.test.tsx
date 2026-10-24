import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { FieldSuggestions } from "../Form/FieldSuggestions";
import { SuggestionsContext, type FieldSuggestion, type SuggestionsApi } from "../Form/suggestions-context";
import { ProfileForm } from "../ProfileForm";
import { WorkExperiencesForm } from "../WorkExperiencesForm";
import { EducationsForm } from "../EducationsForm";
import { ProjectsForm } from "../ProjectsForm";
import { SkillsForm } from "../SkillsForm";
import { makeStore } from "../../../lib/redux/make-store";
import { initialSettings } from "../../../lib/redux/settingsSlice";
import { RESUME } from "../../../lib/resume-analysis/__fixtures__/analysis";
import type { ResumeEdit } from "../../../lib/resume-analysis/types";

const edit = (over: Partial<ResumeEdit> = {}): ResumeEdit => ({
  id: "edit-1",
  kind: "replace",
  section: "summary",
  where: "Summary",
  before: "Old",
  after: "New wording",
  reason: "Because",
  ...over,
});

const api = (items: FieldSuggestion[], over: Partial<SuggestionsApi> = {}): SuggestionsApi => ({
  forField: jest.fn(() => items),
  accept: jest.fn(),
  dismiss: jest.fn(),
  restore: jest.fn(),
  undo: jest.fn(),
  ...over,
});

const renderWith = (value: SuggestionsApi | null) =>
  render(
    <SuggestionsContext.Provider value={value}>
      <FieldSuggestions section="summary" />
    </SuggestionsContext.Provider>
  );

describe("the builder's own forms", () => {
  const forms = [
    ["profile", ProfileForm],
    ["work experience", WorkExperiencesForm],
    ["education", EducationsForm],
    ["projects", ProjectsForm],
    ["skills", SkillsForm],
  ] as const;

  test.each(forms)("the %s form shows no suggestions where none are provided", (_name, Form) => {
    const { container } = render(
      <Provider store={makeStore({ resume: RESUME, settings: initialSettings })}>
        <Form />
      </Provider>
    );

    expect(container.textContent).not.toMatch(/suggest/i);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  test.each(forms)("the %s form is the same with an empty provider as with none", (_name, Form) => {
    const store = makeStore({ resume: RESUME, settings: initialSettings });
    const without = render(
      <Provider store={store}>
        <Form />
      </Provider>
    );
    const html = without.container.innerHTML;
    without.unmount();

    const withEmpty = render(
      <Provider store={store}>
        <SuggestionsContext.Provider value={api([])}>
          <Form />
        </SuggestionsContext.Provider>
      </Provider>
    );
    expect(withEmpty.container.innerHTML).toBe(html);
  });
});

describe("FieldSuggestions", () => {
  test("renders nothing without a provider", () => {
    const { container } = renderWith(null);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing when the field has no suggestions", () => {
    const { container } = renderWith(api([]));
    expect(container).toBeEmptyDOMElement();
  });

  test("asks for the suggestions for the field it was put in", () => {
    const provided = api([]);
    render(
      <SuggestionsContext.Provider value={provided}>
        <FieldSuggestions section="workExperiences" entryIndex={2} />
      </SuggestionsContext.Provider>
    );
    expect(provided.forField).toHaveBeenCalledWith("workExperiences", 2);
  });

  describe("a waiting suggestion", () => {
    const pending = (over: Partial<ResumeEdit> = {}): FieldSuggestion => ({ id: "edit-1", edit: edit(over), state: "pending" });

    test("shows the current text, an editable new version and why", () => {
      renderWith(api([pending()]));

      expect(screen.getByText("Suggestions for this job")).toBeInTheDocument();
      expect(screen.getByText("Suggested rewording")).toBeInTheDocument();
      expect(screen.getByText("Old")).toBeInTheDocument();
      expect(screen.getByLabelText("New wording")).toHaveValue("New wording");
      expect(screen.getByText("Because")).toBeInTheDocument();
    });

    test("accepts the text in the box, trimmed, even after it was changed", () => {
      const provided = api([pending()]);
      renderWith(provided);

      fireEvent.change(screen.getByLabelText("New wording"), { target: { value: "  Changed  " } });
      fireEvent.click(screen.getByRole("button", { name: "Accept" }));

      expect(provided.accept).toHaveBeenCalledWith("edit-1", "Changed");
    });

    test("can't be accepted with an empty box", () => {
      const provided = api([pending()]);
      renderWith(provided);

      fireEvent.change(screen.getByLabelText("New wording"), { target: { value: "" } });

      expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
      expect(provided.accept).not.toHaveBeenCalled();
    });

    test("can be dismissed", () => {
      const provided = api([pending()]);
      renderWith(provided);
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(provided.dismiss).toHaveBeenCalledWith("edit-1");
    });

    test("a new line is offered as one, with its source and no old text", () => {
      renderWith(api([pending({ kind: "add", before: "", after: "Mentored juniors", basedOn: "The summary" })]));

      expect(screen.getByText("Suggested new line")).toBeInTheDocument();
      expect(screen.getByLabelText("New line to add")).toHaveValue("Mentored juniors");
      expect(screen.getByText(/based on your resume:/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add It" })).toBeInTheDocument();
      expect(screen.queryByText("Now")).not.toBeInTheDocument();
    });

    test("a rewording shows no source", () => {
      renderWith(api([pending()]));
      expect(screen.queryByText(/based on your resume/i)).not.toBeInTheDocument();
    });
  });

  describe("other states", () => {
    test("an accepted one shows what went in, with Undo", () => {
      const provided = api([{ id: "edit-1", edit: edit(), state: "accepted", appliedText: "What went in" }]);
      renderWith(provided);

      expect(screen.getByText("What went in")).toBeInTheDocument();
      expect(screen.getByText("Accepted:")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(provided.undo).toHaveBeenCalledWith("edit-1");
    });

    test("an accepted add says Added", () => {
      renderWith(api([{ id: "edit-1", edit: edit({ kind: "add" }), state: "accepted", appliedText: "x" }]));
      expect(screen.getByText("Added:")).toBeInTheDocument();
    });

    test("one whose line has changed says so and can be dismissed", () => {
      const provided = api([{ id: "edit-1", edit: edit(), state: "stale" }]);
      renderWith(provided);

      expect(screen.getByText(/you.ve changed this line since the analysis/i)).toBeInTheDocument();
      expect(screen.queryByLabelText("New wording")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(provided.dismiss).toHaveBeenCalledWith("edit-1");
    });

    test("dismissed ones are hidden until asked for, and can be restored", () => {
      const provided = api([{ id: "edit-1", edit: edit({ after: "Hidden wording" }), state: "dismissed" }]);
      renderWith(provided);

      expect(screen.queryByText("Hidden wording")).not.toBeInTheDocument();
      expect(screen.queryByText("Suggestions for this job")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Show 1 dismissed" }));
      expect(screen.getByRole("button", { name: "Hide 1 dismissed" })).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(screen.getByRole("button", { name: "Restore" }));
      expect(provided.restore).toHaveBeenCalledWith("edit-1");

      fireEvent.click(screen.getByRole("button", { name: "Hide 1 dismissed" }));
      expect(screen.queryByText("Hidden wording")).not.toBeInTheDocument();
    });

    test("shows each kind together", () => {
      renderWith(
        api([
          { id: "a", edit: edit({ id: "a", reason: "Pending one" }), state: "pending" },
          { id: "b", edit: edit({ id: "b" }), state: "accepted", appliedText: "Accepted text" },
          { id: "c", edit: edit({ id: "c" }), state: "dismissed" },
        ])
      );
      expect(screen.getByText("Pending one")).toBeInTheDocument();
      expect(screen.getByText("Accepted text")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show 1 dismissed" })).toBeInTheDocument();
    });
  });
});
