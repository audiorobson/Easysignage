const test = require('node:test');
const assert = require('node:assert/strict');
const { createDispatcher, isHttpUrl } = require('../js/command-dispatcher');

function buildActions(overrides) {
  const calls = [];
  const base = {
    restartPlayer: async () => { calls.push('restartPlayer'); return { ok: true }; },
    clearCache: async () => { calls.push('clearCache'); return { ok: true }; },
    openUrl: async (url) => { calls.push(['openUrl', url]); return { ok: true }; },
    rebootOs: async () => { calls.push('rebootOs'); return { ok: false, error: 'unsupported' }; },
    takeScreenshot: async () => { calls.push('takeScreenshot'); return { ok: false, error: 'unsupported' }; },
    rtspPlay: async (url) => { calls.push(['rtspPlay', url]); return { ok: false, error: 'unsupported' }; },
    rtspStop: async () => { calls.push('rtspStop'); return { ok: true }; },
  };
  return { actions: Object.assign(base, overrides), calls };
}

test('isHttpUrl aceita apenas http(s)', () => {
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('ftp://example.com'), false);
  assert.equal(isHttpUrl(undefined), false);
});

test('dispatch delega restartPlayer/clearCache', async () => {
  const { actions, calls } = buildActions();
  const dispatch = createDispatcher(actions);

  await dispatch('restartPlayer', []);
  await dispatch('clearCache', []);

  assert.deepEqual(calls, ['restartPlayer', 'clearCache']);
});

test('dispatch valida openUrl e rejeita URLs não-http', async () => {
  const { actions, calls } = buildActions();
  const dispatch = createDispatcher(actions);

  const rejected = await dispatch('openUrl', ['javascript:alert(1)']);
  assert.equal(rejected.ok, false);
  assert.equal(calls.length, 0);

  const accepted = await dispatch('openUrl', ['https://example.com']);
  assert.equal(accepted.ok, true);
});

test('rebootOs e takeScreenshot propagam indisponibilidade de privilégio (Tizen)', async () => {
  const { actions } = buildActions();
  const dispatch = createDispatcher(actions);

  const reboot = await dispatch('rebootOs', []);
  assert.equal(reboot.ok, false);

  const screenshot = await dispatch('takeScreenshot', []);
  assert.equal(screenshot.ok, false);
});

test('dispatch retorna erro para método desconhecido', async () => {
  const { actions } = buildActions();
  const dispatch = createDispatcher(actions);

  const result = await dispatch('doesNotExist', []);
  assert.equal(result.ok, false);
});
