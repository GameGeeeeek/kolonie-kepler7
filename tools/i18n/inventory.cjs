'use strict';
// Read-only inventory of authored display text. History and player-owned data are excluded.
const fs=require('node:fs'),path=require('node:path');
const acorn=require('acorn'),walk=require('acorn-walk');
const {htmlSegments,decode}=require('./build.cjs');
const root=path.resolve(__dirname,'../..');
const fields=new Set(['name','label','title','desc','effectDesc','nicheDesc','text','hint','body','error','message','short','tooltip','description']);
const uiCalls=new Set(['log','pushToast','confirm','alert','prompt','showMessage','showToast']);
const german=/[äöüßÄÖÜ]|\b(?:der|die|das|dein|deine|deinen|einer|eines|einem|ein|eine|einen|und|oder|nicht|noch|keine|kein|wird|werden|wurde|wurden|kann|kannst|mit|bei|auf|aus|bis|je|pro|von|zum|zur|alle|aller|mehr|weniger|jetzt|hier|nach|vor|ohne|durch|ist|sind|bitte|du|deinem|deiner|stufe|schiffe|gebäude|forschung|allianz|kredite|energie|erz|kristalle|deuterium|warteschlange|produktion|kolonie|speichern|abbrechen|abholen)\b/i;
function inventory(source,file){
  const output=new Map();
  const add=(text,node,kind,scope)=>{text=decode(text).trim();const singleLabel=['definition','html','static','display'].includes(kind)&&/^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+$/.test(text);if(!text||!(german.test(text)||singleLabel)||/^https?:/.test(text)||scope==='DEPLOY_TARGETS')return;const record=output.get(text)||{text,locations:[]};record.locations.push({file,line:node?.loc?.start.line||1,kind,scope});output.set(text,record);};
  const html=file.endsWith('.html'),start=html?source.indexOf('<script>')+8:0,end=html?source.lastIndexOf('</script>'):source.length;
  if(html&&start<8)throw Error('Missing game script');
  const code=source.slice(start,end),offset=source.slice(0,start).split('\n').length-1;
  const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script',locations:true});
  function composed(node,parts){
    if(node.type==='Literal'&&typeof node.value==='string')return node.value;
    if(node.type==='CallExpression'&&['k7t','k7h'].includes(node.callee.name)&&node.arguments[0]?.type==='Literal')return node.arguments[0].value;
    if(node.type==='BinaryExpression'&&node.operator==='+')return composed(node.left,parts)+composed(node.right,parts);
    if(node.type==='TemplateLiteral')return node.quasis.map((q,i)=>(q.value.cooked||'')+(node.expressions[i]?composed(node.expressions[i],parts):'')).join('');
    return '{'+(parts.push(node)-1)+'}';
  }
  const scopeOf=ancestors=>{for(let i=ancestors.length-1;i>=0;i--){const a=ancestors[i];if(a.type==='VariableDeclarator'&&a.id.type==='Identifier')return a.id.name;if(a.type==='FunctionDeclaration')return a.id?.name||'function';}return 'static';};
  walk.fullAncestor(ast,(node,_,ancestors)=>{
    if(ancestors.some(a=>a.type==='VariableDeclarator'&&['PATCHNOTES','K7_TRANSLATIONS'].includes(a.id.name)))return;
    if(ancestors.some(a=>a.type==='CallExpression'&&['k7Ui'].includes(a.callee.name)))return;
    const parent=ancestors.at(-2),scope=scopeOf(ancestors),at={loc:{start:{line:(node.loc?.start.line||1)+offset}}};
    if(node.type==='BinaryExpression'&&node.operator==='+'&&!(parent?.type==='BinaryExpression'&&parent.operator==='+')){
      const combined=composed(node,[]);
      if(/<\/?[a-z][\w:-]*\b/i.test(combined))for(const s of htmlSegments(combined))add(combined.slice(s.start,s.end),at,'composed',scope);
      else add(combined,at,'composed',scope);
    }
    if(node.type==='TemplateLiteral'){
      if(ancestors.some(a=>a.type==='TaggedTemplateExpression'))return;
      const combined=node.quasis.map((q,i)=>(q.value.cooked||'')+(i<node.expressions.length?'{'+i+'}':'')).join('');
      if(/<\/?[a-z][\w:-]*\b/i.test(combined))for(const s of htmlSegments(combined))add(combined.slice(s.start,s.end),at,'template',scope);
      else if(german.test(combined))add(combined,at,'dynamic',scope);
      return;
    }
    if(node.type!=='Literal'||typeof node.value!=='string')return;
    if(parent?.type==='Property'&&parent.key===node||parent?.type==='MemberExpression'||ancestors.some(a=>a.type==='ImportDeclaration'))return;
    const value=node.value;
    if(/<\/?[a-z][\w:-]*\b/i.test(value)){for(const s of htmlSegments(value))add(value.slice(s.start,s.end),at,'html',scope);return;}
    if(parent?.type==='Property'&&fields.has(parent.key.name||parent.key.value)){add(value,at,'definition',scope);return;}
    if(ancestors.some(a=>a.type==='CallExpression'&&uiCalls.has(a.callee.name))){add(value,at,'message',scope);return;}
    if(ancestors.some(a=>a.type==='AssignmentExpression'&&['textContent','innerText','title','placeholder','innerHTML'].includes(a.left.property?.name))){add(value,at,'display',scope);return;}
    if(german.test(value)&&/[\s.!?:]/.test(value)&&!ancestors.some(a=>a.type==='CallExpression'&&a.callee.object?.name==='console'))add(value,at,'authored',scope);
  });
  if(html)for(const s of htmlSegments(source.slice(0,start-8)))add(source.slice(s.start,s.end),{loc:{start:{line:source.slice(0,s.start).split('\n').length}}},'static','document');
  return [...output.values()];
}
function main(){
  const catalogue=JSON.parse(fs.readFileSync(path.join(root,'locales/en.json'),'utf8'));
  const sources=['weltraum_kolonie.html','../kolonie-kepler7-backend/server.js','../kolonie-kepler7-backend/k7-ideas.js'];
  const entries=new Map();
  for(const file of sources)for(const entry of inventory(fs.readFileSync(path.join(root,file),'utf8'),file)){const old=entries.get(entry.text);if(old)old.locations.push(...entry.locations);else entries.set(entry.text,entry);}
  const all=[...entries.values()].map(e=>({...e,translated:Object.hasOwn(catalogue,e.text)&&catalogue[e.text]!==e.text}));
  const report={sources,total:all.length,translated:all.filter(e=>e.translated).length,missing:all.filter(e=>!e.translated)};
  fs.writeFileSync(path.join(__dirname,'inventory.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({total:report.total,translated:report.translated,missing:report.missing.length,kinds:report.missing.reduce((n,e)=>{const k=e.locations[0].kind;n[k]=(n[k]||0)+1;return n;},{})}));
}
if(require.main===module)main();
module.exports={inventory,german};
