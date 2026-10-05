import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Review-only: do not redistribute the source article or its media in the app.
const html = await fs.readFile('/tmp/naver_0.html', 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const sources = await page.evaluate((text) => {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return [...doc.querySelectorAll('#postViewArea video')].map((v) => v.getAttribute('src'));
}, html);
const results = [];
for (const [i, src] of sources.entries()) {
  try {
    await page.setContent('<body style="margin:0;background:#444"><video muted style="max-width:900px;max-height:600px"></video></body>');
    await page.locator('video').evaluate((v, url) => { v.src = url; v.load(); }, src);
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2, { timeout: 15000 });
    const duration = await page.locator('video').evaluate((v) => v.duration);
    for (let j = 0; j < 4; j++) {
      await page.locator('video').evaluate(async (v, t) => {
        if (t === 0) return;
        await new Promise((resolve) => { v.addEventListener('seeked', resolve, { once: true }); v.currentTime = t; });
      }, duration * j / 4);
      await page.screenshot({ path: `/tmp/astronomy-motion-${i + 1}-${j}.png` });
    }
    results.push({ src, duration, status: 'four temporal samples captured; not exhaustive frame review' });
  } catch (error) { results.push({ src, status: 'unavailable', error: error.message }); }
}
await fs.writeFile('research/astronomy-motion-review.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
await browser.close();
