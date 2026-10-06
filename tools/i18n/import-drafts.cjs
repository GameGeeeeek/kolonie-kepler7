'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validate}=require('./quality.cjs');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'locales/en.json');
const draftFile=process.argv[2];
if(!draftFile)throw Error('Pass the development drafts.json path');
const existing=JSON.parse(fs.readFileSync(file,'utf8')),drafts=JSON.parse(fs.readFileSync(draftFile,'utf8'));
const reviewed=JSON.parse(fs.readFileSync(path.join(__dirname,'reviewed-source.json'),'utf8'));
const overridesFile=path.join(__dirname,'reviewed-text.json');
const overrides=fs.existsSync(overridesFile)?JSON.parse(fs.readFileSync(overridesFile,'utf8')):{};
const glossary=JSON.parse(fs.readFileSync(path.join(__dirname,'glossary.json'),'utf8'));
const candidate={...existing};
function terminology(source,text){
  text=text.replace(/,{2,}/g,',').replace(/[\u201c\u201d]/g,'"');
  if(/Beute/.test(source))text=text.replace(/\bprey\b/gi,'loot');
  if(/Kampfpunkte/.test(source))text=text.replace(/\bbattle points\b/gi,'combat points');
  if(/Kredite/.test(source))text=text.replace(/\bloans\b/gi,'credits');
  if(/Kredit/.test(source))text=text.replace(/\bloans\b/gi,'credits');
  if(/Leeren|Leere-|Void/.test(source))text=text.replace(/\b[Ee]mpty\b/g,'Void');
  if(/Fraktion/.test(source))text=text.replace(/\bfraction(?:s)?\b/gi,word=>word.endsWith('s')?'factions':'faction');
  if(/Schwarm/.test(source))text=text.replace(/\bsponge\b/gi,'swarm');
  if(/imperiumsweit|Imperium/.test(source))text=text.replace(/\bempirical(?:ly)?\b/gi,'empire-wide');
  if(/Baustellen-Konto/.test(source))text=text.replace(/construction site account/gi,'construction account');
  if(/Ausgeben.*(?:Fortschritt|Sternenstaub|Shop)|(?:Kredite|Sternenstaub).*ausgeben/.test(source))text=text.replace(/\bprint\b/gi,'spend');
  return text;
}
for(const [key,draft] of Object.entries(drafts)){
  if(Object.hasOwn(existing,key)&&!validate(key,existing[key]).length)continue;
  candidate[key]=terminology(key,draft.text);
}
for(const record of reviewed)candidate[record.source]=record.target;
Object.assign(candidate,overrides);
// Stable place-name prefixes are retained; only their authored geographic suffix changes.
const suffixes={System:'System',Arm:'Arm',Cluster:'Cluster',Sektor:'Sector',Schneise:'Corridor',Tiefen:'Depths',Weiten:'Reaches',Weite:'Reach',Ring:'Ring',Feld:'Field',Bogen:'Arc',Reichweite:'Reach',Schleuse:'Gate',Zone:'Zone',Grat:'Ridge',Strom:'Stream',Anomalie:'Anomaly',Riff:'Reef',Passage:'Passage',Nebel:'Nebula',Saum:'Rim',Kluft:'Rift',Spirale:'Spiral',Schwelle:'Threshold',Tiefe:'Depth',Kern:'Core'};
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,'inventory.json'),'utf8'));
for(const entry of inventory.missing){
  if(!entry.locations.some(l=>['STAR_SYSTEMS','SCHUB_SYSTEMS','PLANETS'].includes(l.scope)))continue;
  const parts=entry.text.split('-'),last=parts.pop();
  if(parts.length&&suffixes[last])candidate[entry.text]=parts.join('-')+' '+suffixes[last];
  else if(!parts.length&&!/\s/.test(entry.text))candidate[entry.text]=entry.text;
}
Object.assign(candidate,glossary);
for(const [key,value] of Object.entries(candidate))candidate[key]=terminology(key,value);
const issues=[];
for(const [source,target] of Object.entries(candidate)){
  const errors=validate(source,target);
  if(errors.length)issues.push({source,target,errors});
}
fs.writeFileSync(path.join(__dirname,'quality-report.json'),JSON.stringify({total:Object.keys(candidate).length,issues},null,2)+'\n');
console.log(JSON.stringify({entries:Object.keys(candidate).length,reviewedDefinitions:reviewed.length,issues:issues.length,sample:issues.slice(0,3)}));
if(process.argv.includes('--apply')){
  if(issues.length)throw Error('Unresolved translation-quality issues; catalogue not written');
  fs.writeFileSync(file,JSON.stringify(candidate,null,2)+'\n');
}
module.exports={terminology};
