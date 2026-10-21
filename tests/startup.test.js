import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartup, waitFor, loadingMessage } from '../src/startup.js';
import { compileWorld } from '../src/gpu.js';
import { renderingProfile } from '../src/quality.js';

const pending = () => new Promise(() => {});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('loading errors explain recovery without exposing bundle URLs or driver logs', () => {
  assert.equal(loadingMessage(new Error('Failed to fetch dynamically imported module: /assets/main.js')), 'The world\u2019s files could not be loaded. Reload the page to get the latest version.');
  assert.match(loadingMessage(new Error('WebGL context unavailable')), /another browser/);
  assert.match(loadingMessage(new Error('Loading took too long')), /lighter rendering/);
});

test('mismatched module exports explain recovery without blaming the network or exposing source paths', () => {
  const message = loadingMessage(new SyntaxError("The requested module '/src/autumn/layout.js' does not provide an export named 'millRace'"));
  assert.match(message, /Reload the page/);
  assert.doesNotMatch(message, /connection|layout\.js|millRace/);
  assert.equal(loadingMessage(new Error('Unknown render failure')), 'The world could not finish loading. Please try again.');
});
function startup(timeoutMs = 1000) {
  const events = [];
  const lifecycle = createStartup({ timeoutMs, onReady: () => events.push('ready'), onError: error => events.push(error.message), onStage: stage => events.push(stage) });
  return { lifecycle, events };
}

test('a stalled rendering-bundle download leaves loading with a retryable error', async () => {
  const { lifecycle, events } = startup(20);
  await lifecycle.run(pending);
  assert.equal(lifecycle.state, 'error');
  assert.equal(lifecycle.signal.aborted, true);
  assert.match(events[0], /took too long/);
  assert.equal(events.length, 1);
});

test('a failed world asset or unavailable WebGL never reveals a blank world', async () => {
  for (const failure of ['Texture request failed', 'WebGL 2 unavailable']) {
    const { lifecycle, events } = startup();
    await lifecycle.run(() => { throw new Error(failure); });
    assert.equal(lifecycle.state, 'error');
    assert.deepEqual(events, [failure]);
  }
});

test('context loss during startup aborts work and cannot be undone by late success', async () => {
  const { lifecycle, events } = startup();
  let complete;
  const loading = lifecycle.run(() => new Promise(resolve => { complete = resolve; }));
  await delay(0);
  lifecycle.fail(new Error('Graphics connection interrupted'));
  await loading;
  complete(); await delay(0);
  assert.equal(lifecycle.state, 'error');
  assert.deepEqual(events, ['Graphics connection interrupted']);
});

test('a successful first frame clears the watchdog; optional work is not awaited', async () => {
  const { lifecycle, events } = startup(30);
  await lifecycle.run(async () => { await lifecycle.stage('Opening your daydream'); void pending(); });
  await delay(45);
  assert.equal(lifecycle.state, 'ready');
  assert.equal(lifecycle.signal.aborted, false);
  assert.deepEqual(events, ['Opening your daydream', 'ready']);
});

test('context loss after loading still stops the renderer and opens recovery once', async () => {
  const { lifecycle, events } = startup();
  await lifecycle.run(async () => {});
  lifecycle.fail(new Error('Graphics connection interrupted'));
  lifecycle.fail(new Error('Repeated loss'));
  assert.equal(lifecycle.signal.aborted, true);
  assert.deepEqual(events, ['ready', 'Graphics connection interrupted']);
});

test('a stalled texture or leaf decode has a deadline', async () => {
  await assert.rejects(waitFor(pending(), { timeoutMs: 15, label: 'Loading the trees' }), /Loading the trees took too long/);
});

test('aborting a resource wait handles a late network rejection', async () => {
  const controller = new AbortController();
  let reject;
  const loading = waitFor(new Promise((_, fail) => { reject = fail; }), { signal: controller.signal });
  controller.abort(new Error('Cancelled'));
  await assert.rejects(loading, /Cancelled/);
  reject(new Error('Late network failure'));
  await delay(0); // An unhandled rejection fails the Node test runner.
});

function gpu({ extension = true, ready = true, lost = false, linked = true } = {}) {
  let checks = 0, flushes = 0;
  const gl = { LINK_STATUS: 1, getExtension: () => extension ? { COMPLETION_STATUS_KHR: 2 } : null,
    getProgramParameter: (_, flag) => { checks++; return flag === 1 ? linked : ready; },
    isContextLost: () => lost, flush: () => { flushes++; },
  };
  return { renderer: { compile() {}, getContext: () => gl, info: { programs: [{ program: {} }] } },
    get checks() { return checks; }, get flushes() { return flushes; } };
}

test('shader preparation succeeds with and without parallel compilation support', async () => {
  for (const extension of [true, false]) {
    const fixture = gpu({ extension });
    await compileWorld(fixture.renderer, {}, {});
    assert.equal(fixture.flushes, 1);
  }
});

test('a mobile driver that never completes compilation times out and stops polling', async () => {
  const fixture = gpu({ ready: false });
  await assert.rejects(compileWorld(fixture.renderer, {}, {}, { timeoutMs: 20 }), /took too long/);
  const checks = fixture.checks;
  await delay(20);
  assert.equal(fixture.checks, checks, 'no runaway compilation polling after timeout');
});

test('context loss and shader failure reject before rendering', async () => {
  await assert.rejects(compileWorld(gpu({ lost: true }).renderer, {}, {}), /graphics connection/);
  await assert.rejects(compileWorld(gpu({ linked: false }).renderer, {}, {}), /prepare the world graphics/);
});

test('aborting shader compilation stops polling without reporting ready', async () => {
  const fixture = gpu({ ready: false }), controller = new AbortController();
  const work = compileWorld(fixture.renderer, {}, {}, { signal: controller.signal });
  controller.abort(new Error('Context lost'));
  await assert.rejects(work, /Context lost/);
  const checks = fixture.checks; await delay(10);
  assert.equal(fixture.checks, checks);
});

test('iPhone 12 portrait and landscape use the same bounded allocation budget', () => {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const p = renderingProfile({ width, height, dpr: 3, coarsePointer: true });
    assert.equal(p.mobile, true);
    assert.ok(p.canvasRatio <= 1.5);
    assert.ok(p.initialRatio <= 1.15);
    assert.ok(p.shadowSize <= 2048 && p.skySize <= 512 && p.probeSize <= 256 && p.mirrorSize <= 384);
    assert.equal(p.calibrate, false, 'no blocking GPU readback benchmark before first frame');
    assert.equal(p.atmosphere, false, 'no optional Phaser download on the critical phone path');
  }
});

test('desktop quality is retained and constrained GPUs respect their texture limit', () => {
  const desktop = renderingProfile({ width: 1920, height: 1080, dpr: 2 });
  assert.equal(desktop.mobile, false);
  assert.equal(desktop.shadowSize, 4096);
  assert.equal(desktop.canvasRatio, 2);
  const limited = renderingProfile({ width: 1920, height: 1080, maxTextureSize: 512, floatTargets: false, compact: true });
  assert.equal(limited.floatTargets, false);
  assert.ok(limited.shadowSize <= 512 && limited.skySize <= 512 && limited.probeSize <= 512);
});

test('lighter rendering actually reduces the budget further on an existing phone', () => {
  const device = { width: 390, height: 844, dpr: 3, coarsePointer: true };
  const phone = renderingProfile(device), lighter = renderingProfile({ ...device, low: true });
  assert.ok(lighter.canvasRatio < phone.canvasRatio && lighter.initialRatio < phone.initialRatio);
  assert.ok(lighter.shadowSize < phone.shadowSize && lighter.probeSize < phone.probeSize);
  assert.equal(lighter.bloom, false);
});
