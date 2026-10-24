import manifest from './signal-samples.generated.json';
import { SOUND_CONFIG } from './sound-config.js';

export function createSoundSystem(ambient, overrides = {}) {
  const settings = structuredClone(SOUND_CONFIG);
  for (const [key, value] of Object.entries(overrides)) settings[key] = typeof value === 'object' && !Array.isArray(value) ? { ...settings[key], ...value } : value;
  const controller = new AbortController();
  const samples = new Map(), buffers = new Map(), voices = new Set();
  const history = [], errors = [], inputWindow = [];
  const previousSamples = new Map();
  let context, master, flowBus, detailBus, limiter, loading;
  let enabled = true, disposed = false, unlocked = false, suspended = document.hidden, wasRunning = false;
  let present = true, presenceGain = 1;
  let nextFlow = Infinity, nextDetail = Infinity, nextMicro = Infinity, quietUntil = 0;
  let nearCount = 0, lastGlitch = -Infinity;
  let lastOnset = -Infinity, lastFlowEnd = -Infinity;
  let activity = 0, windowActivity = 0, peakVoices = 0, lastDetailGain = -1;
  const range = ([min, max]) => min + Math.random() * (max - min);
  const seconds = () => performance.now() / 1000;
  const report = message => { if (!errors.includes(message)) { errors.push(message); console.warn('[audio] ' + message); } };
  ambient.volume = settings.volumes.ambient;

  function resetSchedule(now) {
    nextFlow = now + range(settings.flow.first);
    nextDetail = settings.primaryFamily === 'detail' ? Infinity : now + range(settings.detail.first || settings.detail.interval);
    nextMicro = Infinity;
    quietUntil = 0;
    nearCount = 0;
  }

  function clearActivity() { inputWindow.length = 0; activity = 0; windowActivity = 0; }

  function updateActivity(now, dt, inputSpeed) {
    const elapsed = Math.min(.1, Math.max(0, dt));
    const speed = Number.isFinite(inputSpeed) ? Math.max(0, inputSpeed - settings.activity.deadzone) : 0;
    const value = Math.min(1, speed / settings.activity.fullScale);
    if (value > 0) inputWindow.push({ time: now, value, duration: elapsed });
    const cutoff = now - settings.activity.window;
    while (inputWindow.length && inputWindow[0].time <= cutoff) inputWindow.shift();
    windowActivity = Math.min(1, inputWindow.reduce((sum, entry) => sum + entry.value * Math.min(entry.duration, entry.time - cutoff), 0) / settings.activity.window);
    const smoothing = windowActivity > activity ? settings.activity.attack : settings.activity.release;
    activity += (windowActivity - activity) * (1 - Math.exp(-elapsed / smoothing));
  }

  function stopVoices() {
    for (const voice of [...voices]) {
      try { voice.source.stop(); } catch { /* Source already ended. */ }
      voice.source.disconnect(); voice.gain.disconnect(); voice.filter.disconnect();
      voices.delete(voice);
    }
  }

  function makeBus(destination, highpass = settings.eq.highpass) {
    const gain = context.createGain(), hp = context.createBiquadFilter(), shelf = context.createBiquadFilter(), lp = context.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = highpass; hp.Q.value = .5;
    shelf.type = 'highshelf'; shelf.frequency.value = settings.eq.shelfFrequency; shelf.gain.value = settings.eq.shelfGain;
    lp.type = 'lowpass'; lp.frequency.value = settings.eq.lowpass; lp.Q.value = .5;
    gain.connect(hp).connect(shelf).connect(lp).connect(destination);
    return gain;
  }

  function loadSamples() {
    if (loading) return loading;
    loading = Promise.all(manifest.samples.map(async sample => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${sample.file.replace(/^\//, '')}`, { signal: controller.signal });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!disposed) { samples.set(sample.id, sample); buffers.set(sample.id, buffer); }
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') report(sample.id + ': ' + error.message);
      }
    }));
    return loading;
  }

  function ensureContext() {
    if (context || disposed) return;
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) { report('Web Audio unavailable; ambient remains available.'); return; }
    try { context = new Constructor({ latencyHint: 'interactive' }); }
    catch (error) { report('Audio context: ' + error.message); return; }
    master = context.createGain(); master.gain.value = enabled ? presenceGain : 0;
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 6; limiter.ratio.value = 10;
    limiter.attack.value = .006; limiter.release.value = .16;
    flowBus = makeBus(limiter); detailBus = makeBus(limiter, settings.eq.detailHighpass);
    flowBus.gain.value = settings.volumes.flow;
    detailBus.gain.value = settings.volumes.detail * (1 - settings.activity.detailDepth);
    limiter.connect(master).connect(context.destination);
    void loadSamples();
  }

  function playAmbient() {
    if (!enabled || disposed || !present || document.hidden) return;
    ambient.play()?.catch(error => {
      if (!['NotAllowedError', 'AbortError'].includes(error.name)) report('Ambient: ' + error.message);
    });
  }

  function unlock() {
    if (!enabled || disposed) return;
    ensureContext(); unlocked = true;
    if (context && !document.hidden) context.resume().catch(error => report(error.message));
    playAmbient();
  }

  function choose(family) {
    let options = [...samples.values()].filter(sample => sample.family === family);
    const different = options.filter(sample => sample.id !== previousSamples.get(family));
    if (different.length) options = different;
    return options[Math.floor(Math.random() * options.length)];
  }

  function cutoffFor(family) {
    const bounds = settings.eq[family + 'Cutoff'];
    return bounds[0] + (bounds[1] - bounds[0]) * activity;
  }

  function playSample(sample, gainScale = 1, now = seconds(), trigger = 'autonomous') {
    if (!sample || !enabled || disposed || suspended || context?.state !== 'running') return false;
    if (!settings.enabledFamilies.includes(sample.family)) return false;
    if (voices.size >= settings.maxVoices) return false;
    const previous = history.at(-1);
    if (previous?.family === sample.family && now - lastOnset < settings.minOnsetGap) return false;
    if ([...voices].some(voice => voice.family === sample.family)) return false;
    const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
    source.buffer = buffers.get(sample.id);
    filter.type = 'lowpass'; filter.Q.value = .5;
    const targetCutoff = cutoffFor(sample.family);
    filter.frequency.value = targetCutoff;
    const start = context.currentTime;
    const duration = Math.min(source.buffer.duration, range(settings.fragments[sample.family] || [source.buffer.duration, source.buffer.duration]));
    const offset = range([0, Math.max(0, source.buffer.duration - duration)]);
    const level = gainScale * range(sample.family === 'detail' ? [.88, 1.06] : sample.family === 'micro' ? [.9, 1.05] : [.58, 1.02]);
    const attack = Math.min(sample.family === 'micro' ? .004 : .015, duration * .15);
    const release = Math.min(sample.family === 'micro' ? .012 : .045, duration * .25);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + attack);
    gain.gain.setValueAtTime(level, start + duration - release);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(gain).connect(filter).connect(sample.family === 'detail' ? detailBus : flowBus);
    const voice = { source, gain, filter, family: sample.family, targetCutoff,
      tailAt: start + duration - range(settings.micro.tailLead), endAt: start + duration, tailChecked: false };
    voices.add(voice); peakVoices = Math.max(peakVoices, voices.size);
    source.onended = () => { source.disconnect(); gain.disconnect(); filter.disconnect(); voices.delete(voice); };
    source.start(start, offset, duration); lastOnset = now;
    if (sample.family === 'micro') lastGlitch = now;
    if (sample.family === settings.primaryFamily) lastFlowEnd = now + duration;
    previousSamples.set(sample.family, sample.id);
    history.push({ family: sample.family, id: sample.id, trigger, time: now, duration, offset, level, activityAtStart: activity, cutoffAtStart: targetCutoff });
    if (history.length > 100) history.shift();
    return true;
  }

  function updateModulation() {
    // Activity only changes already-scheduled audio. It never starts a source.
    const detailLevel = settings.volumes.detail * (1 - settings.activity.detailDepth + settings.activity.detailDepth * activity);
    if (Math.abs(detailLevel - lastDetailGain) > .0005) {
      detailBus.gain.setTargetAtTime(detailLevel, context.currentTime, settings.activity.filterSmoothing);
      lastDetailGain = detailLevel;
    }
    for (const voice of voices) {
      const target = cutoffFor(voice.family);
      if (Math.abs(target - voice.targetCutoff) > 2) {
        voice.filter.frequency.setTargetAtTime(target, context.currentTime, settings.activity.filterSmoothing);
        voice.targetCutoff = target;
      }
    }
  }

  function update(nowMs, dt, inputSpeed = 0) {
    const now = nowMs / 1000;
    if (disposed || !enabled || suspended) return;
    const target = present ? 1 : 0;
    presenceGain += Math.sign(target - presenceGain) * Math.min(Math.abs(target - presenceGain), Math.max(0, dt) / (present ? .8 : 1.5));
    ambient.volume = settings.volumes.ambient * presenceGain;
    if (master) master.gain.setTargetAtTime(presenceGain, context.currentTime, .03);
    if (!present) {
      if (presenceGain === 0) { stopVoices(); ambient.pause(); }
      return;
    }
    updateActivity(now, dt, inputSpeed);
    if (context?.state !== 'running' || !samples.size) return;
    if (!wasRunning) { resetSchedule(now); wasRunning = true; }
    updateModulation();
    // Movement admits a quiet glitch only inside an existing reveal's tail.
    for (const voice of [...voices]) {
      if (voice.family !== 'detail' || voice.tailChecked || context.currentTime < voice.tailAt) continue;
      voice.tailChecked = true;
      if (context.currentTime >= voice.endAt - .015 || now - lastGlitch < settings.micro.cooldown) continue;
      if (windowActivity > settings.activity.tailThreshold && activity > settings.activity.tailThreshold &&
          Math.random() < settings.activity.tailChance * Math.min(1, .3 + activity)) {
        playSample(choose('micro'), settings.micro.gain, now, 'activity-tail');
      }
    }
    // Autonomous flow mixes long silences with occasional near neighbours.
    if (now >= nextFlow) {
      const sample = choose(settings.primaryFamily);
      const played = playSample(sample, 1, now);
      if (!played) { nextFlow = now + range([.3, 1.1]); }
      else if (Math.random() < settings.flow.quietChance) {
        quietUntil = now + (sample?.duration || 0) + range(settings.flow.quietInterval);
        nextFlow = quietUntil;
        nearCount = 0;
      } else {
        quietUntil = 0;
        const near = Math.random() < settings.flow.nearChance * Math.pow(.8, nearCount);
        nextFlow = now + range(near ? settings.flow.nearInterval : settings.flow.interval);
        nearCount = near ? nearCount + 1 : 0;
      }
    }
    if (now >= nextDetail) {
      if (now < quietUntil) nextDetail = quietUntil + range([1, 3]);
      else if (now - lastOnset > settings.detail.clearance && playSample(choose('detail'), 1, now)) nextDetail = now + range(settings.detail.interval);
      else nextDetail = now + range([.2, .9]);
    }
  }

  function setEnabled(value) {
    if (disposed) return;
    enabled = Boolean(value); ambient.muted = !enabled;
    if (master) master.gain.value = enabled ? presenceGain : 0;
    if (!enabled) { stopVoices(); clearActivity(); ambient.pause(); context?.suspend().catch(() => {}); wasRunning = false; }
    else {
      resetSchedule(seconds()); playAmbient();
      if (unlocked && context && !document.hidden) context.resume().catch(error => report(error.message));
    }
  }

  function setVolumes(volumes) {
    for (const key of ['ambient', 'flow', 'detail']) if (Number.isFinite(volumes[key])) settings.volumes[key] = Math.min(1, Math.max(0, volumes[key]));
    ambient.volume = settings.volumes.ambient * presenceGain; lastDetailGain = -1;
    if (context && !disposed) flowBus.gain.setTargetAtTime(settings.volumes.flow, context.currentTime, .1);
  }

  function setPresence(value, immediate = false) {
    const changed = present !== Boolean(value);
    present = Boolean(value);
    if (immediate) {
      presenceGain = present ? 1 : 0;
      ambient.volume = settings.volumes.ambient * presenceGain;
      if (master) master.gain.value = enabled ? presenceGain : 0;
      if (!present) { stopVoices(); ambient.pause(); }
    }
    if (changed) { clearActivity(); wasRunning = false; }
    if (present && unlocked) playAmbient();
  }

  function visibilityChanged() {
    suspended = document.hidden; stopVoices(); clearActivity(); wasRunning = false;
    if (suspended) ambient.pause();
    else if (enabled && unlocked) playAmbient();
    if (suspended) context?.suspend().catch(() => {});
    else if (enabled && unlocked) context?.resume().catch(error => report(error.message));
  }
  function pageHidden(event) {
    if (!event.persisted) dispose();
    else { stopVoices(); clearActivity(); context?.suspend().catch(() => {}); ambient.pause(); wasRunning = false; }
  }
  function pageShown() { suspended = document.hidden; if (enabled) { playAmbient(); if (unlocked) context?.resume().catch(() => {}); } }
  function ambientError() { report('Ambient load failed: ' + (ambient.currentSrc || ambient.src)); }
  function dispose() {
    if (disposed) return;
    disposed = true; controller.abort(); stopVoices(); clearActivity(); ambient.pause();
    window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('pagehide', pageHidden); window.removeEventListener('pageshow', pageShown);
    document.removeEventListener('visibilitychange', visibilityChanged); ambient.removeEventListener('error', ambientError);
    if (context) { master.disconnect(); flowBus.disconnect(); detailBus.disconnect(); limiter.disconnect(); context.close().catch(() => {}); }
    buffers.clear(); samples.clear();
  }
  window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
  window.addEventListener('pagehide', pageHidden); window.addEventListener('pageshow', pageShown);
  document.addEventListener('visibilitychange', visibilityChanged); ambient.addEventListener('error', ambientError);
  playAmbient();
  return {
    update, setEnabled, setVolumes, setPresence, unlock, dispose,
    ready: () => loading || Promise.resolve(),
    audition: id => playSample(samples.get(id)),
    snapshot: () => ({
      enabled, disposed, present, presenceGain, contextState: context?.state || 'not-created', loaded: samples.size, expected: manifest.samples.length,
      voices: voices.size, peakVoices, activity, windowActivity, inputFrames: inputWindow.length, nextFlow, nextDetail, nextMicro, quietUntil,
      activeVoices: [...voices].map(voice => ({ family: voice.family, cutoff: voice.filter.frequency.value, targetCutoff: voice.targetCutoff })),
      volumes: { ...settings.volumes }, history: [...history], errors: [...errors],
    }),
  };
}
