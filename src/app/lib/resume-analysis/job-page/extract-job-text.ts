export const MAX_JOB_TEXT_LENGTH = 30_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  copy: "©",
};

const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Plain text from HTML: scripts and styles dropped, block tags turned into line breaks, entities decoded, whitespace tidied. */
export const htmlToText = (html: string): string => {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ");

  const withBreaks = withoutNoise
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|ul|ol|tr|table|blockquote)\s*>/gi, "\n")
    .replace(/<(p|div|section|article|h[1-6]|ul|ol|tr|table|blockquote)\b[^>]*>/gi, "\n");

  return decodeEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;

const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  const object = asObject(value);
  return object ? asText(object.name ?? object.value ?? "") : "";
};

const isJobPosting = (node: Json): boolean => {
  const type = node["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
};

/** Every JobPosting object inside the page's JSON-LD blocks (they may sit in arrays or an @graph). */
const findJobPostings = (html: string): Json[] => {
  const found: Json[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    const node = asObject(value);
    if (!node) return;
    if (isJobPosting(node)) found.push(node);
    if (node["@graph"]) visit(node["@graph"]);
  };

  for (const match of Array.from(html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi))) {
    try {
      visit(JSON.parse(match[1].trim()));
    } catch {
      // A block that isn't valid JSON is just skipped.
    }
  }
  return found;
};

const salaryText = (value: unknown): string => {
  const salary = asObject(value);
  const amount = asObject(salary?.value);
  if (!salary || !amount) return "";
  const range = amount.minValue != null && amount.maxValue != null ? `${amount.minValue} - ${amount.maxValue}` : asText(amount.value);
  return range ? `${range} ${asText(salary.currency)} ${asText(amount.unitText)}`.trim() : "";
};

const locationText = (value: unknown): string => {
  const places = Array.isArray(value) ? value : [value];
  return places
    .map((place) => {
      const address = asObject(asObject(place)?.address);
      return address
        ? [address.addressLocality, address.addressRegion, address.addressCountry].map(asText).filter(Boolean).join(", ")
        : asText(place);
    })
    .filter(Boolean)
    .join("; ");
};

/** The job's own structured data, written out as text. Descriptions in it are HTML, so they are converted too. */
const jobPostingToText = (job: Json): string => {
  const lines: string[] = [];
  const add = (label: string, value: string) => value && lines.push(`${label}: ${value}`);

  add("Job title", asText(job.title));
  add("Company", asText(job.hiringOrganization));
  add("Location", locationText(job.jobLocation));
  add("Remote", asText(job.jobLocationType));
  add("Employment type", asText(job.employmentType));
  add("Salary", salaryText(job.baseSalary));
  add("Experience", asText(job.experienceRequirements));
  add("Education", asText(job.educationRequirements));
  add("Skills", asText(job.skills));
  add("Qualifications", htmlToText(asText(job.qualifications)));
  add("Responsibilities", htmlToText(asText(job.responsibilities)));
  const description = htmlToText(asText(job.description));
  if (description) lines.push("", description);
  return lines.join("\n");
};

export interface JobText {
  text: string;
  /** `structured` when the page carried the job as JobPosting data; `page` when the text was taken from the visible page. */
  source: "structured" | "page";
}

const MIN_USEFUL_LENGTH = 200;

/** The job description text of a web page: its JobPosting data when it has any, otherwise the readable text of the page. */
export const extractJobText = (html: string): JobText | null => {
  for (const posting of findJobPostings(html)) {
    const text = jobPostingToText(posting);
    if (text.length >= MIN_USEFUL_LENGTH) {
      return { text: text.slice(0, MAX_JOB_TEXT_LENGTH), source: "structured" };
    }
  }

  const title = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  const body = htmlToText(/<body\b[\s\S]*<\/body\s*>/i.exec(html)?.[0] ?? html);
  const text = [title ? decodeEntities(title).trim() : "", body].filter(Boolean).join("\n\n");
  return text.length >= MIN_USEFUL_LENGTH ? { text: text.slice(0, MAX_JOB_TEXT_LENGTH), source: "page" } : null;
};
