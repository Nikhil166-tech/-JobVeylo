# JobVeylo

Job listings website for Indian government recruitment and private-sector openings worldwide.

Live site: https://jobveylo.netlify.app

## Stack

- Next.js App Router, React and TypeScript
- Netlify hosting and Next.js runtime
- Netlify Database (PostgreSQL)
- Invite-only Netlify Identity for the owner dashboard

## Develop

Use Node.js 24 (the production version), then run:

```sh
npm ci
npm run dev
```

The public job APIs and owner dashboard require the linked Netlify Database and Identity runtime. For full local integration, use Netlify CLI, sign in to your own account, link this checkout to the existing `jobveylo` project, and run `netlify dev`. Never commit login tokens or database connection strings.

```sh
netlify login
netlify link
netlify dev
```

## Check and deploy

```sh
npm run typecheck
node --experimental-strip-types --test tests/job-import.test.mjs
npm run build
netlify deploy --prod --context production
```

The build uses Webpack for compatibility with the Netlify packager on Windows. `netlify.toml` contains the hosting configuration. Production publication updates the existing site; pushing code to GitHub alone does not deploy it until Git-based deployment is configured in Netlify.

## Manage jobs

Open `/admin`, sign in with the invited owner account, and paste the URL for one opening. The importer fills the form and flags missing information. Review the source, correct the fields, confirm review, and publish. Blocked pages and PDF notices support a pasted-text fallback. Use **Copy community post** after publishing to copy a short message with the permanent job link.

The importer reads JSON-LD JobPosting data or page text. It does not use a paid AI service and cannot extract every field from every website. Missing details require editorial review.

## Files

- `app/`: pages and API routes
- `components/`: job pages, sharing, admin import panel and UI
- `lib/`: validation, extraction, authentication and database access
- `public/`: public assets and the active stylesheet, `style.css`
- `netlify/database/migrations/`: database schema and initial published listings
- `tests/job-import.test.mjs`: extraction and network-target validation tests

## Data and configuration

Current jobs and later admin edits live in Netlify Database, not in Git. The migrations include the initial two listings only; use database backups to preserve later job content. Cloning this repository does not copy live users or current database records.

Owner authorization is configured in `lib/editor-auth.ts`; login and invitation UI is in `app/admin/login/page.tsx`. Contact details and the WhatsApp channel are in `lib/site.ts`. The production origin comes from Netlify's `URL` environment variable; `NEXT_PUBLIC_SITE_URL` is an optional alternative for other environments.

Build output, dependencies, local environment files and Netlify CLI state are excluded through `.gitignore`.

## Public resume builder

`/resume` accepts PDF, DOCX and TXT files (read locally), or structured form input. Visitors select a published job, consent to Groq processing, review an editable draft and download PDF or Word. The manual builder works without an AI key. Contact fields are kept client-side; automatic redaction is best-effort, so visitors must review source text. Resume content is not written to the database or application logs.

Set `GROQ_API_KEY` in Netlify environment variables with Functions runtime scope; never commit it. Optional `GROQ_RESUME_MODEL` defaults to `openai/gpt-oss-20b` served by Groq. Free-tier availability depends on your Groq account. Requests are capped at 3 per connection/day, 20 site-wide/day and 1 site-wide/minute (UTC); failed upstream attempts count. Migration 0003 stores expiring keyed usage counters, not resume text or raw IP addresses. Provider processing and retention are covered in `/privacy`; do not promise zero retention unless configured and verified separately.

Run `node --experimental-strip-types --test tests/resume.test.mjs tests/job-import.test.mjs` for validation checks. `prebuild` and `predev` prepare the PDF worker from the installed package. The PDF export embeds the licensed DejaVu Sans font in `public/fonts`.
