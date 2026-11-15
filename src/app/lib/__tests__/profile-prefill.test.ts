import { applyProfilePrefill } from "lib/profile-prefill";
import { initialResumeState } from "lib/redux/resumeSlice";

describe("applyProfilePrefill", () => {
  it("fills the empty profile fields from the account", () => {
    const result = applyProfilePrefill(initialResumeState, {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "0400 000 000",
      location: "Sydney NSW",
      summary: "Nurse with five years' experience.",
    });
    expect(result.profile).toMatchObject({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "0400 000 000",
      location: "Sydney NSW",
      summary: "Nurse with five years' experience.",
    });
  });

  it("never overwrites a field that already has text", () => {
    const resume = {
      ...initialResumeState,
      profile: { ...initialResumeState.profile, name: "Typed Name" },
    };
    const result = applyProfilePrefill(resume, { name: "Jane Doe", email: "jane@example.com" });
    expect(result.profile.name).toBe("Typed Name");
    expect(result.profile.email).toBe("jane@example.com");
  });

  it("returns the resume unchanged when there is nothing to fill in", () => {
    expect(applyProfilePrefill(initialResumeState, null)).toBe(initialResumeState);
  });
});
