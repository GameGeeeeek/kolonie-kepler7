'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cases=[
 ['scroll','test_reiterleiste.js','K7_NAV_FAULT','ALLE Reiter werden durch ihre native Auswahl sichtbar und aktiv'],
 ['font','test_reiterleiste.js','K7_NAV_FAULT','die lesbare Wischleiste spart Hoehe und zeigt ihren Hinweis'],
 ['compact-clipping','test_verdichtung.js','K7_DENSITY_FAULT','7b@'],
 ['gains','test_verdichtung.js','K7_DENSITY_FAULT','7c@']
];
for(const [fault,file,variable,label] of cases){
 const result=spawnSync(process.execPath,['tests/http-run.js',file],{cwd:root,env:{...process.env,[variable]:fault},encoding:'utf8',timeout:160000,maxBuffer:4*1024*1024});
 const output=(result.stdout||'')+(result.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - ')&&!l.includes('es gab rote Pruefungen'));
 if(result.status!==1||!failures.length||failures.some(l=>!l.includes(label)))throw Error(fault+' did not reject only its intended visual regression:\n'+output);
 console.log('OK - '+fault+' rejects only the intended visual regression ('+failures.length+' checks)');
}
