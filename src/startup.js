// Keep startup independent of the large rendering bundle: even a failed chunk
// download must replace the loading screen with something the visitor can use.
export function loadingMessage(error) {
  const message = error?.message || '';
  if (/graphics connection/i.test(message)) return 'The graphics connection was interrupted. Try lighter rendering or reopen the page.';
  if (/WebGL|world graphics/i.test(message)) return 'This browser could not open the 3D world. Try lighter rendering or another browser.';
  if (/took too long/i.test(message)) return 'The world is taking too long to load. Check your connection, then try again or use lighter rendering.';
  return 'The world could not finish loading. Check your connection and try again.';
}

export function waitFor(promise, { signal, timeoutMs = 30000, label = 'Loading' } = {}) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (callback, value) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      callback(value);
    };
    const aborted = () => finish(reject, signal.reason || new Error('Loading cancelled'));
    // Observe late rejection too, including when the signal was already aborted.
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal?.aborted) { aborted(); return; }
    signal?.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(() => finish(reject, new Error(`${label} took too long. Please try again.`)), timeoutMs);
  });
}

export async function yieldToBrowser(signal) {
  await new Promise(resolve => setTimeout(resolve, 0));
  if (signal?.aborted) throw signal.reason;
}

export function createStartup({ onReady, onError, onStage = () => {}, timeoutMs = 60000 }) {
  const controller = new AbortController();
  let state = 'loading', currentStage = 'Opening the world';
  const timer = setTimeout(() => fail(new Error(`${currentStage} took too long. Please try again.`)), timeoutMs);
  function fail(error) {
    if (state === 'error') return;
    state = 'error'; clearTimeout(timer);
    controller.abort(error);
    onError(error);
  }
  return {
    signal: controller.signal,
    get state() { return state; },
    fail,
    async stage(label) {
      if (controller.signal.aborted) throw controller.signal.reason;
      currentStage = label; onStage(label);
      await yieldToBrowser(controller.signal);
    },
    async run(load) {
      try {
        await waitFor(Promise.resolve().then(() => load(controller.signal)), { signal: controller.signal, timeoutMs, label: currentStage });
        if (controller.signal.aborted) return;
        clearTimeout(timer); state = 'ready'; onReady();
      } catch (error) { fail(error); }
    },
  };
}
