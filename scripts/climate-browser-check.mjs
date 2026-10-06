import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('validation', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const report = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:4174/');
  await page.waitForFunction(() => window.__PB_DEBUG__);
  const initial = await page.evaluate(() => window.__PB_DEBUG__.snapshot());
  assert.equal((await page.evaluate(() => window.__PB_DEBUG__.climate())).active, true);
  assert.ok(initial.camera.position.some((value, axis) => Math.abs(value - initial.camera.target[axis]) > 0));
  const point = await page.evaluate(() => window.__PB_DEBUG__.project('co2'));
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(2000);
  const field = await page.evaluate(() => window.__PB_DEBUG__.climate());
  assert.equal(field.active, true);
  assert.equal(field.positions.length, 120);
  const png = PNG.sync.read(await page.locator('canvas').screenshot());
  report.brightNodes = field.projected.filter((point) => {
    if (!point.visible) return false;
    for (let y = Math.round(point.y) - 3; y <= Math.round(point.y) + 3; y++) {
      for (let x = Math.round(point.x) - 3; x <= Math.round(point.x) + 3; x++) {
        if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
        const index = (y * png.width + x) * 4;
        if (Math.max(...png.data.subarray(index, index + 3)) > 80) return true;
      }
    }
    return false;
  }).length;
  assert.ok(report.brightNodes >= 110, `Only ${report.brightNodes} visible data lights`);
  assert.equal(field.mode, 'log');
  await page.selectOption('#climate-scale', 'linear');
  const linear = await page.evaluate(() => window.__PB_DEBUG__.climate());
  await page.screenshot({ path: 'validation/climate-linear.png' });
  await page.selectOption('#climate-scale', 'log');
  const logarithmic = await page.evaluate(() => window.__PB_DEBUG__.climate());
  assert.notDeepEqual(logarithmic.positions, linear.positions);
  await page.screenshot({ path: 'validation/climate-log.png' });
  await page.check('#climate-surface');
  await page.screenshot({ path: 'validation/climate-extent.png' });
  await page.uncheck('#climate-surface');
  const candidate = logarithmic.projected.find((p) => p.visible && p.x > 350 && p.x < 950 && p.y > 180 && p.y < 650);
  assert.ok(candidate);
  await page.mouse.move(candidate.x, candidate.y);
  assert.ok((await page.locator('#hover-label').innerText()).includes(candidate.code));
  await page.mouse.click(candidate.x, candidate.y);
  assert.ok((await page.locator('#panel-reference').innerText()).includes(candidate.code));
  await page.screenshot({ path: 'validation/climate-country.png' });
  await page.mouse.move(650, 350); await page.mouse.down();
  await page.mouse.move(780, 415, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const afterOrbit = await page.evaluate(() => window.__PB_DEBUG__.climate());
  assert.deepEqual(afterOrbit.positions, logarithmic.positions);
  assert.notDeepEqual(afterOrbit.projected, logarithmic.projected);
  await page.mouse.wheel(0, 900); await page.waitForTimeout(200);
  assert.deepEqual((await page.evaluate(() => window.__PB_DEBUG__.climate())).positions, logarithmic.positions);
  const after = await page.evaluate(() => window.__PB_DEBUG__.snapshot());
  assert.equal(after.failed, 0); assert.equal(after.stateUnchanged, true);
  assert.deepEqual(after.points.map((p) => p.position), initial.points.map((p) => p.position));
  await page.locator('#fit').click();
  assert.equal((await page.evaluate(() => window.__PB_DEBUG__.climate())).active, true);
  assert.ok((await page.evaluate(() => window.__PB_DEBUG__.snapshot().camera.position.reduce((sum, value, axis) => sum + (value - window.__PB_DEBUG__.snapshot().camera.target[axis]) ** 2, 0))) > 100);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('#index-trigger').click();
  await page.locator('[data-control="radiative-forcing"]').click();
  await page.waitForTimeout(1900);
  await page.screenshot({ path: 'validation/climate-wide.png' });
  assert.deepEqual(errors, []);
  report.checks = ['120 small country points', 'country picking and raw readout', 'linear/log display', 'optional convex extent', 'orbit and wheel preserve positions', '11 PB radii unchanged', 'full view preserves climate field', '1440 and 1920 desktop screenshots', 'no JS or shader errors'];
  await writeFile('validation/climate-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
