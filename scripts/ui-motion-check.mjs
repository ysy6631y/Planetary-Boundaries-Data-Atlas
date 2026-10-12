import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('src/atlas-manifest.generated.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { errors: [], checks: [] };
const url = process.env.ATLAS_URL || 'http://127.0.0.1:5174';
async function openGroup(page, id) {
  await page.locator('#index-trigger').click();
  await page.locator(`[data-group="${id}"]`).click();
  await page.waitForFunction(() => !!window.__PB_DEBUG__.atlas().dataset);
}
const motion = page => page.evaluate(() => window.__PB_DEBUG__.motion());
const snapshot = page => page.evaluate(() => window.__PB_DEBUG__.snapshot());
try {
  for (const reduced of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready && !window.__PB_DEBUG__.motion().focusing);
    const initial = await snapshot(page);
    await page.waitForTimeout(300);
    const idle = await snapshot(page);
    assert.equal((await motion(page)).autoRotate, !reduced);
    if (reduced) assert.deepEqual(idle.camera, initial.camera);
    else assert.notDeepEqual(idle.camera.position, initial.camera.position);
    assert.deepEqual(idle.points.map(p => p.position), initial.points.map(p => p.position));
    // Manual input never resumes automatically, even after pointer release.
    await page.mouse.move(900, 400); await page.mouse.down();
    await page.mouse.move(960, 450, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(350);
    assert.equal((await motion(page)).autoRotate, false);
    await page.locator('#fit').click();
    await page.waitForFunction(() => !window.__PB_DEBUG__.motion().focusing);
    assert.equal((await motion(page)).manualObservation, false);
    await page.evaluate(() => {
      window.__motionSamples = [];
      const start = performance.now();
      const tick = () => {
        const state = window.__PB_DEBUG__.motion();
        if (!state.overview) window.__motionSamples.push(state.projection);
        if (performance.now() - start < 2500) requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    });
    await openGroup(page, 'climate-change');
    const started = await motion(page);
    if (reduced) assert.equal(started.projection, 1);
    await page.waitForFunction(() => !window.__PB_DEBUG__.motion().focusing && window.__PB_DEBUG__.motion().projection === 1);
    if (!reduced) assert.ok(await page.evaluate(() => window.__motionSamples.some(value => value < 1)));
    const settled = await snapshot(page);
    const available = manifest.boundaries['climate-change'].datasets;
    const next = available.find(id => id !== manifest.boundaries['climate-change'].default && manifest.datasets.find(d => d.id === id).kind === 'xy');
    await page.selectOption('#dataset-select', next);
    await page.waitForFunction(id => window.__PB_DEBUG__.atlas().dataset === id, next);
    await page.waitForFunction(() => window.__PB_DEBUG__.motion().projection === 1);
    assert.deepEqual((await snapshot(page)).camera, settled.camera);
    assert.equal((await motion(page)).points, await page.evaluate(() => window.__PB_DEBUG__.atlas().displayed));
    await page.waitForTimeout(100); // A rendered frame is required before pointer picking.
    const point = await page.evaluate(() => window.__PB_DEBUG__.climate().projected.find(p => p.visible && p.x > 400 && p.x < 1350 && p.y > 240 && p.y < 650));
    assert.ok(point);
    await page.mouse.click(point.x, point.y);
    assert.equal(await page.locator('#inspector').isVisible(), true);
    assert.ok((await page.locator('#reference-content').textContent()).includes(point.code));
    // Overlapping dataset requests and projection starts settle on the last input.
    const last = manifest.boundaries['climate-change'].default;
    await page.selectOption('#dataset-select', available[2]);
    await page.selectOption('#dataset-select', last);
    await page.waitForFunction(id => window.__PB_DEBUG__.atlas().dataset === id && window.__PB_DEBUG__.motion().projection === 1, last);
    const final = await snapshot(page);
    assert.deepEqual(final.points.map(p => p.position), initial.points.map(p => p.position));
    assert.equal(final.failed, 0); assert.equal(final.stateUnchanged, true);
    await page.screenshot({ path: `validation/ui-motion-${reduced ? 'reduced' : 'normal'}.png` });
    // Measure actual frame callback cadence; report hardware-dependent results.
    const timing = await page.evaluate(() => new Promise(resolve => {
      const frames = []; let previous; const start = performance.now();
      const tick = now => { if (previous !== undefined) frames.push(now - previous); previous = now;
        if (now - start < 1200) requestAnimationFrame(tick);
        else { frames.sort((a,b) => a-b); resolve({ frames: frames.length, medianMs: frames[Math.floor(frames.length/2)], p95Ms: frames[Math.floor(frames.length*.95)] }); }
      }; requestAnimationFrame(tick);
    }));
    report.checks.push({ reduced, timing, status: 'PASS', idleRotation: !reduced, manualPause: true, cameraPreserved: true, lastRequestWins: true, coordinatesUnchanged: true });
    await page.locator('#focus').click();
    if (!reduced) assert.equal((await motion(page)).focusing, true);
    await page.mouse.move(900, 400); await page.mouse.wheel(0, 100);
    await page.waitForTimeout(50);
    assert.equal((await motion(page)).focusing, false);
    await page.selectOption('#dataset-select', next);
    await page.locator('#fit').click();
    await page.waitForFunction(() => window.__PB_DEBUG__.motion().overview && !window.__PB_DEBUG__.motion().focusing);
    assert.equal(await page.evaluate(() => window.__PB_DEBUG__.atlas().dataset), null);
    assert.equal(await page.locator('#local-field').isVisible(), false);
    assert.equal(await page.locator('#inspector').isVisible(), false);
    report.checks.at(-1).focusInterruptAndReturn = true;
    await page.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'PASS';
  await writeFile('validation/ui-motion-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
