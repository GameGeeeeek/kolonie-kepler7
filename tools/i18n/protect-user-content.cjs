'use strict';
// Protect authored-data boundaries identified in the real renderers, without changing values.
const fs=require('node:fs'),path=require('node:path'),acorn=require('acorn'),walk=require('acorn-walk');
const {htmlSegments}=require('./build.cjs');
const file=path.resolve(__dirname,'../../weltraum_kolonie.html');
const html=fs.readFileSync(file,'utf8'),start=html.indexOf('<script>')+8,end=html.lastIndexOf('</script>');
if(start<8||end<=start)throw Error('Missing game script');
const code=html.slice(start,end),ast=acorn.parse(code,{ecmaVersion:'latest'}),edits=[];
const identity=/username|fromName|toName|sellerName|besitzerName|targetName|authorName|authorAllianceTag|allianceTag|claimedBy|schuetzling|customFleetName|colonyNames|colonyNotes|\.eigenName|\.tag\b|myAllianceTag\(|planetDisplayName\(|loadoutName\(|shipLoadoutName\(|vpNameVon\(|vpMeldName\(/;
const communities=/^(renderCommanderProfile|showPlayerProfile|renderFriendsBox|renderLeaderboardList|renderFpLeaderboard|renderWeeklyLeague|renderSeasonLeague|chatVerlaufHtml|renderMessagesBox)$/;
function privateText(text,scope){
  if(/\bk7PreserveUserText\b/.test(text)||/<[a-z][\w:-]*\b/i.test(text))return false;
  if(scope==='renderFriendsBox'&&text==='name')return true;
  if(identity.test(text))return true;
  if(communities.test(scope)&&/(?:k7View\()?\b(?:p|entry|e|f|m|player)\)?\.(?:name|text)\b/.test(text))return true;
  if(/Kofi|KoFi|Konto|Allianz/.test(scope)&&/(?:k7View\()?\b(?:e|k|m|a)\)?\.name\b/.test(text))return true;
  if(/Feedback|feedback|admin.*Chat|chatVerlaufHtml|renderMessagesBox/.test(scope)&&/\.(?:text|body|content|antwort)\b/.test(text))return true;
  return false;
}
walk.fullAncestor(ast,(node,_,ancestors)=>{
  if(node.type!=='TemplateLiteral'||ancestors.some(n=>n.type==='TaggedTemplateExpression'||n.type==='CallExpression'&&n.callee.name==='k7PreserveUserText'))return;
  const scope=[...ancestors].reverse().find(n=>n.type==='FunctionDeclaration')?.id?.name||'';
  let combined='';const ranges=[];
  node.quasis.forEach((q,i)=>{combined+=q.value.cooked||'';if(node.expressions[i]){const marker='K7EXP'+i+'END';ranges.push({node:node.expressions[i],start:combined.length,end:combined.length+marker.length});combined+=marker;}});
  if(!/<[a-z][\w:-]*\b/i.test(combined))return;
  const visible=htmlSegments(combined).filter(s=>!s.attr);
  for(const r of ranges){
    if(!visible.some(s=>r.start>=s.start&&r.end<=s.end))continue;
    const expression=code.slice(r.node.start,r.node.end);
    if(!privateText(expression,scope))continue;
    // Renderers escape these values before interpolation. Keep that exact escaping boundary.
    const escapedFriendName=scope==='renderFriendsBox'&&expression==='name';
    if(!/^escapeHtml\(/.test(expression)&&!/^planetDisplayName\(/.test(expression)&&!escapedFriendName)continue;
    const safe=/^escapeHtml\(/.test(expression)||escapedFriendName?expression:'escapeHtml('+expression+')';
    edits.push({start:r.node.start,end:r.node.end,value:'k7PreserveUserText('+safe+')'});
  }
});
edits.sort((a,b)=>a.start-b.start);
for(let i=1;i<edits.length;i++)if(edits[i].start<edits[i-1].end)throw Error('Overlapping private-text edits');
let result=code;
for(const edit of [...edits].reverse())result=result.slice(0,edit.start)+edit.value+result.slice(edit.end);
new Function(result);
fs.writeFileSync(file,html.slice(0,start)+result+html.slice(end));
console.log(JSON.stringify({protectedInterpolations:edits.length}));
