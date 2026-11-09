# Automated public-page reels

The owner requested the screen-recording style of Instagram reel DerXl7uBlqk.

GitHub Actions captures the actual public JobVeylo page at a 1440×960 desktop viewport in an isolated, headless Chromium browser. It verifies the page title, employer and experience against the claimed job. No Instagram login, desktop recording or personal browser profile is involved. Failed or changed pages do not produce a video.

The 15-second reel uses a landscape monitor frame with subtle zoom and drift on that desktop screenshot, with company/hiring, role and true experience overlays. Employer-disclosed salary may appear in the opening five seconds. The final overlay promotes free ATS-friendly resume tailoring and the bio link. The existing original instrumental remains; native trending Telugu/English song selection is not connected.

The existing three daily IST windows remain 09:00, 13:00 and 19:00. An end timestamp of zero explicitly means an ongoing schedule; a nonzero timestamp still bounds a trial. Jobs still require the shared 0–3-year policy and employer availability verification. A/B labels from the old layout trial must not be interpreted as comparing layouts after this switch.

Previously published reels are not edited or reposted. Unpublished prepared media is returned to rendering for the new format. New screenshots and videos are generated in the renderer's temporary directory, uploaded through its existing authenticated endpoint, and deleted from the runner when the job ends.

Validation: public desktop-page capture succeeded for a queued Twilio Software Development Engineer role. The final 15-second MP4 is 739,349 bytes (below the 1.5 MB upload limit); local rendering completed in 85 seconds. First and final overlay frames were inspected. All 24 targeted scheduling/publishing/policy checks passed; site build and both Worker deployments succeeded. This local sample is not evidence of an Instagram publication.
