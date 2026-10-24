import { corpusOf, figuresAllowedAt, introducesNumbers, isEvidenced, lettersOnly, numbersIn, textsOf, usesFiguresOutside } from "lib/resume-analysis/evidence";
import { RESUME } from "lib/resume-analysis/__fixtures__/analysis";

const corpus = corpusOf(RESUME);

describe("numbersIn", () => {
  test.each([
    ["Cut costs by 18% over 12 months", ["18", "12"]],
    ["Revenue of $1,200,000.", ["1,200,000"]],
    ["Version 3.5 shipped", ["3.5"]],
    ["No figures here", []],
  ])("%s", (input, expected) => {
    expect(numbersIn(input)).toEqual(expected);
  });
});

describe("introducesNumbers", () => {
  test("is false for numbers the resume already has", () => {
    expect(introducesNumbers("Led 4 analysts and saved 12 hours a week", corpus)).toBe(false);
    expect(introducesNumbers("No figures at all", corpus)).toBe(false);
  });

  test("is true for a number that is not in the resume", () => {
    expect(introducesNumbers("Led 40 analysts", corpus)).toBe(true);
  });

  test("does not mistake part of a longer number for a number in the resume", () => {
    // "15" and "20" appear inside 2015 and 2022 in the resume, but are not numbers it contains.
    expect(introducesNumbers("Analyst with 15 years of experience", corpus)).toBe(true);
    expect(introducesNumbers("Joined in 2022", corpus)).toBe(false);
  });

  test("does not count the ratings stored with the skills as claims", () => {
    expect(introducesNumbers("Rated 5 out of 5", corpusOf({ ...RESUME, skills: { featuredSkills: [{ skill: "Go", rating: 5 }], descriptions: [] } }))).toBe(true);
  });
});

describe("isEvidenced", () => {
  test.each(["Python", "python", "power bi", "Tableau, Forecasting", "SQL and Tableau"])("%s appears in the resume", (value) => {
    expect(isEvidenced(value, corpus)).toBe(true);
  });

  test.each(["Snowflake", "Python, dbt", "Kubernetes", "", "   ", "!!!"])("%p does not", (value) => {
    expect(isEvidenced(value, corpus)).toBe(false);
  });
});

describe("lettersOnly", () => {
  test("ignores case, spacing and punctuation", () => {
    expect(lettersOnly("Led a Team.")).toBe(lettersOnly("led  a team"));
    expect(lettersOnly("Cut costs - fast")).toBe(lettersOnly("Cut costs, fast"));
  });

  test("still tells real changes apart", () => {
    expect(lettersOnly("Led a team")).not.toBe(lettersOnly("Led a team of four"));
  });
});

describe("textsOf", () => {
  test("lists every piece of text, tidied and lower-cased, and nothing else", () => {
    const texts = textsOf(RESUME);
    expect(texts).toContain("priya nair");
    expect(texts).toContain("led a team of 4 analysts");
    expect(texts).toContain("tableau, forecasting");
    expect(texts.every((t) => t === t.trim() && t.length > 0)).toBe(true);
    expect(texts).not.toContain("5"); // ratings are numbers, not text
  });
});

describe("figuresAllowedAt", () => {
  const allowed = (place: { section: string; entryIndex?: number }) => Array.from(figuresAllowedAt(RESUME, corpus, place)).sort();

  test("a work entry may use only the figures written in that entry", () => {
    expect(allowed({ section: "workExperiences", entryIndex: 0 })).toEqual(["18", "2021", "4"]);
    expect(allowed({ section: "workExperiences", entryIndex: 1 })).toEqual(["12", "2017", "2021", "60"]);
  });

  test("education and project entries too", () => {
    expect(allowed({ section: "educations", entryIndex: 0 })).toEqual(["2015", "2016"]);
    expect(allowed({ section: "projects", entryIndex: 0 })).toEqual(["2022"]);
  });

  test("the summary may use any figure in the resume", () => {
    expect(figuresAllowedAt(RESUME, corpus, { section: "summary" })).toBe(corpus.numbers);
  });

  test("a skills line may only use figures the skills already have", () => {
    expect(allowed({ section: "skills" })).toEqual([]);
    const withFigure = { ...RESUME, skills: { ...RESUME.skills, descriptions: ["Python 3, SQL"] } };
    expect(Array.from(figuresAllowedAt(withFigure, corpusOf(withFigure), { section: "skills" }))).toEqual(["3"]);
  });

  test("a place that doesn't exist allows no figures", () => {
    expect(allowed({ section: "workExperiences", entryIndex: 9 })).toEqual([]);
    expect(allowed({ section: "workExperiences" })).toEqual([]);
    expect(allowed({ section: "nonsense" })).toEqual([]);
  });
});

describe("usesFiguresOutside", () => {
  test("is true only when a figure isn't in the set", () => {
    const set = new Set(["4", "18"]);
    expect(usesFiguresOutside("Led 4 analysts and cut waste by 18%", set)).toBe(false);
    expect(usesFiguresOutside("Led 5 analysts", set)).toBe(true);
    expect(usesFiguresOutside("No figures", set)).toBe(false);
  });
});
