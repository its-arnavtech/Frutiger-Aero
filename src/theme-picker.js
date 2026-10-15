import { resolveTheme, themeHref, themes } from './themes.js';

export const activeTheme = resolveTheme(location.search);
document.documentElement.dataset.theme = activeTheme.id;
document.title = activeTheme.title;
document.querySelector('link[rel=icon]').href = activeTheme.id === 'autumn' ? '/autumn.svg' : '/favicon.svg';
document.querySelector('meta[name="theme-color"]').content = activeTheme.color;
document.querySelector('meta[name="description"]').content = activeTheme.description;
document.querySelector('#world').setAttribute('aria-label', activeTheme.description);
document.querySelector('#experience').setAttribute('aria-label', `${activeTheme.name} world`);
document.querySelector('#loading span').textContent = activeTheme.loading;
document.querySelector('#theme-name').textContent = activeTheme.name;

const picker = document.querySelector('#world-picker');
const trigger = document.querySelector('#choose-world');
for (const theme of themes) {
  const choice = document.createElement(theme.available ? 'a' : 'div');
  choice.className = `theme-choice theme-${theme.id}${theme.available ? '' : ' unavailable'}`;
  if (theme.available) choice.href = themeHref(theme.id, location.search);
  else choice.setAttribute('aria-disabled', 'true');
  if (theme.id === activeTheme.id) choice.setAttribute('aria-current', 'page');
  const orb = document.createElement('span'); orb.className = 'theme-orb'; orb.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span'); label.className = 'theme-label';
  const name = document.createElement('strong'); name.textContent = theme.name;
  const detail = document.createElement('small'); detail.textContent = theme.available ? theme.subtitle : 'Coming later';
  label.append(name, detail); choice.append(orb, label);
  if (theme.available) { const arrow = document.createElement('span'); arrow.className = 'theme-arrow'; arrow.textContent = theme.id === activeTheme.id ? '✓' : '↗'; choice.append(arrow); }
  document.querySelector(theme.available ? '#available-worlds' : '#future-worlds').append(choice);
}
trigger.addEventListener('click', () => {
  picker.showModal(); trigger.setAttribute('aria-expanded', 'true');
  document.dispatchEvent(new Event('worldpickeropen'));
});
document.querySelector('#close-worlds').addEventListener('click', () => picker.close());
picker.addEventListener('click', event => { if (event.target === picker) { const bounds = picker.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) picker.close(); } });
picker.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); });
