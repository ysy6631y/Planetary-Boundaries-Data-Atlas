// Brief header readout while processing. Only the current operation may publish state.
export function createDataProcess() {
  const status = document.createElement('div');
  status.id = 'data-process';
  status.innerHTML = '<span class="process-scope"></span><output role="status" aria-live="polite" aria-atomic="true"></output>';
  document.querySelector('.scene-top').append(status);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let owner = 0;
  const reset = () => { ++owner; status.hidden = true; };
  function begin(source, scope = 'DATA') {
    reset(); const token = owner;
    status.hidden = false;
    status.querySelector('.process-scope').textContent = `${scope} /`;
    const update = (stage, rows, error) => {
      if (token !== owner) return;
      const output = status.querySelector('output');
      const text = `${stage}${scope === 'DATA' && stage === 'READY' && rows != null ? ` · ${rows.toLocaleString('en')} ROWS` : ''}`;
      const changed = output.textContent !== text;
      output.textContent = text;
      status.dataset.stage = stage;
      if (stage === 'READY') {
        output.getAnimations().forEach(animation => animation.cancel());
        status.hidden = true;
      }
      status.title = error ? `${source}: ${error}` : source;
      status.setAttribute('aria-label', error ? `${scope} / ERROR: ${error}` : `${source}: ${text}`);
      if (changed && stage !== 'READY' && !reducedMotion.matches) {
        output.getAnimations().forEach(animation => animation.cancel());
        output.animate([{opacity:.5},{opacity:1}], {duration:150});
      }
    };
    update('READING');
    return update;
  }
  return { begin, reset };
}
