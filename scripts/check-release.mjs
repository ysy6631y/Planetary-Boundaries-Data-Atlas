import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const url = process.env.ATLAS_TEST_URL || 'http://127.0.0.1:5191/Planetary-Boundaries-Data-Atlas/';
const manifest = JSON.parse(await readFile(new URL('../src/atlas-manifest.generated.json', import.meta.url)));
const output = await mkdtemp(join(tmpdir(), 'planetary-release-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], failures = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }); });
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready, null, { timeout: 90000 });
  assert.equal(await page.locator('canvas').count() >= 1, true);
  await page.screenshot({ path: join(output, 'overview.png') });
  const pending = [...manifest.datasets];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (pending.length) {
      const entry = pending.shift();
      const response = await page.request.get(new URL(entry.url.replace(/^\//, ''), url).href);
      assert(response.ok(), `${entry.id}: ${response.status()}`);
      const data = await response.json();
      assert.equal(data.rows.length, entry.rowCount);
    }
  }));
  await page.waitForFunction(() => window.__PB_EXPLORATION__.getState().stage === 'VISUALIZATION READY', null, { timeout: 60000 });
  const auto = await page.evaluate(() => window.__PB_EXPLORATION__.getState());
  assert.equal(auto.boundaryId, 'climate-change');
  assert.equal(auto.controlId, 'radiative-forcing');
  await page.locator('#index-trigger').click();
  await page.locator('[data-control="co2"]').click();
  await page.waitForFunction(() => !window.__PB_DEBUG__.motion().focusing && window.__PB_DEBUG__.atlas().dataset);
  assert.equal(await page.evaluate(() => window.__PB_EXPLORATION__.getState().mode), 'MANUAL');
  const initial = await page.evaluate(() => window.__PB_DEBUG__.atlas().dataset);
  await page.locator('#analysis-toggle').click();
  const next = await page.locator('#dataset-select option').evaluateAll(es => es.map(e => e.value).find(id => id !== document.querySelector('#dataset-select').value));
  await page.locator('#dataset-select').selectOption(next, { force: true });
  await page.waitForFunction(id => window.__PB_DEBUG__.atlas().dataset === id && !document.querySelector('#local-field').classList.contains('loading'), next);
  assert.notEqual(initial, next);
  await page.locator('#source-record').fill('2');
  await page.locator('#source-record').dispatchEvent('change');
  assert.equal(await page.locator('#inspector').isVisible(), true);
  await page.screenshot({ path: join(output, 'manual-detail.png') });
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  const report = { url, datasets: manifest.datasets.length, sourceRows: manifest.datasets.reduce((n, d) => n + d.rowCount, 0), auto, manual: true, datasetChange: true, inspector: true, errors, failures, output };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
