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

`keep_vars: true` preserves variables added through the Cloudflare dashboard during deployments. API keys should still use the **Secret** type, rather than plaintext variables.

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

The ATS Serif template uses a single-column document body, a centered name and professional headline, ruled section headings, serif text, real dash lists and 12.7 mm side margins. Visitors can preview or edit the draft and choose A4 or US Letter for PDF and Word downloads. Uploads fill editable name, headline, location, email, phone and profile/project links on-device, including PDF annotations and Word header/footer hyperlinks. Uncertain fields stay blank with review notices. Manual imports recognise standalone section headings. AI uses the full selected listing and requirements; returned drafts are tied to a hashed job-description snapshot. Changing the selected job or source content clears the draft. Skills require whole-token source support, and every rewritten number must be supported by its section quotes. These checks reduce errors but cannot prove every semantic claim. Long PDFs flow across pages while role titles stay with their dates and first bullet. A small checklist highlights missing contact or education details without inventing content. Formatting does not guarantee parsing, ATS scores or interviews.

`prebuild` and `predev` prepare the PDF worker. PDF and Word exports embed the open-licensed Libertinus Serif regular and bold fonts in `public/fonts`, matching the reference font used by the browser preview. Uploaded PDF link rectangles and Word hyperlink paragraphs preserve project link placement; profile links stay in the header while labeled demo/repository links sit beside their project.

## Migration status

The three published Netlify listings have been exported and restored in Cloudflare D1. Keep Netlify until public pages, owner sign-in, editing/import and AI tailoring are verified on Cloudflare. Existing community links still point to Netlify until changed or redirected.

Project tailoring selects at most four supported, JD-relevant bullets per project. The final project policy is shared by preview and both exports; downloading captures the currently reviewed final draft. Short project blocks stay together across page breaks when they fit on a page. Manual imports keep the first four source bullets until AI tailoring or manual editing prioritises them.

## Scheduled job collection

`jobveylo-collector` is a private Worker sharing the listings D1 database. Its UTC schedule checks due sources at :00 and :30, independently of local computers. The scheduled handler dispatches bounded per-source checks through a private self service binding. There are no public Worker or preview URLs. The owner dashboard calls it through the `COLLECTOR` service binding.

The initial allowlist is AiPrise/Ashby, Safe Security/Lever, Cloudflare/Greenhouse, Employment News and UPSC recruitment notices. This is a starting set, not worldwide or all-government coverage. Blocked/changed sources surface errors and back off; CAPTCHA and access controls are not bypassed. Employment News records require an original employer notice URL before draft creation. UPSC advertisements may cover multiple vacancies and require manual splitting and PDF review.

Collection has a four-minute lease, source-level pauses, duplicate suppression, a maximum of four new records per source/check and 40 pending/source. Successful feed checks mark disappeared openings; two misses block importing a stale candidate. The source check date is not a guarantee of employment availability. Dismissed/imported records are not recreated automatically. Logs contain public source status only; run history expires after 14 days. The separate automatic publisher below implements the owner's updated standing instruction.

Deploy schema first, then the private collector, then rebuild and deploy the website:

```sh
npx wrangler d1 migrations apply jobveylo-db --remote --config wrangler.jsonc
npx wrangler deploy --config wrangler.collector.jsonc
npm run build
npm run deploy
```

Owner controls and source outcomes are available under `/admin` → Collected openings. `Check due sources now` respects source cooldowns and backoff. The first run also detects already-published canonical source URLs, including tracking-parameter variants. Connect publishing providers separately; a chat plugin connection does not provision server-side API credentials.

## Official WhatsApp setup (delivery not enabled)

`/admin/whatsapp` contains the owner setup checklist and proposed job-alert template. `/api/whatsapp/webhook` verifies Meta's challenge and checks the raw-body HMAC signature before processing explicit subscription consent or STOP. Configure `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN` as encrypted Worker secrets, plus `WHATSAPP_PHONE_NUMBER_ID` and the international digits-only `WHATSAPP_BUSINESS_NUMBER`. Start with Meta's test sender and your own verified recipient. Keep tokens out of Git, logs and chat.

Apply migration `0003_whatsapp_optin.sql` before connecting the webhook. Public `/alerts` remains closed until all required settings and `WHATSAPP_SIGNUPS_ENABLED=true` are configured. It creates a consent message for the visitor to send themselves; clicking the link alone does not subscribe them. Consent covers up to one alert per day, with category selection and STOP. Event-time ordering prevents a delayed START from undoing a newer STOP. Dedupe identifiers expire after 30 days; stopped subscriber records are retained to suppress further delivery.

WhatsApp sending remains disabled pending a production business number, approved Meta template and cost review. The official Business Platform subscriber flow does not publish to the existing public WhatsApp Channel. A Metricool chat connection alone cannot run a hosted publishing worker continuously.

## Automatic publication and Instagram queue

On 25 October 2026 the owner explicitly replaced per-job approval with standing authorisation for source-verified website posts and Instagram reels, at one job per half-hour per channel, prioritising roles that accept 0–3 years. Migration `0004_automatic_publishing.sql` enables the website policy. Manual editing remains available and the owner can pause both publishing channels in `/admin`. Source-paused, expired, missing and held records are excluded. Existing live posts are not unpublished or reposted.

The collector's :00/:30 cron dispatches the separate private website publisher and Instagram creator. Unique D1 slot rows prevent duplicate runs or catch-up bursts. Experience priority uses the strongest stated minimum rather than assuming every junior title is suitable for freshers. The homepage also places freshers/early-career roles first. A 2–4-year role is eligible for the early-career bucket because it accepts candidates with two or three years; it is not labelled as a zero-experience role. Unknown experience stays in the unconfirmed bucket.

Automatic pages publish a short original fact summary and source link, without reproducing the complete employer description or inventing interview stages. Government discovery records still require original-notice verification. Publishing checks source availability again; it is not a guarantee that an employer will keep accepting applications.

Instagram delivery uses Instagram API with Instagram Login, restricted to the `jobveylo` username. Configure `INSTAGRAM_ACCOUNT_ID` and encrypted `INSTAGRAM_ACCESS_TOKEN` on the website and collector Workers, and bind a shared KV namespace as `REEL_MEDIA`. This is separate from the existing Metricool connection. Missing/revoked credentials stop Instagram delivery without stopping the website. The token may require reconnection when it expires. `/admin/instagram` shows configuration booleans, queue counts and held outcomes without exposing secrets.

The hosted renderer `.github/workflows/render-job-reel.yml` runs at :11/:41 on the repository's default branch. Create a renderer connection key in `/admin/instagram` and save it as GitHub Actions repository secret `JOBVEYLO_AUTOMATION_KEY`. Only its SHA-256 hash is stored in private KV. Alternatively provision a matching encrypted website Worker secret of that name. This key can only claim public reel jobs and upload MP4s; it does not grant editor access. The renderer produces a 20-second 1080×1920 H.264/AAC video with original instrumental audio. There is no third-party song download. Media uploads are bounded to 1.5 MB and expire from KV after seven days. Profile/resume data is never passed to the renderer.

The publisher stores Instagram container IDs and polls readiness every five minutes. It publishes only finished containers, spaces successful posts by at least 30 minutes, and holds ambiguous outcomes instead of blindly retrying. The existing AiPrise frontend reel scheduled through Metricool is marked external to prevent a second posting. Source conflicts and API errors require reconciliation, not routine per-job permission. GitHub cron and Meta processing may delay delivery; no exact wall-clock guarantee is made. Public-repository schedules can be disabled by GitHub after 60 days without repository activity.
