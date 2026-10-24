import { normalizeResume } from "lib/resume-import/normalize";

describe("normalizeResume", () => {
  test("returns an empty resume for anything that is not an object", () => {
    for (const input of [null, undefined, "text", 42, [], true]) {
      const resume = normalizeResume(input);
      expect(resume.profile).toEqual({ name: "", email: "", phone: "", url: "", summary: "", location: "" });
      expect(resume.workExperiences).toEqual([]);
      expect(resume.educations).toEqual([]);
      expect(resume.projects).toEqual([]);
      expect(resume.skills).toEqual({ featuredSkills: [], descriptions: [] });
      expect(resume.custom).toEqual({ descriptions: [] });
    }
  });

  test("keeps well formed data and trims strings", () => {
    const resume = normalizeResume({
      profile: { name: "  Alex Morgan ", email: "alex@example.com", phone: "0400 000 000", url: "linkedin.com/in/alex", summary: "Engineer", location: "Sydney, NSW" },
      workExperiences: [
        { company: "Harbourview", jobTitle: "Senior Engineer", date: "Mar 2022 - Present", descriptions: ["Led a team", " Cut load time "] },
      ],
      educations: [{ school: "Northern Ranges", degree: "BSc", date: "2014 - 2017", gpa: "6.2", descriptions: ["Dean's List"] }],
      projects: [{ project: "Jobs Dashboard", date: "2023", descriptions: ["Open source"] }],
      skills: { featuredSkills: [{ skill: "TypeScript", rating: 5 }], descriptions: ["Docker"] },
      custom: { descriptions: ["AWS Certified"] },
    });

    expect(resume.profile.name).toBe("Alex Morgan");
    expect(resume.workExperiences[0]).toEqual({
      company: "Harbourview",
      jobTitle: "Senior Engineer",
      date: "Mar 2022 - Present",
      descriptions: ["Led a team", "Cut load time"],
    });
    expect(resume.educations[0].gpa).toBe("6.2");
    expect(resume.projects[0].project).toBe("Jobs Dashboard");
    expect(resume.skills.featuredSkills).toEqual([{ skill: "TypeScript", rating: 5 }]);
    expect(resume.custom.descriptions).toEqual(["AWS Certified"]);
  });

  test("replaces wrongly typed values with empty ones", () => {
    const resume = normalizeResume({
      profile: { name: 123, email: null, phone: {}, url: [], summary: false, location: undefined },
      workExperiences: [null, "x", { company: 5, jobTitle: [], date: null, descriptions: "not a list" }],
      skills: { featuredSkills: "nope", descriptions: { a: 1 } },
      custom: [],
    });

    expect(resume.profile).toEqual({ name: "", email: "", phone: "", url: "", summary: "", location: "" });
    expect(resume.workExperiences).toHaveLength(3);
    expect(resume.workExperiences[2]).toEqual({ company: "", jobTitle: "", date: "", descriptions: [] });
    expect(resume.skills).toEqual({ featuredSkills: [], descriptions: [] });
    expect(resume.custom).toEqual({ descriptions: [] });
  });

  test("drops blank and non-string bullets", () => {
    const resume = normalizeResume({
      workExperiences: [{ descriptions: ["Real", "", "   ", 7, null, "Also real"] }],
    });
    expect(resume.workExperiences[0].descriptions).toEqual(["Real", "Also real"]);
  });

  test("bounds the number of entries, bullets and the length of text", () => {
    const resume = normalizeResume({
      profile: { name: "x".repeat(2000), summary: "y".repeat(5000) },
      workExperiences: Array.from({ length: 50 }, () => ({
        company: "C",
        descriptions: Array.from({ length: 40 }, (_, i) => `bullet ${i}`),
      })),
    });

    expect(resume.profile.name).toHaveLength(500);
    expect(resume.profile.summary).toHaveLength(600);
    expect(resume.workExperiences).toHaveLength(20);
    expect(resume.workExperiences[0].descriptions).toHaveLength(15);
  });

  describe("featured skills", () => {
    test("keeps at most 6 and skips entries without a skill name", () => {
      const resume = normalizeResume({
        skills: {
          featuredSkills: [
            { skill: "", rating: 5 },
            { skill: "   ", rating: 5 },
            ...Array.from({ length: 10 }, (_, i) => ({ skill: `Skill ${i}`, rating: 3 })),
          ],
        },
      });
      expect(resume.skills.featuredSkills).toHaveLength(6);
      expect(resume.skills.featuredSkills[0].skill).toBe("Skill 0");
    });

    test.each([
      [undefined, 4],
      [null, 4],
      ["abc", 4],
      [0, 4],
      [-3, 4],
      [3, 3],
      ["2", 2],
      [3.6, 4],
      [9, 5],
    ])("rating %p becomes %p", (input, expected) => {
      const resume = normalizeResume({ skills: { featuredSkills: [{ skill: "Go", rating: input }] } });
      expect(resume.skills.featuredSkills[0].rating).toBe(expected);
    });
  });
});
