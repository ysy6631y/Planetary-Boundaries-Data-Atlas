import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.env.ATLAS_TEST_URL || 'http://127.0.0.1:5181';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.route('**/sound-harness',route=>route.fulfill({contentType:'text/html',body:'<button>start</button><audio src="/sci-fi-drone.wav" loop></audio>'}));
  await page.goto(origin+'/sound-harness');
  await page.evaluate(async()=>{
    const {createSoundSystem}=await import('/src/sound-system.js');
    window.sound=createSoundSystem(document.querySelector('audio'),{
      flow:{first:[.1,.1],interval:[.55,.8],nearChance:0,quietChance:0},
      activity:{tailChance:1}, micro:{cooldown:.3},
    });
    window.run=async(ms,speed)=>{
      let frame,previous=performance.now();
      const tick=now=>{sound.update(now,(now-previous)/1000,speed);previous=now;frame=requestAnimationFrame(tick);};
      frame=requestAnimationFrame(tick);
      await new Promise(resolve=>setTimeout(resolve,ms));cancelAnimationFrame(frame);
      return sound.snapshot();
    };
  });
  await page.locator('button').click();
  await page.evaluate(()=>sound.ready());
  assert.equal((await page.evaluate(()=>sound.snapshot())).loaded,14);
  assert.equal(await page.evaluate(()=>sound.audition('flow-01')),false);
  const idle=await page.evaluate(()=>run(1800,0));
  assert(idle.history.length>0);
  assert(idle.history.every(e=>e.family==='detail'),'Idle must have no glitch');
  const active=await page.evaluate(()=>run(5000,1));
  const glitches=active.history.filter(e=>e.family==='micro');
  assert(glitches.length>0,'Accumulated movement should admit tail glitches');
  for(const glitch of glitches){
    assert.equal(glitch.trigger,'activity-tail');
    assert(glitch.duration>=.07 && glitch.duration<=.12);
    assert(glitch.level>=.32 && glitch.level<=.38);
    const reveal=active.history.findLast(e=>e.family==='detail' && e.time<=glitch.time);
    const remaining=reveal.time+reveal.duration-glitch.time;
    assert(remaining>0 && remaining<=.115,'Glitch must begin inside reveal tail');
  }
  assert(active.peakVoices<=2);
  assert.equal(await page.locator('audio').evaluate(el=>el.volume),.16);
  await page.evaluate(()=>sound.setEnabled(false));
  await page.waitForTimeout(60);
  const off=await page.evaluate(()=>sound.snapshot());
  assert.equal(off.voices,0);assert.equal(off.contextState,'suspended');
  assert(await page.locator('audio').evaluate(el=>el.paused && el.muted));
  await page.evaluate(()=>sound.setEnabled(true));
  await page.waitForTimeout(60);
  assert.equal((await page.evaluate(()=>sound.snapshot())).contextState,'running');
  await page.evaluate(()=>sound.dispose());await page.waitForTimeout(60);
  assert.equal((await page.evaluate(()=>sound.snapshot())).contextState,'closed');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({loaded:14,idleGlitches:0,movementTailGlitches:glitches.length,tailTimingVerified:true,maxSignalVoices:active.peakVoices,muteResumeDispose:true,errors},null,2));
}finally{await browser.close();}
