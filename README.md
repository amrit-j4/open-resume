# Job4online Resume Builder

The resume builder and resume parser for [Job4online](https://job4online.com.au).

Create a modern, ATS-friendly resume in a few steps, or test an existing resume's ATS readability with the built-in parser. Resume data stays in the user's browser while building; a free Job4online account is required to download the finished resume.

## Attribution and licence

This project is a modified version of [OpenResume](https://github.com/xitanggg/open-resume), created by Xitang Zhao and designed by Zhigang Wen.

It is licensed under the **GNU Affero General Public License v3.0** (see [LICENSE](LICENSE)). In accordance with section 13 of the AGPL, the source code of the deployed version is made available to its users, and any modified version you run for others over a network must offer its source in the same way.

Changes from upstream: Job4online branding and logo, IBM Plex Sans UI font, a neutral colour theme and radius matching Reactive Resume's styling, rewritten homepage copy, removal of upstream testimonials and analytics.

## Tech stack

Next.js 13 (App Router), React, Redux Toolkit, Tailwind CSS, `@react-pdf/renderer` and `pdfjs-dist`.

The source code is in `src/app`.

## Local development

```bash
git clone <this repository>
cd <this repository>
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker

```bash
docker build -t job4online-resume .
docker run -p 3000:3000 job4online-resume
```

No environment variables are required.

## Before deploying

Set `SOURCE_CODE_URL` in `src/app/lib/site-config.ts` to this repository's public URL. It is linked from the site footer.
