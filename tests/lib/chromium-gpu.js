'use strict';

const GPU_ARGS = ['--enable-gpu', '--enable-gpu-rasterization', '--ozone-platform=x11',
  '--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-software-rasterizer'];

function gpuOptions(options, env = process.env) {
  if (env.PC_CHROMIUM_GPU !== '1') return options;
  if (!env.DISPLAY) throw new Error('GPU graphics tests require a virtual X display (xvfb-run).');
  if (env.GITHUB_ACTIONS === 'true' && env.PC_CHROMIUM_GPU_AVAILABLE !== '1') {
    throw new Error('This CI runner has no verified private GPU display; run Enable-ChromiumGPU.ps1 first.');
  }
  if (options.ignoreDefaultArgs === true) throw new Error('GPU tests require the normal Chromium defaults.');
  return {...options, headless: false,
    ignoreDefaultArgs: [...new Set([...(options.ignoreDefaultArgs || []), '--enable-unsafe-swiftshader'])],
    args: [...(options.args || []), ...GPU_ARGS]};
}

async function inspectBrowser(browser) {
  const page = await browser.newPage();
  try {
    const witness = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 4;
      const gl = canvas.getContext('webgl', {preserveDrawingBuffer: true});
      if (!gl) throw new Error('WebGL context unavailable');
      gl.clearColor(.25, .5, .75, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      const pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (gl.getError() || [64,128,191,255].some((v,i) => Math.abs(pixel[i]-v)>1)) throw new Error('WebGL pixel check failed');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), pixel: [...pixel]};
    });
    const session = await browser.newBrowserCDPSession();
    try {
      const {gpu} = await session.send('SystemInfo.getInfo');
      return {...witness, browser: browser.version(), features: gpu.featureStatus};
    } finally { await session.detach(); }
  } finally { await page.close(); }
}

function assertHardware(report) {
  if (!/NVIDIA|AMD|Intel|Radeon|D3D12/i.test(report.renderer) ||
      /swiftshader|llvmpipe|softpipe|software|basic render/i.test(report.renderer) ||
      !['2d_canvas', 'gpu_compositing', 'rasterization', 'webgl'].every(key => /^enabled/.test(report.features[key] || ''))) {
    throw new Error(`Hardware GPU required; software fallback rejected: ${JSON.stringify(report)}`);
  }
}

async function launchBrowser(chromium, options) {
  const browser = await chromium.launch(gpuOptions(options));
  if (process.env.PC_CHROMIUM_GPU === '1') {
    try {
      const report = await inspectBrowser(browser);
      assertHardware(report);
      console.log('[chromium-gpu] ' + JSON.stringify(report));
    } catch (error) { await browser.close(); throw error; }
  }
  return browser;
}

module.exports = {gpuOptions, inspectBrowser, assertHardware, launchBrowser};
