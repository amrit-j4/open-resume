# Resume API

Two endpoints on the resume app (`https://cv.job4online.com.au`), used by the web pages and available to the mobile app. Both read a resume with
Gemini. Nothing is stored: files and text are processed in memory.

## Authentication

Send **one** of:

| Header | When |
|---|---|
| `Authorization: Bearer <Job4Online access token>` | A signed-in job seeker. The server checks the token with the API (`GET /auth/me`). The web pages use this. |
| `x-api-key: <RESUME_IMPORT_API_KEY>` | A shared secret, for callers with no user token. Set `RESUME_IMPORT_API_KEY` on the server; with it unset, this header is never accepted. |

Without either: `401 { "error": "Sign in to ..." }`.

Server settings: `GEMINI_API_KEY` (required), `GEMINI_GENERATION_MODEL` (optional, default `gemini-2.5-flash`), `RESUME_IMPORT_API_KEY` (optional).
Keep them in `.env.local`, never in `.env` (which is committed). See `.env.example`.

## Errors

Every error is `{ "error": "<message safe to show the user>" }` with a status:

| Status | Meaning |
|---|---|
| 400 | Bad request: missing or conflicting fields, bad link, resume or job too short or empty |
| 401 | Not signed in |
| 413 | File over 5 MB, or builder resume JSON over 200 KB |
| 415 | File is not a PDF or Word `.docx` |
| 422 | The file, page or model answer couldn't be read |
| 502 | The AI service failed or couldn't be reached |
| 503 | The server has no `GEMINI_API_KEY` |

## `POST /api/resume-import`

`multipart/form-data` with one field, `file`: a PDF or Word `.docx`, up to 5 MB. The type is decided from the file's content, not its name.

`200 { "resume": Resume }`. Takes about 5 to 10 seconds.

## `POST /api/resume-analysis`

`multipart/form-data`. Give **exactly one** resume field and **exactly one** job field.

| Field | Value |
|---|---|
| `file` | The resume as a PDF or Word `.docx`, up to 5 MB |
| `resume` | Or: the resume builder's `Resume` as a JSON string, up to 200 KB (the resume app keeps it in localStorage under `job4online-resume-state`) |
| `jobText` | The job description, at least 80 characters (longer than 30,000 is cut) |
| `jobUrl` | Or: a link to a job page. The server fetches it (see below) and uses the page's job posting data, or its readable text |

`200`:

```jsonc
{
  "analysis": {
    "matchScore": 82,                       // 0-100
    "verdict": "Strong fit. ...",
    "job": { "title": "...", "company": "..." },
    "matchedKeywords": ["Python", "SQL"],
    "missingKeywords": [{ "keyword": "dbt", "importance": "high|medium|low", "advice": "..." }],
    "strengths": ["..."],
    "gaps": ["..."],
    "changes": [{ "section": "summary|workExperiences|educations|projects|skills|custom", "where": "...", "before": "...", "after": "...", "reason": "..." }]
  },
  "resume": { /* Resume: the resume as read */ },
  "tailoredResume": { /* Resume: reworded for this job; load this into the builder */ },
  "job": { "source": "text|link", "url": "https://..." }   // url only for a link, after redirects
}
```

Takes about 30 to 60 seconds, so use a long client timeout and show progress. Put any proxy or gateway timeout above 90 seconds.

### The tailored resume is reworded, never invented

Whatever the model returns, the server puts back contact details, employers, titles, dates, schools, degrees and the number of entries; keeps
the original bullets of any entry whose rewrite brings in a number that isn't in the original; and drops skills with no evidence in the
original. `changes` only lists edits that survived those checks. Missing keywords are advice only: they are never added to the resume.

### Job links

Only public web pages on ports 80 and 443 are fetched. The server refuses private, loopback, link-local and metadata addresses (checked when
it connects, so DNS tricks don't help), follows at most 3 redirects (each checked again), gives up after 10 seconds, reads at most 3 MB, and
accepts only HTML or plain text. Sites that block bots, or pages that need JavaScript, answer `422` with a message telling the user to paste
the description instead.

## `Resume`

```ts
interface Resume {
  profile: { name: string; email: string; phone: string; url: string; summary: string; location: string };
  workExperiences: { company: string; jobTitle: string; date: string; descriptions: string[] }[];
  educations: { school: string; degree: string; date: string; gpa: string; descriptions: string[] }[];
  projects: { project: string; date: string; descriptions: string[] }[];
  skills: { featuredSkills: { skill: string; rating: number /* 1-5 */ }[]; descriptions: string[] };
  custom: { descriptions: string[] };   // certifications, awards, languages, volunteering, interests
}
```

The builder has a single `url` field, so only one link survives an import; further links are dropped.
