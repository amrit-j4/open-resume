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
    "matchScore": 82,                       // 0-100. When there is a breakdown, the sum of its five scores
    "breakdown": [                          // where the score comes from; [] if the model gave no usable one
      { "key": "skills", "label": "Required skills", "score": 34, "max": 40, "note": "Why points were lost; empty when full" }
      // then experience (max 25), keywords (20), education (10), clarity (5), always in this order
    ],
    "editNote": "...",                      // why wording can or can't close the gap; often empty. Show it above the edits
    "verdict": "Strong fit. ...",
    "job": { "title": "...", "company": "..." },
    "matchedKeywords": ["Python", "SQL"],
    "missingKeywords": [{ "keyword": "dbt", "importance": "high|medium|low", "advice": "..." }],
    "strengths": ["..."],
    "gaps": ["..."],
    "edits": [{
      "id": "edit-1",
      "kind": "replace|add",
      "section": "summary|workExperiences|educations|projects|skills",
      "entryIndex": 0,                      // which job, school or project (0-based). Only for workExperiences, educations and projects
      "bulletIndex": 1,                     // replace: which bullet (0-based). add: the position to insert at. Not for summary
      "where": "Brightwave Retail",         // a label to show
      "before": "...",                      // the text replaced; "" for an add
      "after": "...", "reason": "...",
      "basedOn": "..."                      // add only: the part of the resume the new text comes from
    }]
  },
  "resume": { /* Resume: the resume as read. Every edit applies to this */ },
  "tailoredResume": { /* Resume: `resume` with every edit applied */ },
  "job": { "source": "text|link", "url": "https://..." }   // url only for a link, after redirects
}
```

Takes about 30 to 60 seconds, so use a long client timeout and show progress. Put any proxy or gateway timeout above 90 seconds.

### Edits: reworded or added, never invented

The model proposes **edits**, each a single change at an exact place. That is what lets a client show each suggestion on its own and let the
user accept or reject it: apply only the accepted ones to `resume`.

- A **replace** swaps the text at `section` + `entryIndex` + `bulletIndex` for `after`. `before` is always the text that is really there.
- An **add** puts `after` in as a new bullet (or skills line). `bulletIndex` is the position among the bullets the entry has in `resume`: `0`
  puts it first and the bullet count puts it last. `basedOn` says which part of the resume it comes from; show it to the user.
- Every position refers to `resume` as it was read, never to the result of another edit. So any subset of the edits can be applied, in any
  order. Replace the text first, then slot the adds in around the original bullets; adds at the same position keep the order they came in.
  The web page does this live with `applyEdits` in `src/app/lib/resume-analysis/apply-edits.ts`.
- Every edit is checked on the server before it is returned. It is dropped if it points at a place that doesn't exist, only changes
  punctuation or capitals, or uses a figure that isn't written in its own entry (the summary may use any figure the resume has).
  At most one edit per place, at most 20 edits.
- An **add** is held to a stricter standard. It must use only words the resume already uses, so it can't bring in a tool or skill; it can't
  repeat a bullet that is already there; it needs a `basedOn`; it can't go in the summary; and there are at most 6 of them.
- Contact details, employers, titles, dates, schools, degrees, featured skills and the extras (certifications, awards, publications,
  languages) can't be edited.
- Missing keywords are advice only: they are never written into the resume.
- `tailoredResume` is `resume` with all edits applied, for clients that don't offer a choice.

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
