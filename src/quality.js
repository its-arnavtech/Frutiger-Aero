// Choose a safe allocation budget BEFORE the first frame. Runtime resolution
// tuning is too late if startup has already exhausted a phone's GPU memory.
export function renderingProfile({ width, height, dpr = 1, coarsePointer = false, deviceMemory, compact = false, low = false, maxTextureSize = 4096, floatTargets = true }) {
  const mobile = low || compact || coarsePointer || Math.min(width, height) <= 600 || (deviceMemory > 0 && deviceMemory <= 4);
  const canvasRatio = Math.min(dpr, low ? 1 : mobile ? 1.5 : 2);
  const initialRatio = Math.min(canvasRatio, low ? .85 : mobile ? 1.15 : 1.5);
  const textureLimit = Math.pow(2, Math.floor(Math.log2(Math.max(128, maxTextureSize))));
  return {
    mobile, low, canvasRatio, initialRatio, floatTargets,
    shadowSize: Math.min(textureLimit, low ? 1024 : mobile ? 2048 : 4096),
    skySize: Math.min(textureLimit, low ? 256 : mobile ? 512 : 1024),
    probeSize: Math.min(textureLimit, low ? 128 : mobile ? 256 : 768),
    lightSize: Math.min(textureLimit, mobile ? 128 : 256),
    mirrorSize: low ? 256 : mobile ? 384 : 960,
    occlusion: !mobile, bloom: !low, atmosphere: !mobile, calibrate: !mobile,
  };
}
