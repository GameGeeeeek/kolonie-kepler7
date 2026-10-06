'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixture=require('./lib/ideas-fixture');
const reviewed=JSON.parse(fs.readFileSync(path.join(__dirname,'../tools/i18n/reviewed-source.json'),'utf8'));
(async()=>{
  const f=await fixture('translate:k7t,view:k7View,shipName:shipDisplayName,buildingName:buildingDisplayName,resName:resLabel,research:RESEARCH_DEFS,modules:MODULE_DEFS,shipModules:SHIP_MODULE_DEFS,help:HELP_SECTIONS,renderHelp:renderHelpBox,profile:showPlayerProfile,commander:renderCommanderProfile,allianceDescription:renderAllianceDescription,chat:chatVerlaufHtml,compose:openMessageCompose,messages:rows=>{messagesCache=rows;renderMessagesBox();},friends:rows=>{state.friends=rows;lastFriendsSig=null;renderFriendsBox();}', 'en', {api:async({path,json})=>{if(path!=='messages')return false;await json({messages:[{fromName:'Warteschlange',fromUserId:'x',text:'Keine Forschung läuft.',time:Date.now()}]});return true;}});
  try{
    const p=f.page;
    const definitions=await p.evaluate(reviewed=>{
      const t=__ideas,before=JSON.stringify([t.research,t.modules,t.shipModules]),stock=JSON.stringify(t.state().resources);
      const rows=reviewed.map(r=>{const [group,key,field]=r.id.split(':'),list=group==='research'?t.research:group==='modules'?t.modules:t.shipModules,d=list.find(d=>d.key===key);return {id:r.id,source:d&&d[field],target:d&&t.view(d)[field]};});
      return {rows,unchanged:before===JSON.stringify([t.research,t.modules,t.shipModules])&&stock===JSON.stringify(t.state().resources),ship:t.shipName('jaeger'),resource:t.resName('erz'),building:t.buildingName('mine')};
    },reviewed);
    assert.equal(definitions.unchanged,true,'translation must leave source definitions and stock unchanged');
    for(let i=0;i<reviewed.length;i++){assert.equal(definitions.rows[i].source,reviewed[i].source,reviewed[i].id+' German source');assert.equal(definitions.rows[i].target,reviewed[i].target,reviewed[i].id+' reviewed English description');}
    assert.equal(definitions.ship,'Fighters');assert.equal(definitions.resource,'Ore');assert.equal(definitions.building,'Ore mine');
    const helpCounts=await p.evaluate(()=>{__ideas.renderHelp('grundlagen');return {categories:__ideas.help.length,entries:__ideas.help.reduce((n,s)=>n+s.entries.length,0)};});
    await p.waitForTimeout(200);
    assert.equal(await p.locator('#helpBox .help-category').count(),helpCounts.categories,'English must include every original help category');
    assert.equal(await p.locator('#helpBox .help-entry').count(),helpCounts.entries,'English must include every original help entry');
    assert.equal(await p.locator('#helpBox [data-help-cat="grundlagen"]').getAttribute('class'),'help-category open');
    const allHelp=await p.locator('#helpBox').textContent();
    assert.doesNotMatch(allHelp,/Grundlagen|je Stufe der Aufbereitungsanlage|Fähigkeitspunkte behalten|Baustellen-Konto|Häufige Fragen/,'full English help, including closed categories');
    console.log('PASS all '+reviewed.length+' reviewed definitions; full '+helpCounts.categories+'-category English help');
    await p.evaluate(()=>{
      const t=__ideas,s=t.state();s.player.name='Warteschlange';s.player.allianceTag='Jäger';t.commander();
      t.messages([{fromName:'Warteschlange',fromUserId:'x',text:'Keine Forschung läuft.',time:Date.now()}]);
      t.friends([{id:'friend',name:'Heimatbasis',allianceTag:'Jäger'}]);
      t.profile({id:'other',name:'Warteschlange',allianceTag:'Jäger',title:'Grundlagen',score:100,lastSeen:Date.now()});
      t.allianceDescription({description:'Keine Forschung läuft.'});
      const chat=document.createElement('div');chat.id='actual-chat-probe';chat.innerHTML=t.chat([{authorId:'friend',authorName:'Warteschlange',authorAllianceTag:'Jäger',text:'Keine Forschung läuft.',ts:Date.now()},{authorName:'Jäger',text:'<img src=x onerror=alert(1)>',ts:Date.now()}],{kanal:'global'});document.body.append(chat);
      t.compose('friend','Warteschlange');document.getElementById('messageComposeText').value='Keine Forschung läuft.';
    });
    await p.waitForTimeout(250);
    assert.equal(await p.locator('#profileModalName').textContent(),'Warteschlange','personal profile name must remain German');
    assert.match(await p.locator('#profileModalAlliance').textContent(),/Jäger.*Grundlagen/,'player-owned tag and title must remain German');
    assert.match(await p.locator('#friendsBox').textContent(),/Heimatbasis.*Jäger/,'friend name and tag must remain German');
    assert.match(await p.locator('#messagesBox').textContent(),/Warteschlange/,'message sender must remain German');
    assert.match(await p.locator('#messagesBox').textContent(),/Keine Forschung läuft\./,'private message text must remain German');
    assert.equal(await p.locator('#allianceDescriptionDisplay').textContent(),'Keine Forschung läuft.','alliance free text must remain German');
    assert.match(await p.locator('#actual-chat-probe').textContent(),/Warteschlange.*Jäger[\s\S]*Keine Forschung läuft\./,'real chat renderer must preserve personal content');
    assert.equal(await p.locator('#actual-chat-probe img').count(),0,'preserving personal text must retain escaping');
    assert.match(await p.locator('#messageComposeTarget').textContent(),/Message to Warteschlange/,'compose translates only its authored label');
    assert.equal(await p.locator('#messageComposeText').inputValue(),'Keine Forschung läuft.','typed text must remain unchanged');
    assert.equal(f.errors.length,0,f.errors.join('\n'));
    console.log('PASS profiles, friends, chat, private messages, alliance description and input preserve original personal text');
  }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
