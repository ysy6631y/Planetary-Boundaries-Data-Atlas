// Relative face width, not a calibrated distance in metres.
export const PRESENCE_CONFIG = { enter: .16, exit: .12, enterMs: 500, exitMs: 1200, lostMs: 1800 };

export function createPresenceGate(onChange, config = PRESENCE_CONFIG) {
  let near = false, candidateSince = null;
  return {
    update(ratio, now) {
      const candidate = near ? ratio >= config.exit : ratio >= config.enter;
      if (candidate === near) candidateSince = null;
      else {
        candidateSince ??= now;
        const delay = candidate ? config.enterMs : ratio === 0 ? config.lostMs : config.exitMs;
        if (now - candidateSince >= delay) { near = candidate; candidateSince = null; onChange(near); }
      }
      return near;
    },
    reset() { near = false; candidateSince = null; onChange(false); },
  };
}

export function createPresenceDetector({ button, status, sound }) {
  let worker, stream, timer, startupTimer, video, busy = false, active = false, generation = 0, lastResult = 0;
  let disposed = false;
  let lastVideoTime = -1;
  const gate = createPresenceGate(near => sound.setPresence(near));
  sound.setPresence(false, true);

  function stop(message = '카메라 꺼짐 · 소리 대기') {
    generation++; active = false; busy = false; lastVideoTime = -1;
    clearInterval(timer); clearTimeout(startupTimer); worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    if (video) { video.pause(); video.srcObject = null; video.remove(); video = null; }
    gate.reset(); sound.setPresence(false, true);
    button.disabled = false; button.textContent = '카메라 시작'; button.setAttribute('aria-pressed', 'false');
    status.textContent = message;
  }

  async function start() {
    const token = ++generation;
    button.disabled = true; button.textContent = '카메라 연결 중'; status.textContent = '접근 감지를 준비하고 있습니다';
    sound.unlock();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS 또는 localhost에서 카메라를 사용할 수 있습니다');
      const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
      if (token !== generation) { camera.getTracks().forEach(track => track.stop()); return; }
      stream = camera;
      video = document.createElement('video'); video.muted = true; video.playsInline = true;
      video.className = 'presence-video'; video.setAttribute('aria-hidden', 'true');
      document.body.append(video); video.srcObject = stream; await video.play();
      if (token !== generation) return;
      const base = new URL(import.meta.env.BASE_URL, location.href);
      worker = new Worker(new URL('mediapipe/presence-worker.js', base));
      startupTimer = setTimeout(() => { if (token === generation) stop('감지 준비 시간이 초과됐습니다 · 다시 시작해 주세요'); }, 20000);
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (token === generation) stop('카메라 연결이 끊겼습니다 · 다시 시작해 주세요'); });
      worker.onerror = () => { if (token === generation) stop('감지를 시작할 수 없습니다 · 다시 시도해 주세요'); };
      worker.onmessage = ({ data }) => {
        if (token !== generation) return;
        if (data.type === 'error') { console.warn('[presence]', data.message); stop('감지 오류 · 다시 시도해 주세요'); return; }
        if (data.type === 'ready') {
          clearTimeout(startupTimer);
          active = true; lastResult = performance.now();
          button.disabled = false; button.textContent = '카메라 중지'; button.setAttribute('aria-pressed', 'true');
          status.textContent = '접근 감지 중 · 가까이 오면 소리가 켜집니다';
          timer = setInterval(capture, 100);
        }
        if (data.type === 'result') {
          busy = false; lastResult = performance.now();
          const near = document.hidden ? false : gate.update(data.ratio, lastResult);
          status.textContent = document.hidden ? '화면 비활성 · 소리 대기' : near ? '가까움 · 소리 재생' : data.ratio > 0 ? '멀리 있음 · 가까이 와 주세요' : '사람을 기다리는 중 · 소리 대기';
        }
      };
      worker.postMessage({ type: 'init', wasm: new URL('mediapipe/wasm', base).href, model: new URL('mediapipe/models/face-detector.tflite', base).href });
    } catch (error) {
      if (token === generation) stop(error.name === 'NotAllowedError' ? '카메라 권한을 허용한 뒤 다시 시작해 주세요' : error.name === 'NotFoundError' ? '연결된 카메라가 없습니다' : error.message);
    }
  }

  async function capture() {
    if (!active || document.hidden) return;
    if (performance.now() - lastResult > 2500) {
      gate.reset(); sound.setPresence(false, true);
      status.textContent = '영상 확인 중 · 소리 대기';
    }
    if (busy || video?.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    busy = true;
    const token = generation;
    try {
      const frame = await createImageBitmap(video);
      if (token !== generation || document.hidden) { frame.close(); busy = false; return; }
      worker.postMessage({ type: 'frame', frame, time: performance.now() }, [frame]);
    } catch { if (token === generation) stop('영상 처리 오류 · 다시 시작해 주세요'); }
  }
  const toggle = () => { if (active) stop(); else void start(); };
  const visibility = () => { gate.reset(); sound.setPresence(false, true); if (active) status.textContent = document.hidden ? '화면 비활성 · 소리 대기' : '접근 감지 중 · 소리 대기'; };
  const pagehide = () => stop();
  button.addEventListener('click', toggle);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  void start();
  return { stop, dispose() {
    if (disposed) return; disposed = true; stop();
    button.removeEventListener('click', toggle);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pagehide);
  } };
}
