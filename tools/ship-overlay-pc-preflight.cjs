// Temporary preflight controller: this file is never admitted to the release branch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.ship-overlay-evidence');
fs.mkdirSync(out,{recursive:false});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>cp.execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
const tracked=git('ls-files','-z').split('\0').filter(Boolean);
const freeze=()=>Object.fromEntries([...tracked,...['.review-backend/server.js']].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const report={startedUTC:new Date().toISOString(),head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),backend:git('-C',path.join(root,'.review-backend'),'rev-parse','HEAD'),runner:process.env.RUNNER_NAME,os:process.env.RUNNER_OS,run:process.env.GITHUB_RUN_ID,cases:[],passed:false};
let frozen;
function run(name,args,env={}){
 const startedUTC=new Date().toISOString(),result=cp.spawnSync(process.execPath,args,{cwd:root,env:{...process.env,KEPLER_SHIP_MARK_EVIDENCE:path.join(out,name+'-pixels'),...env},encoding:'utf8',timeout:600000,maxBuffer:64*1024*1024});
 const log=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(path.join(out,name+'.log'),log,{flag:'wx'});
 const gpu=log.split('\n').filter(line=>line.startsWith('[chromium-gpu] ')).map(line=>JSON.parse(line.slice('[chromium-gpu] '.length)));
 const records=log.split(/\r?\n/).filter(line=>/^(OK|FAIL) - /.test(line)).map(line=>({name:line.slice(line.indexOf(' - ')+3).split(' | ')[0],ok:line.startsWith('OK - ')}));
 const item={name,args,startedUTC,endedUTC:new Date().toISOString(),status:result.status,signal:result.signal,error:result.error?.message,bytes:Buffer.byteLength(log),sha256:sha(log),records,gpu};
 report.cases.push(item);console.log(name+': '+JSON.stringify({status:item.status,records:records.length,failures:records.filter(r=>!r.ok).length,gpu:gpu.map(g=>g.renderer)}));return {item,log};
}
function nativeGuards(result,manifest,summaryName){
 // The original test prints one separately named summary after every guard.
 // Retain and validate that line; never count it as a 57th/87th/38th assertion.
 const {item,log}=result;item.guardRecords=item.records.slice(0,-1);item.summary=item.records.at(-1);
 const failures=item.guardRecords.filter(record=>!record.ok).length;
 const footers=log.split(/\r?\n/).filter(line=>/^\d+ checks, \d+ failures$/.test(line));
 return item.records.length===manifest.length+1&&item.guardRecords.every((record,index)=>record.name===manifest[index])
  &&item.summary?.name===summaryName&&item.summary.ok===(failures===0)
  &&footers.length===1&&footers[0]===manifest.length+' checks, '+failures+' failures';
}
function native(name,file){
 const manifest=require(path.join(root,'tests',file)).manifest;
 const result=run(name,['tests/http-run.js',file]);
 const summary={'test_ship_raster_mark_details.js':'Native ship raster mark details','test_ship_raster_art.js':'Native ship raster art','test_ship_raster_sharpness.js':'Native ship raster sharpness'}[file];
 result.item.passed=nativeGuards(result,manifest,summary)&&result.item.status===0&&result.item.gpu.length>0&&result.item.guardRecords.every(record=>record.ok);
 return result;
}
try{
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(report.os,'Linux');assert.match(report.runner||'',/^saschaneu-kolonie-kepler7-/);assert.equal(process.env.PC_CHROMIUM_GPU,'1');assert.equal(process.env.PC_CHROMIUM_GPU_AVAILABLE,'1');assert.equal(report.backend,'00fe250194f419e1b0063f24da146bbb5c7041c7');
 frozen=freeze();report.before=frozen;
 const required=run('required',['tests/run.js','--nur-pflicht']);required.item.passed=required.item.status===0;
 native('mark-details','test_ship_raster_mark_details.js');
 if(!report.cases.at(-1).passed){run('sampling-diagnostics',['tools/ship-overlay-sampling-diagnostics.cjs']);report.diagnostics=report.cases.pop();}
 native('raster-art','test_ship_raster_art.js');
 native('sharpness','test_ship_raster_sharpness.js');
 const forge=run('forge-marks',['tests/test_werftmarken.js']);forge.item.passed=forge.item.status===0&&/\nPASS\s*$/.test(forge.log);
 const source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8'),fixedBlock="      // The authored hull already contains its panels, weapons and lights.\n      // Legacy polygon details do not follow these image features; keep the\n      // upgrade level on its plaque instead of painting dots across the hull.\n",oldBlock="      // Paid forge details remain on the real alpha silhouette, not a polygon\n      // which would cut the new wings or paste a flat hull over its panel work.\n      if(mk>=2){\n        const detail=document.createElement('canvas');detail.width=w;detail.height=h;const d=detail.getContext('2d');\n        if(d){\n          d.lineWidth=Math.max(.6,stil.kielDicke*s);d.strokeStyle='rgba(5,10,18,.55)';d.beginPath();d.moveTo(x,y+bh*stil.kielY);d.lineTo(x+bw,y+bh*stil.kielY);d.stroke();\n          if(mk>=3){d.lineWidth=Math.max(.6,s);d.strokeStyle='rgba(225,239,255,.6)';d.beginPath();d.moveTo(x,y+bh*stil.kanteY);d.lineTo(x+bw,y+bh*stil.kanteY-stil.kanteFall*s);d.stroke();}\n          if(mk>=4){\n            const turrets=(cfg.turrets||[]).slice();if(mk>=5)turrets.push([50-stil.turmAbstand,50,2.4,2]);\n            for(const [tx,ty,r,n]of turrets){const px=x+bw*(tx-x0)/(x1-x0),py=y+bh*(ty-y0)/Math.max(1,y1-y0),rr=Math.max(.7,r*s);\n              d.fillStyle='#273342';for(const off of n===1?[0]:[-rr*.4,rr*.4])d.fillRect(px,py+off,rr*stil.rohrLang,Math.max(.6,rr*.35));d.fillStyle='#abbccc';d.beginPath();d.ellipse(px,py,rr,rr*.8,0,0,Math.PI*2);d.fill();}\n          }\n          if(mk>=6){const px=x+bw*(stil.mastX-x0)/(x1-x0),py=y+bh*.32;d.strokeStyle='#c1e7ff';d.lineWidth=Math.max(.6,s*.65);d.beginPath();d.moveTo(px,py);d.lineTo(px,py-stil.mastHoch*s);d.stroke();}\n          if(mk>=7){d.fillStyle='#d3f1ff';for(let i=0;i<stil.lichtZahl;i++){const px=x+bw*(stil.lichtVon+(stil.lichtBis-stil.lichtVon)*i/Math.max(1,stil.lichtZahl-1)),py=y+bh*stil.lichtY;d.beginPath();d.arc(px,py,Math.max(.65,s),0,Math.PI*2);d.fill();}}\n          d.globalCompositeOperation='destination-in';d.drawImage(layer,0,0);ctx.drawImage(detail,0,0);\n        }\n      }\n";
 assert.equal(source.split(fixedBlock).length,2,'Exactly one corrected native block');
 const broken=Buffer.from(source.replace(fixedBlock,oldBlock));
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+broken.length+'\0')).update(broken).digest('hex');
 assert.equal(blob,'1b9880b4813a582c5cd13168a8c95389070f3fa4','Counterexample must be exactly the genuine original HTML, not an invented failure');
 const counterPath=path.join(out,'original-overlay.html');fs.writeFileSync(counterPath,broken,{flag:'wx'});report.counterSource={originalBlob:blob,sha256:sha(broken),onlyOverlayRestored:true};
 const guards=require(path.join(root,'tests/test_ship_raster_mark_details.js')),negative=run('original-overlay-counterexample',['tests/http-run.js','test_ship_raster_mark_details.js'],{KEPLER_SPIELDATEI:counterPath});
 const allowed=new Set([...require(path.join(root,'tests/test_ship_raster_art.js')).keys.map(guards.classLabel),...Object.entries({jaeger:2,cruisers:3,destroyers:4,carrier:5,frachter:6}).map(([key,mk])=>guards.stageLabel(key,mk))]);
 const complete=nativeGuards(negative,guards.manifest,'Native ship raster mark details'),failures=negative.item.guardRecords.filter(record=>!record.ok);
 negative.item.passed=complete&&negative.item.status===1&&negative.item.gpu.length>0&&failures.length>0&&failures.every(record=>allowed.has(record.name))&&failures.some(record=>record.name===guards.classLabel('carrier'));
}catch(error){report.error=error.stack||String(error);console.error(report.error);}
finally{
 if(frozen){report.after=freeze();report.frozen=JSON.stringify(frozen)===JSON.stringify(report.after);}
 report.endedUTC=new Date().toISOString();report.passed=!report.error&&report.cases.length===6&&report.cases.every(item=>item.passed===true)&&report.frozen===true;
 fs.writeFileSync(path.join(out,'admission.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log('PC ship overlay admission: '+(report.passed?'PASS':'FAIL'));process.exitCode=report.passed?0:1;
}
