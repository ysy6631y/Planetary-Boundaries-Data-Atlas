import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { checks: [], screenshots: [], errors: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
const state = () => page.evaluate(() => window.__PB_DEBUG__.snapshot());
const observation = () => page.evaluate(() => window.__PB_DEBUG__.observation());
const coordinates = (s) => s.points.map(({ id, r, position }) => ({ id, r, position }));
async function capture(name) {
  await page.screenshot({ path: `validation/${name}.png`, fullPage: true });
  const png = PNG.sync.read(await page.locator('canvas').screenshot());
  let pixels = 0;
  for (let i = 0; i < png.data.length; i += 4) if (Math.max(...png.data.subarray(i, i + 3)) > 20) pixels++;
  assert.ok(pixels > 250, 'Canvas is nonblank');
  report.screenshots.push({ name, pixels, width: png.width, height: png.height });
}

try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__PB_DEBUG__?.snapshot().passed === 11);
  const baseline = await state();
  await page.locator('#observer-tab').click();
  assert.equal(await page.locator('#state-panel').isVisible(), false);
  assert.equal(await page.locator('#observer-panel').isVisible(), true);
  const before = await observation();
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width * .65, canvas.y + canvas.height * .6);
  await page.mouse.wheel(0, 100); await page.waitForTimeout(300);
  const zoom = await observation();
  assert.ok(Math.abs(zoom.camera.observationDistance / before.camera.observationDistance - Math.exp(-.016)) < 1e-8);
  assert.deepEqual(zoom.camera.target, before.camera.target);
  assert.equal(zoom.camera.fov, before.camera.fov);
  assert.deepEqual(coordinates(await state()), coordinates(baseline));
  report.checks.push('One downward 100px wheel reduces observation distance by 1.587%, same FOV/target/data');
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * .85, canvas.y + canvas.height * .69, { steps: 12 });
  await page.mouse.up(); await page.waitForTimeout(1800);
  const rotated = await observation();
  assert.notEqual(rotated.points[0].bearing, zoom.points[0].bearing);
  assert.notDeepEqual(rotated.points[0].projection.screen, zoom.points[0].projection.screen);
  assert.equal(rotated.points[0].axisAngle, before.points[0].axisAngle);
  assert.deepEqual(rotated.points[0].axisCoordinates, before.points[0].axisCoordinates);
  assert.deepEqual(coordinates(await state()), coordinates(baseline));
  assert.equal((await state()).stateUnchanged, true);
  report.checks.push('Orbit changes camera-relative angles and projection; same-axis angle and data XYZ/r unchanged');
  await capture('observer-desktop');

  // Stop residual orbit inertia before isolating the effect of an axis switch.
  await page.locator('#damping-toggle').uncheck();
  await page.waitForTimeout(150);
  const axisBaseline = await observation();
  await page.locator('#reference-axis').selectOption('world-y');
  const newAxis = await observation();
  assert.notEqual(newAxis.points[0].axisAngle, rotated.points[0].axisAngle);
  assert.ok(Math.abs(newAxis.points[0].bearing - axisBaseline.points[0].bearing) < 1e-8);
  assert.equal(newAxis.referenceAxisId, 'world-y');
  for (const point of newAxis.points.filter((p) => p.axisCoordinates)) {
    assert.ok(Math.abs(Math.hypot(...point.axisCoordinates) - baseline.points.find((p) => p.id === point.id).r) < 1e-10);
  }
  report.checks.push('Axis switch changes reference coordinates and angle, preserves local norm and observer camera');

  await page.locator('#reference-axis').selectOption('group');
  for (const id of ['genetic-diversity', 'untested-chemicals']) {
    await page.locator(`[data-control="${id}"]`).click();
    await page.waitForTimeout(160);
    const obs = await observation(), point = obs.points.find((p) => p.id === id);
    assert.equal(point.projection, null); assert.equal(point.axisCoordinates, null);
    assert.equal(await page.locator('#focus').isDisabled(), true);
    await page.locator('#align-group').click();
    const s = await state();
    const direction = s.groupDirections.find((g) => g.id === s.selectedGroup).direction;
    const len = Math.hypot(...s.camera.position);
    assert.ok(s.camera.position.every((n, i) => Math.abs(n / len - direction[i]) < 1e-8));
    assert.deepEqual(s.camera.target, [0, 0, 0]);
    assert.deepEqual(coordinates(s), coordinates(baseline));
  }
  await page.waitForTimeout(200);
  assert.ok((await page.locator('#observer-content').innerText()).includes('NO POSITION'));
  await capture('observer-not-quantified');
  report.checks.push('Both NQ controls retain semantic/direction selection, no XYZ or numeric pivot; group alignment only moves camera');

  await page.locator('[data-control="co2"]').click();
  await page.locator('#focus').click();
  assert.deepEqual((await observation()).camera.target, baseline.points.find((p) => p.id === 'co2').position);
  await page.locator('#fit').click();
  await page.locator('#observer-tab').focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#state-tab').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#observer-tab').getAttribute('aria-selected'), 'true');

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.waitForTimeout(300);
    await page.locator('#fit').click(); await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    await capture(`observer-${viewport.width}`);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      text: [...document.querySelectorAll('button,select,dd,h1,h3')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent),
    }));
    assert.equal(layout.overflow, false); assert.deepEqual(layout.text, []);
  }
  const scrollBefore = await page.evaluate(() => scrollY);
  const mb = await page.locator('canvas').boundingBox();
  await page.mouse.move(mb.x + mb.width * .6, mb.y + mb.height * .65);
  await page.mouse.wheel(0, 100); await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => scrollY), scrollBefore);
  await page.locator('#reference-axis').scrollIntoViewIfNeeded();
  const distanceBefore = (await observation()).camera.observationDistance;
  const scroll = await page.evaluate(() => scrollY);
  const panel = await page.locator('#reference-axis').boundingBox();
  await page.mouse.move(panel.x + 5, panel.y + panel.height + 5);
  await page.mouse.wheel(0, 200); await page.waitForTimeout(400);
  assert.ok(await page.evaluate((previous) => scrollY > previous, scroll));
  assert.ok(Math.abs((await observation()).camera.observationDistance - distanceBefore) < 1e-8);
  report.checks.push('Desktop/mobile nonblank canvas, no text overflow, keyboard tabs, canvas-only wheel capture, normal outside page scroll');
  report.final = await state(); report.observation = await observation();
  assert.equal(report.final.failed, 0); assert.equal(report.final.stateUnchanged, true);
  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack; process.exitCode = 1;
  await page.screenshot({ path: 'validation/observer-failure.png', fullPage: true });
} finally {
  await fs.writeFile('validation/observer-browser-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure, errors: report.errors }, null, 2));
  await browser.close();
}
