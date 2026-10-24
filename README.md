# JobVeylo

Mobile-first job listings for Indian government recruitment and private-sector openings worldwide.

Production target: https://jobveylo.jobveylo.workers.dev

## Stack and development

Next.js App Router and React, built with Vinext for Cloudflare Workers. Cloudflare D1 stores listings, hashed owner sessions and expiring AI usage records. Use Node.js 24.

```sh
npm ci
npm run dev
```

Apply the local schema with `npx wrangler d1 migrations apply jobveylo-db --local`. Local D1 is separate from production. For login tests, use an HTTPS development callback registered in a separate GitHub OAuth app; session cookies require HTTPS.

## Production configuration

`wrangler.jsonc` defines the Worker, D1 binding, production origin and immutable owner GitHub ID. No paid cache, storage or image services are required.

Configure these Worker secrets privately through Cloudflare or `wrangler secret put`:

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: a GitHub OAuth app with homepage equal to the production origin and callback `https://jobveylo.jobveylo.workers.dev/api/auth/callback`.
- `GROQ_API_KEY`: required for AI resume tailoring. The manual builder works without it.
- Optional `GROQ_RESUME_MODEL`: defaults to `openai/gpt-oss-20b`.

Owner sign-in accepts only GitHub ID `135293869` (`Nikhil166-tech`). OAuth uses state and PKCE, requests no repository or private-email scopes, rejects tokens with additional scopes, and stores only a hash of the eight-hour session token.

Never commit secrets, Wrangler credentials, `.dev.vars`, database exports or build output.

## Check and deploy

```sh
npm run typecheck
node --experimental-strip-types --test tests/*.test.mjs
npm run build
npx wrangler deploy --dry-run --config dist/server/wrangler.json
npm run deploy
```

Apply schema changes explicitly with `npx wrangler d1 migrations apply jobveylo-db --remote` before deploying code that requires them. The compressed Worker is approximately 1.2 MB; recheck size and free-plan resource limits when adding features.

A Git push does not publish until Workers Builds is connected. For that connection, use branch `main`, Node 24, build command `npm run build`, and deploy command `npx wrangler deploy --config dist/server/wrangler.json`. Select this repository through Cloudflare's Git integration. Restrict production secrets to trusted builds. Do not run database migrations automatically on every commit.

## Jobs and backups

Open `/admin`, sign in with the owner GitHub account and paste one opening URL. Review extracted information, correct missing fields, confirm review and publish. Blocked pages and PDF notices support pasted source text. The importer does not require an AI API and never publishes without review.

Published pages use stable `/jobs/:slug` URLs. Job details, qualifications, selection stages and application instructions appear as readable points. Unknown stages are not invented. Use **Copy community post** to share the permanent link.

Current jobs and edits live in D1, not Git. Export a backup with `npx wrangler d1 export jobveylo-db --remote --output <private-backup-path>`. Keep exports outside the repository. Historical Netlify migrations contain original seed data, not a current backup.

## Resume builder

`/resume` accepts PDF, DOCX and TXT files read in the browser, or structured form input. Visitors choose a job, consent to Groq processing, review an editable draft and download PDF or Word. Contact fields stay client-side; automatic redaction is best-effort, so visitors must review source text. Resume contents are not stored in D1 or application logs.

AI usage is capped at three requests per connection per UTC day, 20 site-wide per day and one site-wide per minute. A single conditional D1 insert reserves quotas atomically; failed upstream attempts count. Expiring HMAC records do not contain resume text or raw IP addresses. Provider processing is described in `/privacy`.

The ATS Serif template uses a single-column document body, a centered name and professional headline, ruled section headings, serif text, real dash lists and 12.7 mm side margins. Visitors can preview or edit the draft and choose A4 or US Letter for PDF and Word downloads. Manual imports recognise standalone section headings. Long PDFs flow across pages while role titles stay with their dates and first bullet. A small checklist highlights missing contact or education details without inventing content. Formatting does not guarantee parsing, ATS scores or interviews.

`prebuild` and `predev` prepare the PDF worker. PDF export embeds the licensed DejaVu Serif regular and bold fonts in `public/fonts`; Word uses Times New Roman.

## Migration status

The three published Netlify listings have been exported and restored in Cloudflare D1. Keep Netlify until public pages, owner sign-in, editing/import and AI tailoring are verified on Cloudflare. Existing community links still point to Netlify until changed or redirected.
