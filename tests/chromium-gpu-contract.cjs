const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const helper = require('./lib/chromium-gpu');
(async () => {
  const options={headless:true,args:[]};
  assert.equal(helper.gpuOptions(options,{}),options,'hosted and default settings stay unchanged');
  assert.throws(()=>helper.gpuOptions(options,{PC_CHROMIUM_GPU:'1'}),/virtual X display/);
  if (process.env.PC_CHROMIUM_GPU === '1') {
  const gpu=await chromium.launch(helper.gpuOptions({...options,channel:'chromium'},{PC_CHROMIUM_GPU:'1',DISPLAY:process.env.DISPLAY}));
  try { helper.assertHardware(await helper.inspectBrowser(gpu)); }
  finally { await gpu.close(); }
  }
  const software=await chromium.launch({channel:'chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const report=await helper.inspectBrowser(software);
    assert.throws(()=>helper.assertHardware(report),/software fallback rejected/,'a real CPU browser must not satisfy the GPU guard');
    console.log(JSON.stringify({gpuAccepted:process.env.PC_CHROMIUM_GPU === '1',softwareRejected:true,softwareRenderer:report.renderer}));
  } finally { await software.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
