import { keepTruthful, textsOf } from "lib/resume-analysis/keep-truthful";
import type { Resume } from "lib/redux/types";
import { RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const clone = (): Resume => JSON.parse(JSON.stringify(RESUME));

describe("keepTruthful", () => {
  test("lets a plain reword through", () => {
    const tailored = clone();
    tailored.profile.summary = "Senior data analyst who builds forecasting models and leads teams.";
    tailored.workExperiences[0].descriptions = ["Led a team of 4 analysts", "Built a demand forecasting model that cut stock-outs by 18%"];

    const result = keepTruthful(RESUME, tailored);

    expect(result.profile.summary).toBe(tailored.profile.summary);
    expect(result.workExperiences[0].descriptions).toEqual(tailored.workExperiences[0].descriptions);
  });

  test("restores contact details, employers, titles, dates, schools, degrees and GPA", () => {
    const tailored = clone();
    tailored.profile = { ...tailored.profile, name: "Someone Else", email: "x@y.z", phone: "000", url: "evil.example", location: "Mars" };
    tailored.workExperiences[0] = { ...tailored.workExperiences[0], company: "Google", jobTitle: "CTO", date: "2000 - 2030" };
    tailored.educations[0] = { ...tailored.educations[0], school: "Harvard", degree: "PhD", date: "1999", gpa: "4.0" };
    tailored.projects[0] = { ...tailored.projects[0], project: "Moon Base", date: "2099" };

    const result = keepTruthful(RESUME, tailored);

    expect(result.profile).toEqual({ ...RESUME.profile, summary: tailored.profile.summary });
    expect(result.workExperiences[0]).toMatchObject({ company: "Brightwave Retail", jobTitle: "Senior Data Analyst", date: "Feb 2021 - Present" });
    expect(result.educations[0]).toMatchObject({ school: "University of Melbourne", degree: "Master of Data Science", date: "2015 - 2016", gpa: "" });
    expect(result.projects[0]).toMatchObject({ project: "Open Transport Tracker", date: "2022" });
  });

  test("keeps the original number of entries, whatever the model added or removed", () => {
    const tailored = clone();
    tailored.workExperiences.push({ company: "Invented Inc", jobTitle: "Boss", date: "2024", descriptions: ["Ran it"] });
    tailored.workExperiences.shift();
    tailored.educations = [];
    tailored.projects.push({ project: "Fake", date: "2023", descriptions: [] });

    const result = keepTruthful(RESUME, tailored);

    expect(result.workExperiences.map((w) => w.company)).toEqual(["Brightwave Retail", "Coastline Logistics"]);
    expect(result.educations).toHaveLength(1);
    expect(result.projects).toHaveLength(1);
  });

  test("keeps the original bullets of an entry whose rewrite brings in a number that isn't in the resume", () => {
    const tailored = clone();
    tailored.workExperiences[0].descriptions = ["Cut stock-outs by 45% across 200 stores"];
    tailored.workExperiences[1].descriptions = ["Automated daily route reporting in Python, saving 12 hours a week"]; // fine

    const result = keepTruthful(RESUME, tailored);

    expect(result.workExperiences[0].descriptions).toEqual(RESUME.workExperiences[0].descriptions);
    expect(result.workExperiences[1].descriptions).toEqual(tailored.workExperiences[1].descriptions);
  });

  test("falls back to the original summary when the new one brings in a number", () => {
    const tailored = clone();
    tailored.profile.summary = "Analyst with 15 years of experience.";
    expect(keepTruthful(RESUME, tailored).profile.summary).toBe(RESUME.profile.summary);
  });

  test("falls back to the original bullets when the rewrite left none", () => {
    const tailored = clone();
    tailored.workExperiences[0].descriptions = [];
    expect(keepTruthful(RESUME, tailored).workExperiences[0].descriptions).toEqual(RESUME.workExperiences[0].descriptions);
  });

  test("drops skills that the resume gives no evidence of, and keeps ones it does", () => {
    const tailored = clone();
    tailored.skills.featuredSkills = [
      { skill: "Python", rating: 5 },
      { skill: "Snowflake", rating: 5 }, // not in the resume
      { skill: "power bi", rating: 3 }, // same skill, different case
      { skill: "Kubernetes", rating: 4 },
    ];
    tailored.skills.descriptions = ["Tableau, Forecasting", "dbt, Airflow"];

    const result = keepTruthful(RESUME, tailored);

    expect(result.skills.featuredSkills.map((s) => s.skill)).toEqual(["Python", "power bi"]);
    expect(result.skills.descriptions).toEqual(["Tableau, Forecasting"]);
  });

  test("keeps the original skills when none of the rewritten ones are evidenced", () => {
    const tailored = clone();
    tailored.skills = { featuredSkills: [{ skill: "Snowflake", rating: 5 }], descriptions: ["dbt"] };

    const result = keepTruthful(RESUME, tailored);

    expect(result.skills).toEqual(RESUME.skills);
  });

  test("keeps the extras the resume has, drops invented ones, and never lets one bring in a new number", () => {
    const tailored = clone();
    tailored.custom.descriptions = ["Microsoft Certified: Data Analyst Associate (2022)", "AWS Certified Solutions Architect", "Data Analyst Associate (2031)"];

    const result = keepTruthful(RESUME, tailored);

    expect(result.custom.descriptions).toEqual(["Microsoft Certified: Data Analyst Associate (2022)"]);
  });

  test("never returns something a rewrite broke: an empty answer gives back the original", () => {
    const empty: Resume = {
      profile: { name: "", email: "", phone: "", url: "", summary: "", location: "" },
      workExperiences: [],
      educations: [],
      projects: [],
      skills: { featuredSkills: [], descriptions: [] },
      custom: { descriptions: [] },
    };

    expect(keepTruthful(RESUME, empty)).toEqual({ ...RESUME, profile: { ...RESUME.profile } });
  });

  test("does not change the original resume object", () => {
    const before = JSON.stringify(RESUME);
    keepTruthful(RESUME, clone());
    expect(JSON.stringify(RESUME)).toBe(before);
  });
});

describe("textsOf", () => {
  test("lists every piece of text, tidied and lower-cased", () => {
    const texts = textsOf(RESUME);
    expect(texts).toContain("priya nair");
    expect(texts).toContain("led a team of 4 analysts");
    expect(texts).toContain("tableau, forecasting");
    expect(texts.every((t) => t === t.trim() && t.length > 0)).toBe(true);
  });
});
