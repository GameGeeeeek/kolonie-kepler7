'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-language-red-'));
const source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8'),files=[];
try{
  for(const [name,before,after,expected] of [
    ['personal-text',"return '<span translate=\"no\">' + escapedText + '</span>';","return '<span>' + escapedText + '</span>';",'friend name and tag must remain German'],
    ['full-help','const sections = HELP_SECTIONS;',"const sections = K7_LANGUAGE === 'en' ? HELP_SECTIONS_EN : HELP_SECTIONS;",'English must include every original help entry'],
    ['reviewed-description',"'name', 'label', 'title', 'desc', 'effectDesc'","'name', 'label', 'title', 'effectDesc'",'research:rsolar:desc reviewed English description']
  ]){
    assert.equal(source.split(before).length,2,name+' unique mutation');
    const file=path.join(dir,name+'.html');files.push(file);fs.writeFileSync(file,source.replace(before,after));
    const result=spawnSync(process.execPath,[path.join(root,'tests/test_english_complete.js')],{cwd:root,encoding:'utf8',timeout:60000,env:{...process.env,KEPLER_SPIELDATEI:file}});
    assert.equal(result.status,1,name+' must fail');assert.ok((result.stdout+result.stderr).includes(expected),result.stdout+result.stderr);
    console.log('RED CONFIRMED - '+name);
  }
}finally{
  for(const file of files)fs.unlinkSync(file);
  fs.rmdirSync(dir);
}
