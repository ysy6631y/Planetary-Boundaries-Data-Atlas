import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('validation', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const report = { checks: [], screenshots: [], errors };
const snapshot = () => page.evaluate(() => window.__PB_DEBUG__.snapshot());
const stableData = (s) => s.points.map(({ id, r, position }) => ({ id, r, position }));
function pixels(buffer) {
  const png = PNG.sync.read(buffer); let nonblack = 0;
  for (let i = 0; i < png.data.length; i += 4) if (Math.max(png.data[i], png.data[i + 1], png.data[i + 2]) > 20) nonblack++;
  return { png, nonblack, fraction: nonblack / (png.width * png.height) };
}
function difference(a, b) {
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 20) changed++;
  return changed;
}
async function capture(name) {
  await page.screenshot({ path: `validation/${name}.png`, fullPage: true });
  const raw = await page.locator('canvas').screenshot({ path: `validation/${name}-canvas.png` });
  const p = pixels(raw);
  assert.ok(p.nonblack > 250, `${name}: blank canvas`);
  report.screenshots.push({ name, width: p.png.width, height: p.png.height, nonblackPixels: p.nonblack });
  return p.png;
}
async function layoutCheck() {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('.group-label:not([hidden])')].map((e) => ({ id: e.textContent, rect: e.getBoundingClientRect() }));
    const overlaps = [];
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i].rect, b = labels[j].rect;
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push([labels[i].id, labels[j].id]);
    }
    return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth, overlaps,
      overflowingText: [...document.querySelectorAll('button,dd,h1,h3,.big-value')].filter((e) => e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent) };
  });
}

try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__PB_DEBUG__?.snapshot().passed === 11);
  await page.waitForTimeout(350);
  const initial = await snapshot();
  assert.equal(initial.groups, 9); assert.equal(initial.quantitativePoints, 11);
  assert.equal(initial.notQuantified, 2); assert.equal(initial.meshCount, 11); assert.equal(initial.measurementLineCount, 11);
  assert.equal(await page.locator('.group').count(), 9);
  assert.equal(await page.locator('.control').count(), 13);
  assert.ok((await page.evaluate(() => window.__PB_DEBUG__.referenceCheck())).every((r) => r.pass));
  report.checks.push('9 groups, 13 controls, 11 meshes/segments; all reference vertices have r=1 or r=2');
  const firstImage = await capture('desktop');
  report.desktopLayout = await layoutCheck();
  assert.equal(report.desktopLayout.horizontalOverflow, false);
  assert.deepEqual(report.desktopLayout.overlaps, []);

  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6);
  await page.mouse.wheel(0, 500); await page.waitForTimeout(600);
  const zoomed = await snapshot();
  assert.ok(zoomed.observationDistance < initial.observationDistance);
  assert.equal(zoomed.camera.fov, initial.camera.fov);
  assert.deepEqual(zoomed.camera.target, initial.camera.target);
  assert.deepEqual(stableData(zoomed), stableData(initial));
  const zoomImage = await capture('desktop-zoom');
  report.zoomChangedPixels = difference(firstImage, zoomImage);
  assert.ok(report.zoomChangedPixels > 100);
  report.checks.push('Wheel dollies camera; fixed FOV and target; data XYZ unchanged');

  await page.mouse.down(); await page.mouse.move(box.x + box.width * .78, box.y + box.height * .69, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(1200);
  const rotated = await snapshot();
  assert.notDeepEqual(rotated.camera.position, zoomed.camera.position);
  assert.deepEqual(rotated.camera.target, zoomed.camera.target);
  assert.deepEqual(stableData(rotated), stableData(initial));
  const orbitImage = await capture('desktop-orbit');
  report.orbitChangedPixels = difference(zoomImage, orbitImage);
  assert.ok(report.orbitChangedPixels > 100);
  report.checks.push('Drag changes camera and canvas pixels; data radius unchanged');

  for (const point of initial.points) {
    await page.locator(`[data-control="${point.id}"]`).click();
    assert.equal((await snapshot()).selectedId, point.id);
    const fieldNames = await page.locator('#inspect-content dt').allTextContents();
    for (const field of ['BOUNDARY', 'INDICATOR', 'RAW VALUE', 'UNIT', 'BASELINE', 'PLANETARY BOUNDARY', 'HIGH RISK', 'RISK DIRECTION', 'UNIFIED DISTANCE', 'R', 'THETA (rad)', 'PHI (rad)', 'X', 'Y', 'Z']) {
      assert.ok(fieldNames.includes(field), `Missing inspector field ${field}`);
    }
    if (point.r === null) {
      assert.ok((await page.locator('#inspect-content').innerText()).includes('NOT QUANTIFIED'));
      assert.equal(await page.locator('#focus').isDisabled(), true);
      assert.equal((await snapshot()).points.find((p) => p.id === point.id).position, null);
    } else assert.ok((await page.locator('#point-check').innerText()).includes('PASS'));
  }
  await capture('desktop-not-quantified');
  report.checks.push('All 13 controls selectable; complete inspector; NQ states have no XYZ and no focus point');

  await page.locator('[data-control="nitrogen"]').click();
  await page.locator('#focus').click();
  const focused = await snapshot();
  assert.deepEqual(focused.camera.target, initial.points.find((p) => p.id === 'nitrogen').position);
  assert.deepEqual(stableData(focused), stableData(initial));
  await page.locator('#fit').click();
  await page.locator('#labels-toggle').uncheck();
  const projected = await page.evaluate(() => window.__PB_DEBUG__.project('radiative-forcing'));
  await page.mouse.click(projected.x, projected.y);
  assert.equal((await snapshot()).selectedId, 'radiative-forcing');
  await page.locator('#labels-toggle').check();
  report.checks.push('Quantitative focus moves only target/camera; canvas raycast selects the actual point');

  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .55);
  await page.mouse.wheel(0, 100000); await page.waitForTimeout(200);
  assert.ok(Math.abs((await snapshot()).observationDistance - initial.camera.minDistance) < 1e-8);
  await page.mouse.wheel(0, -100000); await page.waitForTimeout(200);
  assert.ok(Math.abs((await snapshot()).observationDistance - initial.camera.maxDistance) < 1e-8);
  report.checks.push('Wheel minDistance=0.25 and maxDistance=90 clamps verified');
  await page.locator('#reference-view').click();
  await capture('desktop-references');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  await download.saveAs('validation/browser-export.json');
  report.checks.push('Validation JSON download works');

  await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(250); await page.locator('#fit').click();
  await capture('wide'); report.wideLayout = await layoutCheck();
  assert.deepEqual(report.wideLayout.overlaps, []);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250); await page.locator('#fit').click();
  await page.locator('[data-control="untested-chemicals"]').click();
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  await capture('mobile'); report.mobileLayout = await layoutCheck();
  assert.equal(report.mobileLayout.horizontalOverflow, false);
  assert.deepEqual(report.mobileLayout.overlaps, []);
  assert.deepEqual(report.mobileLayout.overflowingText, []);
  const mobileBefore = await snapshot();
  const mb = await page.locator('canvas').boundingBox();
  await page.mouse.move(mb.x + mb.width * .5, mb.y + mb.height * .52);
  await page.mouse.down(); await page.mouse.move(mb.x + mb.width * .75, mb.y + mb.height * .62, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(700);
  assert.notDeepEqual((await snapshot()).camera.position, mobileBefore.camera.position);
  assert.deepEqual(stableData(await snapshot()), stableData(initial));
  report.checks.push('1920px and 390px nonblank responsive canvas; no label/text overflow; mobile orbit works');
  report.final = await snapshot();
  assert.equal(report.final.failed, 0); assert.deepEqual(errors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack; process.exitCode = 1;
  await page.screenshot({ path: 'validation/browser-failure.png', fullPage: true });
} finally {
  await writeFile('validation/browser-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure, errors }, null, 2));
  await browser.close();
}
