import './style.css';
import { createStartup, loadingMessage } from './startup.js';

const loading = document.querySelector('#loading');
const message = loading.querySelector('span');
const recovery = document.querySelector('#loading-recovery');
const canvas = document.querySelector('#world');
const startup = createStartup({
  onStage(label) { message.textContent = label; loading.dataset.stage = label; },
  onReady() { loading.dataset.state = 'ready'; loading.classList.add('loaded'); },
  onError(error) {
    console.error('World startup:', error);
    loading.dataset.state = 'error'; loading.classList.remove('loaded');
    message.textContent = loadingMessage(error);
    recovery.hidden = false;
  },
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  startup.fail(new Error('The graphics connection was interrupted. Try the lighter rendering mode.'));
});
document.querySelector('#retry').addEventListener('click', () => location.reload());
document.querySelector('#retry-light').addEventListener('click', () => {
  const url = new URL(location.href); url.searchParams.set('quality', 'low'); location.replace(url);
});
startup.run(async signal => {
  const { init } = await import('./main.js');
  if (signal.aborted) throw signal.reason;
  await init({ signal, onStage: label => startup.stage(label), onError: startup.fail });
});
