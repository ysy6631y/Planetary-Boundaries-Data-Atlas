import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('src/atlas-manifest.generated.json', 'utf8'));
await mkdir('validation', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], report = { boundaries: [], screenshots: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:4174/');
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready);
  const original = await page.evaluate(() => window.__PB_DEBUG__.snapshot().points.map((p) => p.position));
  const selectBoundary = async (id) => {
    if (await page.locator('#index-trigger').getAttribute('aria-expanded') !== 'true') await page.locator('#index-trigger').click();
    await page.locator(`[data-group="${id}"]`).click();
    if (manifest.boundaries[id].datasets.length) await page.waitForFunction((group) => window.__PB_DEBUG__.atlas().boundary === group && !!window.__PB_DEBUG__.atlas().dataset, id);
    else await page.waitForFunction((group) => window.__PB_DEBUG__.atlas().boundary === group, id);
  };
  for (const [id, boundary] of Object.entries(manifest.boundaries)) {
    await selectBoundary(id);
    assert.equal(await page.locator('#dataset-select option').count(), boundary.datasets.length);
    const state = await page.evaluate(() => window.__PB_DEBUG__.atlas());
    assert.equal(state.error, null);
    if (!boundary.datasets.length) assert.equal(state.dataset, null);
    report.boundaries.push({ id, datasetCount: boundary.datasets.length, displayed: boundary.datasets.length ? state.displayed : 0 });
    if (['biosphere-integrity', 'novel-entities', 'ocean-acidification'].includes(id)) {
      await page.waitForTimeout(1100);
      const path = `validation/atlas-${id}.png`; await page.screenshot({ path }); report.screenshots.push(path);
      if (boundary.datasets.length) {
        const png = PNG.sync.read(await page.locator('canvas').screenshot());
        let bright = 0;
        for (let i = 0; i < png.data.length; i += 4) if (Math.max(...png.data.subarray(i, i + 3)) > 40) bright++;
        assert.ok(bright > 100, 'Blank data field');
      }
    }
  }
  await selectBoundary('land-system-change');
  const xy = manifest.datasets.find((d) => d.kind === 'xy' && d.boundaries.includes('land-system-change'));
  await page.selectOption('#dataset-select', xy.id);
  await page.waitForFunction((id) => window.__PB_DEBUG__.atlas().dataset === id, xy.id);
  assert.equal(await page.locator('#climate-surface').isDisabled(), true);
  assert.ok((await page.evaluate(() => window.__PB_DEBUG__.climate().positions)).every((p) => p[2] === 0));
  await page.waitForTimeout(1000);
  const candidate = await page.evaluate(() => window.__PB_DEBUG__.climate().projected.find((p) => p.visible && p.x > 320 && p.x < 950 && p.y > 150 && p.y < 650));
  assert.ok(candidate);
  await page.mouse.click(candidate.x, candidate.y);
  assert.equal(await page.locator('#inspector').isVisible(), true);
  assert.ok((await page.locator('#inspect-content').textContent()).includes(xy.sources[0].path));
  await selectBoundary('climate-change');
  const history = manifest.datasets.find((d) => d.kind === 'history' && d.rowCount > 35000);
  await page.selectOption('#dataset-select', history.id);
  await page.waitForFunction((id) => window.__PB_DEBUG__.atlas().dataset === id, history.id);
  assert.equal((await page.evaluate(() => window.__PB_DEBUG__.atlas())).sourceRows, history.rowCount);
  const full = await page.evaluate(() => window.__PB_DEBUG__.climate().positions);
  await page.selectOption('#entity-filter', { label: 'Afghanistan' });
  const filtered = await page.evaluate(() => window.__PB_DEBUG__.climate().positions);
  assert.ok(filtered.length < full.length && filtered.length > 0);
  assert.ok(filtered.every((p) => full.some((q) => JSON.stringify(p) === JSON.stringify(q))));
  await page.locator('#source-record').fill('2'); await page.locator('#source-record').dispatchEvent('change');
  assert.ok((await page.locator('#inspect-content').textContent()).includes(history.sources[0].path));
  const records = manifest.datasets.find((d) => d.role === 'red-points' && d.boundaries.includes('climate-change'));
  await page.selectOption('#dataset-select', records.id);
  await page.waitForFunction((id) => window.__PB_DEBUG__.atlas().dataset === id, records.id);
  assert.equal((await page.evaluate(() => window.__PB_DEBUG__.atlas())).displayed, 0);
  assert.ok((await page.locator('#reference-content').textContent()).includes('selection_rule'));
  const delayed = manifest.datasets.find((d) => d.kind === 'history' && d.title.includes('14_co2'));
  await page.route(`**${delayed.url}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350)); await route.continue();
  });
  await page.selectOption('#dataset-select', delayed.id);
  await selectBoundary('biosphere-integrity');
  await page.waitForTimeout(500);
  assert.equal((await page.evaluate(() => window.__PB_DEBUG__.atlas())).dataset, manifest.boundaries['biosphere-integrity'].default);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(1100); await page.screenshot({ path: 'validation/atlas-wide.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const final = await page.evaluate(() => window.__PB_DEBUG__.snapshot());
  assert.equal(final.failed, 0); assert.equal(final.stateUnchanged, true);
  assert.deepEqual(final.points.map((p) => p.position), original);
  assert.deepEqual(errors, []);
  report.checks = ['9 boundaries', 'all dataset menus', 'XY no fake Z or volume', 'source picking', '38150-row history', 'entity filter retains positions', 'RED source records separate cohort', 'stale async loads cannot replace new selection', 'immutable PB radii', 'desktop 1440/1920', 'no JS/shader errors'];
  await writeFile('validation/atlas-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }
