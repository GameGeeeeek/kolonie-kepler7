'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cases=[
 ['font','nav',['navigation remains readable']],
 ['selection','nav',['native selection opens','selected panel receives focus']],
 ['focus','nav',['selected panel receives focus']],
 ['labels','hud',['six real resource labels']],
 ['gains','hud',['native production and capacity']],
 ['options','hud',['location picker renders escaped names']],
 ['queue','actions',['inspector queue uses the selected building','colony queue stays separate']],
 ['layer','status',['open status entry remains above its backdrop']],
 ['status','status',['status remains usable across resizing','status entry opens the native fleet drawer immediately']],
 ['sticky','sticky',['menu stays reachable while reading long']],
 ['chat-layer','hud',['native chat is visible above the navigation']],
 ['moon-name','english',['English mode preserves player owned names']],
 ['status-focus','status',['closing status returns keyboard focus']],
 ['input-size','sticky',['menu stays reachable while reading long']],
 ['collection-size','sticky',['menu stays reachable while reading long']],
 ['form-round','form',['3: über alle 12 Tabs gibt es nur die einheitliche 3px-Kommandoecke']],
 ['form-asymmetric','form',['3: über alle 12 Tabs gibt es nur die einheitliche 3px-Kommandoecke']],
 ['status-position','status',['status heading and close control remain inside the screen']],
 ['mission-source','data',['fleet summary includes']],
 ['queue-source','actions',['queue summary counts orders at every location']],
 ['queue-overlay','status',['queue shortcut closes the fleet drawer']],
 ['value-fit','hud',['all six endgame resource values']],
 ['safe-area','safe',['native HUD entry points avoid the PWA safe areas','fleet drawer and content clearance follow the actual status height','mobile drawer close control avoids the PWA safe areas']],
 ['status-height','safe',['fleet drawer and content clearance follow the actual status height']],
 ['queue-offset','status',['queue shortcut keeps its native heading below the sticky header']],
 ['drawer-scroll','nav',['mobile navigation uses a single vertical drawer','all thirteen mobile sections are reachable by ordinary drawer scrolling']],
 ['status-box','safe',['fleet drawer and content clearance follow the actual status height']],
 ['nav-alignment','nav',['all thirteen navigation symbols share a consistent label alignment']]
];
const requested=process.argv.slice(2);if(requested.some(f=>!cases.some(c=>c[0]===f)))throw Error('Unknown controlled regression');
for(const [fault,surface,expected] of cases.filter(c=>!requested.length||requested.includes(c[0]))){
 const result=spawnSync(process.execPath,surface==='form'?['tests/http-run.js','test_formensprache.js']:['-e',`require('./tests/lib/command-shell').run('${surface}').then(c=>process.exitCode=c)`],{cwd:root,env:{...process.env,K7_COMMAND_FAULT:fault,...(surface==='form'?{K7_FORM_COMMAND_FAULT:fault==='form-asymmetric'?'asymmetric':'round'}:{})},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 const output=(result.stdout||'')+(result.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - '));
 if(result.status!==1||!failures.length||failures.some(l=>!expected.some(label=>l.startsWith('FAIL - '+label)))||!(surface==='form'?/OK\s+- 3: die Messung sieht überhaupt Elemente/.test(output):output.includes('OK - command shell uses native actions without JavaScript errors')))throw Error(fault+' did not reject only its intended regression:\n'+output);
 console.log('OK - '+fault+' rejects only its intended regression ('+failures.length+' checks)');
}
