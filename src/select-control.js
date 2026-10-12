// Accessible presentation layer over the existing selects and change handlers.
// Keeping native option values preserves all data-loading/filtering contracts.
let opened = null;
export function enhanceSelect(select) {
  const wrapper = document.createElement('div');
  wrapper.className = 'select-control';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(select);
  select.classList.add('select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = `${select.id}-trigger`;
  trigger.className = 'select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-autocomplete', 'none');
  trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.id);
  const text = document.createElement('span');
  trigger.append(text);
  wrapper.append(trigger);
  const menu = document.createElement('div');
  menu.id = `${select.id}-listbox`;
  menu.className = 'select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', trigger.getAttribute('aria-label'));
  menu.hidden = true;
  document.body.append(menu);
  trigger.setAttribute('aria-controls', menu.id);
  let active = -1;
  let search = '', searchedAt = 0;
  const available = () => [...select.options].map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled && !option.parentElement.disabled);
  function position() {
    const rect = trigger.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upwards = below < 240 && above > below;
    const room = Math.max(48, Math.min(340, upwards ? above : below));
    const width = Math.min(innerWidth - 24, Math.max(rect.width, select.id === 'dataset-select' ? 480 : 220));
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${room}px`;
    menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
    menu.style.top = upwards ? 'auto' : `${rect.bottom + 5}px`;
    menu.style.bottom = upwards ? `${innerHeight - rect.top + 5}px` : 'auto';
  }
  function highlight(index) {
    active = index;
    for (const item of menu.querySelectorAll('[role="option"]')) item.classList.toggle('active', Number(item.dataset.index) === index);
    const item = menu.querySelector(`[data-index="${index}"]`);
    if (item) {
      trigger.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    }
  }
  function render() {
    text.textContent = select.selectedOptions[0]?.textContent || 'NO DATA AVAILABLE';
    trigger.title = text.textContent;
    trigger.disabled = select.disabled;
    menu.replaceChildren();
    let previousGroup = null;
    [...select.options].forEach((option, index) => {
      const group = option.parentElement.tagName === 'OPTGROUP' ? option.parentElement.label : null;
      if (group && group !== previousGroup) {
        const heading = document.createElement('div'); heading.className = 'select-group'; heading.textContent = group; menu.append(heading);
      }
      previousGroup = group;
      const item = document.createElement('div');
      item.className = 'select-option'; item.id = `${select.id}-option-${index}`;
      item.dataset.index = index;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.setAttribute('aria-disabled', String(option.disabled || !!option.parentElement.disabled));
      const name = document.createElement('span'); name.textContent = option.textContent; item.append(name);
      if (option.dataset.meta) { const meta = document.createElement('small'); meta.textContent = option.dataset.meta; item.append(meta); }
      item.addEventListener('pointermove', () => { if (item.getAttribute('aria-disabled') !== 'true') highlight(index); });
      item.addEventListener('pointerdown', (event) => event.preventDefault());
      item.addEventListener('click', () => commit(index));
      menu.append(item);
    });
    if (select.disabled) close();
    else if (!menu.hidden) { position(); highlight(available().some(({ index }) => index === active) ? active : select.selectedIndex); }
  }
  function close() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
    if (opened?.trigger === trigger) opened = null;
  }
  function open() {
    if (select.disabled) return;
    opened?.close();
    opened = { trigger, menu, close };
    render(); menu.hidden = false; position();
    trigger.setAttribute('aria-expanded', 'true');
    highlight(select.selectedIndex);
  }
  function commit(index) {
    if (!available().some((entry) => entry.index === index)) return;
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index; close(); render(); trigger.focus();
    if (changed) { select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  trigger.addEventListener('click', () => menu.hidden ? open() : close());
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (menu.hidden) { open(); return; }
      if (event.key === 'Enter' || event.key === ' ') { commit(active); return; }
      const choices = available();
      const current = choices.findIndex(({ index }) => index === active);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : Math.max(0, Math.min(choices.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
      if (choices[next]) highlight(choices[next].index);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (menu.hidden) open();
      search = performance.now() - searchedAt > 700 ? event.key : search + event.key; searchedAt = performance.now();
      const match = available().find(({ option }) => option.textContent.toLowerCase().startsWith(search.toLowerCase()));
      if (match) highlight(match.index);
    }
  });
  select.addEventListener('change', render);
  new MutationObserver(render).observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
  document.addEventListener('pointerdown', (event) => { if (!wrapper.contains(event.target) && !menu.contains(event.target)) close(); });
  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
  render();
  return { sync: render, close };
}
export function closeSelects() { opened?.close(); }
