# JobVeylo Netlify migration

Destination: https://jobveylo.netlify.app
Netlify project: 4a9de2ec-35de-455e-9834-5c909fe7e4f8
Owner email: itharajunikhil61@gmail.com

## Data
The user confirmed on 2026-10-21 that only the two published jobs need migration.
0001_listings creates the schema; 0002_import_public_jobs imports the public export with original slugs and version 1. Original timestamps and source-check dates are preserved.

## Publishing jobs
After activating the invited Identity account, visit /admin. Enter the job details, save a draft, check the employer source, and select Publish opening. The Copy community message action uses the short template and this site's permanent job URL.

## Hosting
Netlify Free, with Next.js runtime, Netlify Database, and invite-only Netlify Identity. No custom domain or paid upgrade requested. The original site is preserved.

## Remaining validation
Confirm successful production deployment, imported job count, public job URLs, unauthorized admin denial, mobile layout, and the owner's account activation/sign-in. Do not describe migration as complete until these are verified.
## Verified deployment (2026-10-21)
Production deploy 6ad847c6fe8041328b5781c3 is ready and published; migrations applied. The site is publicly accessible at https://jobveylo.netlify.app.
Both published jobs return HTTP 200 and the API returns exactly the two imported IDs, each at version 1. Unauthenticated admin GET and POST return 403; /admin redirects to /admin/login.
Home and Amazon detail pages visually checked at 390x844; no horizontal overflow. The build uses Webpack because Turbopack produced a Windows junction that Netlify's packager could not copy.
Owner invitation is prepared but NOT SENT. Await explicit browser-action confirmation to send to itharajunikhil61@gmail.com. The owner must choose the password and complete activation. Authenticated editing still needs verification after activation.
## Job link importer (2026-10-22)
The owner chose review before publication. /api/admin/import is authenticated and same-origin, reads one public HTTPS page with pinned public DNS resolution, bounded response size and timeout, and rejects private IP targets and unsafe redirects. It extracts JSON-LD JobPosting records, otherwise page text; supports pasted text for blocked/PDF sources. It fills an unsaved draft and reports missing fields. Duplicate source links open the existing listing. Publication remains an explicit reviewed action.
Eight extraction/network safety tests pass. A real Amazon job link correctly yielded role, employer, location, experience, education and requirements. TypeScript passed. Next was patched to 16.3.8 following npm audit; installation audit reports zero vulnerabilities.
Netlify production deployment is in progress. Authenticated browser QA pending: the accessible browser still shows /admin/login even though the user reported signing in in another session.

## Importer deployment verified
Production deploy 6ad90fddd0000b68d4eb5c58 is live at https://jobveylo.netlify.app (2026-10-22). Build and TypeScript passed. Authenticated browser QA confirmed exact duplicate-source detection, pasted-text import populating all expected form fields, review warnings, and disabled Publish until review confirmation. Test-only form was discarded; no test listing saved or published. API rejects unauthenticated imports with 403. The public API still returns the original two published listings. Mobile verified at 390x844 with no horizontal overflow; viewport reset. Screenshots: outputs/jobveylo-link-importer.png and outputs/jobveylo-import-mobile.png in the task workspace.
Usage: /admin → Add a job from its link → paste one opening URL → Read link & fill details → review/correct fields → confirm source review → Publish opening. Blocked sites and PDFs have a pasted-description fallback. Unsupported details must be supplied during review; this is extraction rather than AI-generated or independently verified content.
Owner account is activated and the user successfully signed in in the browser during this task.
