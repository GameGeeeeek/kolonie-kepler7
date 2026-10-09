'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
// Each regression changes only its isolated page, preserving the game checkout.
const cases=[
 ['secondary','test_zweite_ebene.js',{K7_SECONDARY_COMMAND_FAULT:'top'},['A2','A3','A4','A5','A6','A7'],['A0:','J1: keine Skriptfehler']],
 ['subtab','test_unterreiter_form.js',{K7_SUBTAB_COMMAND_FAULT:'cut'},['1a','1b'],['V4:','J1:']],
 ['scene','test_grafik_einzeiler.js',{K7_COLONY_COMMAND_FAULT:'shift'},['3b'],['3a: die native Kolonieszene']],
 ['map','test_karte_mobil.js',{K7_MAP_COMMAND_FAULT:'cover'},['2b'],['0-vorab: Boot ohne Skriptfehler','5: bis hierher keine Skriptfehler']]
];
const requested=process.argv.slice(2);
if(requested.some(name=>!cases.some(test=>test[0]===name)))throw Error('Unknown controlled HUD regression');
for(const [name,file,env,expected,anchors] of cases.filter(test=>!requested.length||requested.includes(test[0]))){
 const result=spawnSync(process.execPath,['tests/http-run.js',file],{
  cwd:root,env:{...process.env,...env},encoding:'utf8',timeout:300000,maxBuffer:4*1024*1024
 });
 const output=(result.stdout||'')+(result.stderr||'');
 const failed=output.split('\n').filter(line=>line.startsWith('FAIL - '));
 const names=failed.map(line=>/^FAIL - ([^:]+):/.exec(line)?.[1]);
 if(result.status!==1||expected.some(key=>!names.includes(key))||names.some(key=>!expected.includes(key))||
  anchors.some(anchor=>!output.split('\n').some(line=>/^OK\s+- /.test(line)&&line.includes(anchor)))){
  console.error(output);
  throw Error(name+' did not reject only its controlled regression');
 }
 console.log('OK - '+name+' regression rejects only '+expected.join(', '));
}
