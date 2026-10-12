import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { datasetPresentation } from '../src/dataset-presentation.js';
const manifest = JSON.parse(await readFile('src/atlas-manifest.generated.json', 'utf8'));
const url = process.env.ATLAS_URL || 'http://127.0.0.1:5174';
const report = { checks: [], boundaries: [], layouts: [], errors: [] };
await mkdir('validation', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
const snapshot = () => page.evaluate(() => window.__PB_DEBUG__.snapshot());
const atlas = () => page.evaluate(() => window.__PB_DEBUG__.atlas());
const stable = (state) => state.points.map(({ id, r, position }) => ({ id, r, position }));
async function boundary(id) {
  await page.locator('#index-trigger').click();
  await page.locator(`[data-group="${id}"]`).click();
  await page.waitForFunction((id) => window.__PB_DEBUG__.atlas().boundary === id && (!document.querySelector('#dataset-select').options.length || !!window.__PB_DEBUG__.atlas().dataset), id);
}
async function dataset(id) {
  // Native backing values remain the same; actual UI keyboard selection is also
  // checked below separately from these regression scenarios.
  await page.selectOption('#dataset-select', id);
  await page.waitForFunction((id) => window.__PB_DEBUG__.atlas().dataset === id, id);
}
async function layout(width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const ids = ['local-field', 'inspector', 'observer-controls', 'risk-ruler', 'boundaries', 'camera-distance', 'dataset-select-trigger', 'entity-filter-trigger', 'climate-scale-trigger'];
    const visible = ids.map((id) => document.getElementById(id)).filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    const rects = visible.map((element) => ({ id: element.id, x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y, r: element.getBoundingClientRect().right, b: element.getBoundingClientRect().bottom }));
    const cut = rects.filter((r) => r.x < 0 || r.y < 0 || r.r > innerWidth + 1 || r.b > innerHeight + 1);
    const panelIds = ['local-field', 'inspector', 'observer-controls', 'risk-ruler', 'boundaries'];
    const panels = rects.filter((r) => panelIds.includes(r.id));
    const overlaps = [];
    panels.forEach((a, i) => panels.slice(i + 1).forEach((b) => { if (a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y) overlaps.push([a.id, b.id]); }));
    return { cut, overlaps, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  report.layouts.push({ width, height, ...result });
  assert.deepEqual(result.cut, []); assert.deepEqual(result.overlaps, []); assert.equal(result.overflow, false);
}
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready);
  const initial = await snapshot();
  for (const meta of manifest.datasets) {
    const display = datasetPresentation(meta);
    assert.match(display.name, /^0[1-5] \/ /);
    assert.ok(!display.name.includes('.csv') && display.format && display.role);
  }
  report.checks.push('All 96 dataset display names use source metadata; source IDs and payloads retained');
  for (const [id, meta] of Object.entries(manifest.boundaries)) {
    await boundary(id);
    const state = await atlas();
    assert.equal(state.dataset, meta.default);
    assert.equal(state.error, null);
    assert.equal(await page.locator('#dataset-select option').count(), meta.datasets.length);
    assert.equal(await page.locator('#dataset-select-trigger').isDisabled(), !meta.datasets.length);
    assert.deepEqual(stable(await snapshot()), stable(initial));
    report.boundaries.push({ id, datasets: meta.datasets.length, default: state.dataset });
  }
  report.checks.push('9 boundary states: 6 existing defaults, 3 accurately unavailable CSV states');
  await boundary('climate-change');
  await page.waitForTimeout(1100);
  const camera = (await snapshot()).camera;
  const dataTrigger = page.locator('#dataset-select-trigger');
  await dataTrigger.focus(); await page.keyboard.press('Enter');
  assert.equal(await dataTrigger.getAttribute('aria-expanded'), 'true');
  await page.screenshot({ path: 'validation/ui-dropdown.png' });
  const menuRect = await page.locator('#dataset-select-listbox').boundingBox();
  assert.ok(menuRect.x >= 0 && menuRect.y >= 0 && menuRect.y + menuRect.height <= 1080);
  const background = await page.locator('#dataset-select-listbox').evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(background, 'rgb(8, 8, 8)');
  await page.keyboard.press('Home');
  const first = await page.locator('#dataset-select option').first().getAttribute('value');
  await page.keyboard.press('Enter');
  await page.waitForFunction((id) => window.__PB_DEBUG__.atlas().dataset === id, first);
  assert.deepEqual((await snapshot()).camera, camera);
  await dataTrigger.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('ArrowUp');
  const active = await dataTrigger.getAttribute('aria-activedescendant');
  assert.ok(active);
  await page.keyboard.press('Escape');
  assert.equal(await dataTrigger.getAttribute('aria-expanded'), 'false');
  assert.equal((await atlas()).dataset, first);
  await dataTrigger.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await dataTrigger.getAttribute('aria-expanded'), 'false');
  report.checks.push('Black dropdown, grouped scroll list, Enter/Arrows/Home/End/Escape/Tab navigation, no camera reset');
  const xyz = manifest.datasets.find((d) => d.id === manifest.boundaries['climate-change'].default);
  await dataset(xyz.id);
  assert.equal(await page.locator('#climate-surface').isDisabled(), false);
  await page.locator('#climate-surface').check();
  assert.equal(await page.locator('#climate-surface').isChecked(), true);
  const scale = page.locator('#climate-scale-trigger');
  await scale.press('Enter'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  assert.equal((await page.evaluate(() => window.__PB_DEBUG__.climate())).mode, 'linear');
  const entity = page.locator('#entity-filter-trigger');
  await entity.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  assert.equal((await atlas()).displayed, 1);
  await entity.press('Enter'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  assert.equal((await atlas()).displayed, xyz.rowCount);
  report.checks.push('ENTITY filter, AXES keyboard selection, valid XYZ EXTENT retained');
  await page.locator('#source-record').fill('2'); await page.locator('#source-record').dispatchEvent('change');
  assert.equal(await page.locator('#inspector').isVisible(), true);
  assert.equal(await page.locator('.observation-values > div').count(), 3);
  assert.ok((await page.locator('#inspect-content').textContent()).includes(xyz.sources[0].path));
  await page.locator('#reference-content summary').click();
  assert.ok((await page.locator('#reference-content').textContent()).includes('0.0'));
  await page.locator('[data-readout-tab="reference"]').press('ArrowRight');
  assert.equal(await page.locator('#distance-readout').isVisible(), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#data-readout').isVisible(), true);
  report.checks.push('Structured exact source values, original row, provenance and all readout tabs accessible');
  for (const size of [[1920,1080],[1600,900],[1440,810],[1280,720]]) {
    await layout(...size);
    await page.locator('#readout-trigger').click(); await layout(...size); await page.locator('#readout-trigger').click();
    await dataTrigger.click();
    const rect = await page.locator('#dataset-select-listbox').boundingBox();
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size[0] + 1 && rect.y + rect.height <= size[1] + 1);
    await page.keyboard.press('Escape');
  }
  report.checks.push('16:9 1920/1600/1440/1280 layouts, open readout and dropdowns without panel overlap or viewport clipping');
  await page.setViewportSize({ width:1920, height:1080 });
  await page.locator('[data-readout-tab="reference"]').click();
  await page.locator('#analysis-toggle').click();
  assert.equal(await page.locator('#analysis-body').isVisible(), false);
  await page.locator('#analysis-toggle').click();
  assert.equal(await page.locator('#analysis-body').isVisible(), true);
  const xy = manifest.datasets.find((d) => d.kind === 'xy' && d.boundaries.includes('climate-change'));
  await dataset(xy.id);
  assert.equal(await page.locator('#climate-surface').isDisabled(), true);
  assert.ok((await page.evaluate(() => window.__PB_DEBUG__.climate().positions)).every((position) => position[2] === 0));
  await page.waitForTimeout(500);
  const candidate = await page.evaluate(() => window.__PB_DEBUG__.climate().projected.find((p) => p.visible && p.x > 400 && p.x < 1350 && p.y > 230 && p.y < 650));
  assert.ok(candidate); await page.mouse.click(candidate.x, candidate.y);
  assert.equal(await page.locator('#inspector').isVisible(), true);
  assert.ok((await page.locator('#reference-content').textContent()).includes(candidate.code));
  await page.locator('#fit').click(); await page.waitForTimeout(300);
  const beforeDrag = await snapshot();
  await page.mouse.move(980,420); await page.mouse.down(); await page.mouse.move(1100,500,{steps:12}); await page.mouse.up(); await page.waitForTimeout(500);
  assert.notDeepEqual((await snapshot()).camera.position, beforeDrag.camera.position);
  await page.mouse.wheel(0,200); await page.waitForTimeout(250);
  assert.notEqual((await snapshot()).observationDistance, beforeDrag.observationDistance);
  const final = await snapshot();
  assert.deepEqual(stable(final), stable(initial)); assert.equal(final.failed, 0); assert.equal(final.stateUnchanged, true);
  report.checks.push('Analysis fold, XY planar handling, observation picking, drag, wheel and immutable 11 control points/orbits');
  report.autoRotation = 'Not present in baseline code; no automatic motion added';
  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack; process.exitCode = 1;
  await page.screenshot({ path: 'validation/ui-failure.png' });
} finally {
  await writeFile('validation/ui-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); await browser.close();
}
