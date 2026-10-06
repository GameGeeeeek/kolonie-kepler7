'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'k7-front-red-'));
const source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8');
try{for(const [name,test,before,after,mustFail]of [
 ['queue','test_k7_planning.js','Math.max(0,step.level-current-queued)','Math.max(0,step.level-current)','again'],
 ['visibility','test_k7_gameplay.js','visible.has(target.sys)','true','hiddenTarget'],
 ['unknown-reward','test_k7_gameplay.js','function k7ReceiveReward(reward){',"function k7ReceiveReward(reward){if(reward.type==='invalid')return true;",'unknown'],
 ['trial-engine','test_tactical_trial.js','const battle=resolveBattlePhases(base*run.integrity/100,base*0.8,wave.counters[tactic],undefined,undefined,()=>draws[roll++]);','const battle={siege:3,phasen:[]};','result comes from all three actual combat phases'],
 ['loader-style','test_unterstuetzer.js','<style>:root{color-scheme:dark}html,body{background:#05070f}',
  '<style>:root{color-scheme:dark}html,body{background:#05070f}'+fs.readFileSync(path.join(__dirname,'styles.css'),'utf8'),
  'ERSTE Stilblock'],
 ['personal-name','test_k7_planning.js','<option translate="no" value="${escapeHtml(p.id)}"','<option value="${escapeHtml(p.id)}"','personal plan name remains untranslated'],
 ['delete-plan','test_k7_planning.js','k7PersonalGoals().blueprints.filter(p=>!p||p.id!==plan.id)','plans.filter(p=>p.id!==plan.id)','deleting one plan keeps unsupported entries'],
 ['plan-limit','test_k7_planning.js',"k7PersonalGoals().blueprints.length>=8?' disabled':''","plans.length>=8?' disabled':''",'preserved entries count toward the eight-plan limit']
]){
  assert.equal(source.split(before).length,2,name+' unique mutation');const file=path.join(dir,name+'.html');let changed=source.replace(before,after);
  if(name==='visibility')changed=changed.replaceAll('k7View(visible.get(target.sys)).name','(k7View(visible.get(target.sys))||{name:target.sys}).name');
  fs.writeFileSync(file,changed);
  const result=spawnSync(process.execPath,[path.join(root,'tests',test)],{cwd:root,encoding:'utf8',timeout:60000,env:{...process.env,KEPLER_SPIELDATEI:file}});
  const output=result.stdout+result.stderr;assert.equal(result.status,1,name+' must fail');assert.ok((output.includes('AssertionError')||/FAIL\s+- /.test(output))&&output.includes(mustFail),output);console.log('RED CONFIRMED - '+name+' → '+mustFail);
}}finally{fs.rmSync(dir,{recursive:true,force:true});}
