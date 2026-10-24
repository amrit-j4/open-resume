import { extractJobText, htmlToText, MAX_JOB_TEXT_LENGTH } from "lib/resume-analysis/job-page/extract-job-text";

const LONG = "We are looking for an experienced engineer to join our growing platform team and help build reliable products. ".repeat(3);

describe("htmlToText", () => {
  test("drops scripts, styles and comments, and keeps the readable text", () => {
    const text = htmlToText("<style>p{color:red}</style><script>alert(1)</script><!-- hidden --><p>Hello <b>world</b></p>");
    expect(text).toBe("Hello world");
  });

  test("turns list items and block tags into separate lines", () => {
    const text = htmlToText("<h2>Duties</h2><ul><li>Build APIs</li><li>Review code</li></ul><p>Apply now</p>");
    expect(text).toContain("- Build APIs\n- Review code");
  });

  test("decodes named and numeric entities, and leaves unknown ones alone", () => {
    expect(htmlToText("Tom &amp; Jerry &mdash; caf&#233; &#x1F600; &nosuchthing; &#0;")).toBe("Tom & Jerry — café \u{1F600} &nosuchthing; &#0;");
  });

  test("collapses runs of spaces and blank lines", () => {
    expect(htmlToText("<p>a   \t b</p>\n\n\n\n<p>c</p>")).toBe("a b\n\nc");
  });

  test("does not execute or keep script content that spans lines", () => {
    expect(htmlToText("<script>\nvar secret = 1;\n</script>Visible")).toBe("Visible");
  });
});

describe("extractJobText", () => {
  test("prefers the page's JobPosting data", () => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Data Analyst",
      hiringOrganization: { "@type": "Organization", name: "Brightwave Retail" },
      jobLocation: { "@type": "Place", address: { addressLocality: "Melbourne", addressRegion: "VIC", addressCountry: "AU" } },
      employmentType: ["FULL_TIME"],
      baseSalary: { currency: "AUD", value: { minValue: 120000, maxValue: 140000, unitText: "YEAR" } },
      description: `<p>${LONG}</p><ul><li>Python</li><li>SQL</li></ul>`,
    };
    const html = `<html><head><title>ignored</title><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><p>cookie banner</p></body></html>`;

    const result = extractJobText(html)!;

    expect(result.source).toBe("structured");
    expect(result.text).toContain("Job title: Senior Data Analyst");
    expect(result.text).toContain("Company: Brightwave Retail");
    expect(result.text).toContain("Location: Melbourne, VIC, AU");
    expect(result.text).toContain("Employment type: FULL_TIME");
    expect(result.text).toContain("Salary: 120000 - 140000 AUD YEAR");
    expect(result.text).toContain("- Python");
    expect(result.text).not.toContain("cookie banner");
  });

  test("finds a JobPosting inside an @graph", () => {
    const ld = { "@graph": [{ "@type": "WebSite" }, { "@type": ["JobPosting", "Thing"], title: "Chef", description: LONG }] };
    const html = `<script type='application/ld+json'>${JSON.stringify(ld)}</script>`;
    expect(extractJobText(html)).toMatchObject({ source: "structured" });
  });

  test("skips invalid JSON-LD and falls back to the page text", () => {
    const html = `<html><head><title>Chef at Salt &amp; Co</title><script type="application/ld+json">{ not json</script></head><body><h1>Chef</h1><p>${LONG}</p></body></html>`;
    const result = extractJobText(html)!;
    expect(result.source).toBe("page");
    expect(result.text.startsWith("Chef at Salt & Co")).toBe(true);
    expect(result.text).toContain("experienced engineer");
  });

  test("ignores a JobPosting that is too short to be a description", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Chef" })}</script><body><p>${LONG}</p></body>`;
    expect(extractJobText(html)!.source).toBe("page");
  });

  test("returns null when the page has no real content", () => {
    expect(extractJobText("<html><body><div id='root'></div><script>app()</script></body></html>")).toBeNull();
    expect(extractJobText("")).toBeNull();
  });

  test("caps very long text", () => {
    const html = `<body><p>${"word ".repeat(20_000)}</p></body>`;
    expect(extractJobText(html)!.text.length).toBe(MAX_JOB_TEXT_LENGTH);
  });
});
