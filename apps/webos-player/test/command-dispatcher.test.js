const test = require('node:test');
const assert = require('node:assert/strict');
const { createDispatcher, isHttpUrl } = require('../js/command-dispatcher');

function buildActions(overrides) {
  const calls = [];
  const base = {
    restartPlayer: async () => { calls.push('restartPlayer'); return { ok: true }; },
    clearCache: async () => { calls.push('clearCache'); return { ok: true }; },
    openUrl: async (url) => { calls.push(['openUrl', url]); return { ok: true }; },
    rebootOs: async () => { calls.push('rebootOs'); return { ok: true }; },
    takeScreenshot: async () => { calls.push('takeScreenshot'); return { ok: true, data: 'base64' }; },
    rtspPlay: async (url) => { calls.push(['rtspPlay', url]); return { ok: true }; },
    rtspStop: async () => { calls.push('rtspStop'); return { ok: true }; },
  };
  return { actions: Object.assign(base, overrides), calls };
}

test('isHttpUrl aceita apenas http(s)', () => {
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('ftp://example.com'), false);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl(''), false);
  assert.equal(isHttpUrl(undefined), false);
});

test('dispatch delega restartPlayer/clearCache/rebootOs/takeScreenshot sem args', async () => {
  const { actions, calls } = buildActions();
  const dispatch = createDispatcher(actions);

  await dispatch('restartPlayer', []);
  await dispatch('clearCache', []);
  await dispatch('rebootOs', []);
  await dispatch('takeScreenshot', []);

  assert.deepEqual(calls, ['restartPlayer', 'clearCache', 'rebootOs', 'takeScreenshot']);
});

test('dispatch valida openUrl e rejeita URLs não-http', async () => {
  const { actions, calls } = buildActions();
  const dispatch = createDispatcher(actions);

  const rejected = await dispatch('openUrl', ['javascript:alert(1)']);
  assert.equal(rejected.ok, false);
  assert.equal(calls.length, 0);

  const accepted = await dispatch('openUrl', ['https://example.com']);
  assert.equal(accepted.ok, true);
  assert.deepEqual(calls, [['openUrl', 'https://example.com']]);
});

test('dispatch valida rtspPlay exige URL não vazia', async () => {
  const { actions, calls } = buildActions();
  const dispatch = createDispatcher(actions);

  const rejected = await dispatch('rtspPlay', []);
  assert.equal(rejected.ok, false);

  const accepted = await dispatch('rtspPlay', ['rtsp://camera.local/stream']);
  assert.equal(accepted.ok, true);
  assert.deepEqual(calls, [['rtspPlay', 'rtsp://camera.local/stream']]);
});

test('dispatch retorna erro para método desconhecido', async () => {
  const { actions } = buildActions();
  const dispatch = createDispatcher(actions);

  const result = await dispatch('doesNotExist', []);
  assert.equal(result.ok, false);
  assert.match(result.error, /Método desconhecido/);
});
