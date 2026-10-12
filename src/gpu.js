import { waitFor, yieldToBrowser } from './startup.js';

// Three's compileAsync polls indefinitely when a driver loses its context.
// Poll the same WebGL completion flag with an abortable, bounded lifetime.
export async function compileWorld(renderer, scene, camera, { signal, timeoutMs = 15000 } = {}) {
  const gl = renderer.getContext();
  renderer.compile(scene, camera);
  const extension = gl.getExtension('KHR_parallel_shader_compile');
  const programs = renderer.info.programs.map(entry => entry.program);
  const compilation = new AbortController();
  const poll = async () => {
    gl.flush();
    while (true) {
      if (compilation.signal.aborted) throw compilation.signal.reason;
      if (signal?.aborted) throw signal.reason;
      if (gl.isContextLost()) throw new Error('The graphics connection was interrupted. Please try again.');
      if (!extension || programs.every(program => gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR))) break;
      await yieldToBrowser(compilation.signal);
    }
    if (programs.some(program => !gl.getProgramParameter(program, gl.LINK_STATUS))) throw new Error('This browser could not prepare the world graphics.');
  };
  try { await waitFor(poll(), { signal, timeoutMs, label: 'Preparing the light' }); }
  finally { compilation.abort(new Error('Shader preparation finished')); }
}
