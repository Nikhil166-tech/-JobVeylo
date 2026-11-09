"""Capture a public JobVeylo listing for the automated screen-style reel."""
from pathlib import Path
from urllib.parse import urlparse
import re

ORIGIN = 'https://jobveylo.jobveylo.workers.dev'

def capture_job_page(job, destination):
    from playwright.sync_api import sync_playwright
    job_id = str(job.get('id', ''))
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', job_id):
        raise ValueError('Invalid public job ID')
    url = ORIGIN + '/jobs/' + job_id
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 960}, device_scale_factor=1.5,
                                      reduced_motion='reduce', service_workers='block')
        # Public read-only page capture: no sign-in, cookies, API key or clicks.
        page = context.new_page()
        response = page.goto(url, wait_until='networkidle', timeout=45000)
        if not response or response.status != 200 or urlparse(page.url).netloc != urlparse(ORIGIN).netloc:
            raise RuntimeError('Public job page unavailable; reel not rendered')
        page.locator('h1').wait_for()
        if page.locator('h1').inner_text().strip() != str(job['title']).strip():
            raise RuntimeError('Public job title differs from queued job; review required')
        overview = page.locator('#job-overview').inner_text()
        if str(job['company']) not in overview or str(job['experience']) not in overview:
            raise RuntimeError('Public job facts changed; reel not rendered')
        page.evaluate('document.fonts.ready')
        # Screenshot the real public page at its normal top position.
        page.screenshot(path=str(destination), full_page=False, animations='disabled')
        browser.close()
    return Path(destination)
