import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, resolveTheme, themeHref, loadTheme } from '../src/themes.js';

test('original remains the default world; each available world has a deep link', () => {
  assert.equal(resolveTheme().id, 'original');
  for (const theme of themes.filter(t => t.available)) {
    const link = themeHref(theme.id);
    assert.equal(resolveTheme(link.slice(link.indexOf('?'))).id, theme.id);
  }
});
test('unknown or unfinished worlds fall back safely without attempting to load them', async () => {
  for (const id of ['winter', 'spring', 'missing', '__proto__', 'constructor']) {
    assert.equal(resolveTheme(`?world=${id}`).id, 'original');
    assert.equal(themeHref(id), null);
    await assert.rejects(loadTheme(id), /not available/);
  }
});
test('switching worlds preserves the phone recovery budget and resets scene-specific inspection settings', () => {
  assert.equal(themeHref('autumn', '?world=original&quality=low&view=1,2,3&off=water'), '/?world=autumn&quality=low');
  assert.equal(themeHref('original', '?world=autumn&quality=mobile'), '/?world=original&quality=mobile');
  assert.equal(themeHref('original', '?quality=arbitrary'), '/?world=original');
  assert.equal(themeHref('monsoon', '?world=autumn&quality=mobile'), '/?world=monsoon&quality=mobile');
});
