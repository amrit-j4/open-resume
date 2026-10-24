/**
 * @jest-environment node
 *
 * Live test with a real-world layout: a three-page, two-column PDF with skill ratings, awards, publications and volunteering, sent through
 * POST /api/resume-import to the real Gemini API. It costs a little and needs GEMINI_API_KEY, so it only runs on request:
 *
 *   RUN_LIVE_AI_TESTS=1 npx jest src/app/api/resume-import/__tests__/sample-resume.live.test.ts
 *
 * The fixture is a template resume with fictional details (note its header name differs from its email address).
 */
import { POST } from "../route";
import type { Resume } from "lib/redux/types";

// Node built-ins are loaded with requireActual: the test compiler rewrites bare imports (see jest.config.mjs) and can't resolve them.
const { readFileSync, writeFileSync } = jest.requireActual("fs") as typeof import("fs");
const { join } = jest.requireActual("path") as typeof import("path");

const live = process.env.RUN_LIVE_AI_TESTS === "1" ? describe : describe.skip;

let resume: Resume;

const all = (items: string[]) => items.join(" | ").toLowerCase();
const mentions = (items: string[], text: string) => all(items).includes(text.toLowerCase());

live("importing a real two-column resume (hyatt-moody-resume.pdf)", () => {
  jest.setTimeout(120_000);

  beforeAll(async () => {
    process.env.RESUME_IMPORT_API_KEY = process.env.RESUME_IMPORT_API_KEY || "live-test-secret";
    const body = new FormData();
    body.append("file", new File([readFileSync(join(__dirname, "fixtures", "hyatt-moody-resume.pdf"))], "hyatt-moody-resume.pdf"));
    const res = await POST(
      new Request("http://localhost/api/resume-import", {
        method: "POST",
        headers: { "x-api-key": process.env.RESUME_IMPORT_API_KEY! },
        body,
      })
    );
    const json = (await res.json()) as { resume?: Resume; error?: string };
    expect(json.error).toBeUndefined();
    expect(res.status).toBe(200);
    resume = json.resume!;
    if (process.env.DUMP_RESUME_TO) {
      writeFileSync(process.env.DUMP_RESUME_TO, JSON.stringify(resume, null, 1));
    }
  });

  test("profile", () => {
    expect(resume.profile.name).toBe("Hyatt Moody");
    expect(resume.profile.email).toBe("david.kowalski@email.com");
    expect(resume.profile.phone.replace(/[^\d]/g, "")).toBe("15552914756");
    expect(resume.profile.location).toMatch(/seattle/i);
    expect(resume.profile.summary).toMatch(/5\+ years/);
    expect(resume.profile.summary).toMatch(/Unity and Unreal Engine/);
  });

  test("work experience keeps all three jobs in order, with their dates and bullets", () => {
    const companies = resume.workExperiences.map((w) => w.company);
    expect(companies.map((c) => c.toLowerCase())).toEqual([
      expect.stringContaining("cascade studios"),
      expect.stringContaining("pixel forge"),
      expect.stringContaining("mobile games studio"),
    ]);

    const [cascade, pixel, mobile] = resume.workExperiences;
    expect(cascade.jobTitle).toMatch(/senior game developer/i);
    expect(cascade.date).toMatch(/march 2022/i);
    expect(cascade.date).toMatch(/present/i);
    expect(cascade.descriptions).toHaveLength(5);
    expect(mentions(cascade.descriptions, "15+ enemy types")).toBe(true);
    expect(mentions(cascade.descriptions, "40%")).toBe(true);

    expect(pixel.jobTitle).toMatch(/game developer/i);
    expect(pixel.date).toMatch(/june 2020/i);
    expect(pixel.date).toMatch(/february 2022/i);
    expect(pixel.descriptions).toHaveLength(7);
    expect(mentions(pixel.descriptions, "500K+ sales")).toBe(true);

    expect(mobile.jobTitle).toMatch(/junior game developer/i);
    expect(mobile.date).toMatch(/september 2018/i);
    expect(mobile.descriptions).toHaveLength(5);
    expect(mentions(mobile.descriptions, "2M+ times")).toBe(true);
  });

  test("education", () => {
    expect(resume.educations).toHaveLength(1);
    const [uw] = resume.educations;
    expect(uw.school).toMatch(/university of washington/i);
    expect(uw.degree).toMatch(/bachelor of science/i);
    expect(uw.degree).toMatch(/computer science/i);
    expect(uw.gpa).toContain("3.6");
    expect(uw.date).toMatch(/2014/);
    expect(uw.date).toMatch(/2018/);
  });

  test("projects", () => {
    const names = resume.projects.map((p) => p.project.toLowerCase());
    expect(names.join("|")).toContain("echoes of the void");
    expect(names.join("|")).toContain("unity dialogue framework");
    expect(names.join("|")).toContain("game jam");
    const echoes = resume.projects.find((p) => /echoes/i.test(p.project))!;
    expect(echoes.date).toMatch(/2023/);
    expect(mentions(echoes.descriptions, "5K+")).toBe(true);
  });

  test("skills, with ratings in range", () => {
    const featured = resume.skills.featuredSkills.map((s) => s.skill.toLowerCase()).join(" | ");
    expect(featured).toMatch(/unity/);
    expect(featured).toMatch(/unreal/);
    for (const { rating } of resume.skills.featuredSkills) {
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(5);
    }
    expect(resume.skills.featuredSkills.length).toBeLessThanOrEqual(6);
    expect(all([...resume.skills.featuredSkills.map((s) => s.skill), ...resume.skills.descriptions])).toMatch(/c#|c\+\+/);
  });

  test("certifications, awards, publications, languages and volunteering are kept in the extras", () => {
    const extras = resume.custom.descriptions;
    expect(mentions(extras, "Unity Certified Expert")).toBe(true);
    expect(mentions(extras, "Unreal Engine 5 C++ Developer")).toBe(true);
    expect(mentions(extras, "Best Gameplay")).toBe(true);
    expect(mentions(extras, "Employee Excellence")).toBe(true);
    expect(mentions(extras, "Optimizing Unity Games for Mobile")).toBe(true);
    expect(mentions(extras, "Polish")).toBe(true);
    expect(mentions(extras, "Seattle Indies")).toBe(true);
  });

  test("invents nothing: every figure in the output appears in the source", () => {
    // A cheap guard against made-up numbers: any percentage in the result must exist in the resume's text.
    const sourceFigures = ["40%", "95%", "25%", "35%", "5%", "500K+", "2M+", "800+", "5K+", "15+", "60+", "12+", "8+", "3,000+", "3.6"];
    const text = JSON.stringify(resume);
    const found = text.match(/\d[\d,.]*[%+KM]*\+?/g) ?? [];
    const dateLike = /^(19|20)\d{2}$/;
    const unknown = found.filter(
      (figure) => /[%+KM]/.test(figure) && !sourceFigures.some((s) => s.includes(figure) || figure.includes(s)) && !dateLike.test(figure)
    );
    expect(unknown).toEqual([]);
  });
});
