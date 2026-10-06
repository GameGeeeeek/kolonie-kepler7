'use strict';
// Refresh the existing embedded runtime; never stack the original compiler transforms.
const fs=require('node:fs'),path=require('node:path');
const acorn=require('acorn'),walk=require('acorn-walk');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'weltraum_kolonie.html');
let source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const begin='/* K7_ENGLISH_RUNTIME_BEGIN */',end='/* K7_ENGLISH_RUNTIME_END */';
if(source.split(begin).length!==2||source.split(end).length!==2)throw Error('Expected one English runtime');
const start=source.indexOf(begin),finish=source.indexOf(end);
if(finish<=start)throw Error('Invalid English runtime markers');
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'locales/en.json'),'utf8'));
const runtime=fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8').trimEnd()
  .replace('/* K7_CATALOG */{}',JSON.stringify(catalogue).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'));
source=source.slice(0,start)+begin+'\n'+runtime+'\n  '+source.slice(finish);
const scriptStart=source.indexOf('<script>')+8,scriptEnd=source.lastIndexOf('</script>');
if(scriptStart<8||scriptEnd<=scriptStart)throw Error('Missing game script');
let code=source.slice(scriptStart,scriptEnd);
const ast=acorn.parse(code,{ecmaVersion:'latest'}),registrations=[];
walk.fullAncestor(ast,(node,_,ancestors)=>{
  if(node.type!=='VariableDeclaration'||ancestors.filter(a=>/Function|ArrowFunction/.test(a.type)).length!==1)return;
  const names=[];
  for(const item of node.declarations){
    const name=item.id.name;
    if(!name||!/^[_A-Z][A-Z_0-9]*$/.test(name)||['PATCHNOTES','K7_TRANSLATIONS'].includes(name)||!['ObjectExpression','ArrayExpression'].includes(item.init?.type))continue;
    let authored=false;
    walk.simple(item.init,{Property:p=>{if(['name','label','title','desc','effectDesc','nicheDesc','text','hint','body'].includes(p.key.name||p.key.value)&&p.value.type==='Literal'&&typeof p.value.value==='string')authored=true;}});
    if(authored&&!code.includes('k7RegisterDefinitions('+name+');'))names.push(name);
  }
  if(names.length)registrations.push({at:node.end,text:'\n  '+names.map(n=>'k7RegisterDefinitions('+n+');').join('\n  ')});
});
for(const edit of registrations.sort((a,b)=>b.at-a.at))code=code.slice(0,edit.at)+edit.text+code.slice(edit.at);
new Function(code);
source=source.slice(0,scriptStart)+code+source.slice(scriptEnd);
fs.writeFileSync(file,source);
console.log('English runtime and catalogue synchronized; additional authored tables: '+registrations.length+'.');
