import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const prefix = process.argv[2] || 'ui-after';
const url = process.env.ATLAS_URL || 'http://127.0.0.1:5174';
await mkdir('validation', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url);
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready);
  await page.screenshot({ path: `validation/${prefix}-overview.png` });
  await page.locator('#index-trigger').click();
  await page.locator('[data-group="climate-change"]').click();
  await page.waitForFunction(() => !!window.__PB_DEBUG__.atlas().dataset);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `validation/${prefix}-analysis.png` });
  await page.locator('#source-record').fill('2');
  await page.locator('#source-record').dispatchEvent('change');
  await page.screenshot({ path: `validation/${prefix}-record.png` });
} finally { await browser.close(); }
