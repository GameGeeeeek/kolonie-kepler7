// Persistent planning only. Valuable progression stays on the server, never in these fields.
function k7PersonalGoals() {
  if (!state.personalGoals || typeof state.personalGoals !== 'object' || Array.isArray(state.personalGoals)) state.personalGoals = {};
  return state.personalGoals;
}
function k7WishSet() {
  const wanted = k7PersonalGoals().wishSet;
  return k7LootSets().find(s=>s.key===wanted)||k7LootSets().find(s=>s.bossKey);
}
function k7LootSets(){return MODULE_SET_DEFS.map(s=>({...s,art:'standort'})).concat(SHIP_MODULE_SET_DEFS.map(s=>({...s,key:'schiff:'+s.key,art:'schiff'})));}
function k7LootItems(){return MODULE_DEFS.map(def=>({id:'standort:'+def.key,art:'standort',def})).concat(SHIP_MODULE_DEFS.map(def=>({id:'schiff:'+def.key,art:'schiff',def})));}
function k7OwnsLoot(def,art){
  const stock=art==='schiff'?state.shipModules:state.modules,equipped=art==='schiff'?state.equippedShipModules:state.equippedModules;
  return Object.entries(stock||{}).some(([key,count])=>count>0&&moduleTypeOf(key)===def.key)||Object.values(equipped||{}).some(list=>Array.isArray(list)&&list.some(key=>moduleTypeOf(key)===def.key));
}
function k7SetOwnership(set) {
  const defs=set.art==='schiff'?SHIP_MODULE_DEFS:MODULE_DEFS;
  return set.req.map(key=>{const def=defs.find(d=>d.key===key);return {def,owned:!!def&&k7OwnsLoot(def,set.art)};}).filter(row=>row.def);
}
function k7SelectWish(key) {
  if (!k7LootSets().some(s=>s.key===key)) return false;
  k7PersonalGoals().wishSet = key; save(); renderK7LootCompass(); return true;
}
function k7ItemWishes(){const goals=k7PersonalGoals();return [...new Set([...(Array.isArray(goals.wishItems)?goals.wishItems:[]),...(Array.isArray(goals.wishParts)?goals.wishParts.map(key=>'standort:'+key):[])])].filter(id=>k7LootItems().some(item=>item.id===id)).slice(0,100);}
function k7ToggleItemWish(id){
  if(!k7LootItems().some(item=>item.id===id))return false;
  const old=k7ItemWishes();if(!old.includes(id)&&old.length>=100)return false;
  k7PersonalGoals().wishItems=old.includes(id)?old.filter(key=>key!==id):old.concat(id);
  k7PersonalGoals().wishParts=k7PersonalGoals().wishItems.filter(key=>key.startsWith('standort:')).map(key=>key.slice(9));save();renderK7LootCompass();return true;
}
function k7LootSource(def,art){
  const source=modulFundort(def,art==='schiff'?SHIP_MODULE_DEFS:MODULE_DEFS,art),requirements=[],links=[];
  let label=k7t(source.text),chance=null;
  if(source.herkunft==='boss'){
    label=k7t('Passender Allianz-Raid-Boss; weitere serverbestimmte Boss-Set-Funde bei Festungen, Nestern und Weltboss.');
    requirements.push(k7t('Allianzmitgliedschaft und passende Raid-Welle für den gezielten Boss-Pool.'));
    links.push({tab:'allianz:uebersicht',text:k7t('Allianz-Raid')},{tab:'galaxie:kampf',text:k7t('Weltboss')},{tab:'karte',text:k7t('Sektorkarte')});
  }else if(source.herkunft==='abgrund'){
    const research=RESEARCH_DEFS.find(d=>d.key===ABGRUND_REQ_RESEARCH);
    requirements.push(k7t('Benötigte Forschung')+': '+k7t(research.name)+' 1',k7t('Mindesttiefe')+': '+source.minTiefe+' · '+k7t('Rekordtiefe')+': '+((state.abgrund||{}).best||0));
    links.push({tab:'galaxie:abgrund',text:k7t('Abgrund')});
  }else if(source.herkunft==='fertigung'){
    requirements.push(k7t('Nur gezielte Fertigung; kein Zufallsfund.'));
    if(def.craftCost)requirements.push(k7t('Kosten für Gewöhnlich')+': '+Object.entries(tier2ModuleCraftCost(def,'gewoehnlich')).map(([key,n])=>fmt(n)+' '+resLabel(key)).join(', '));
    links.push({tab:'offiziere:schiffsmodule',text:k7t('Schiffsmodul-Fertigung')});
  }else if(source.herkunft==='event'){
    const event=EVENT_CALENDAR.find(e=>e.key===def.eventKey),active=activeCalendarEventDef();
    requirements.push((event?k7t(event.name):def.eventKey)+' · '+k7t(active&&active.key===def.eventKey?'Event ist aktiv':'Event ist derzeit nicht aktiv'));
    chance=EVENT_MODULE_CHANCE;links.push({tab:'expedition',text:k7t('Expedition starten')},{tab:'galaxie:info',text:k7t('Ereigniskalender')});
  }else if(source.herkunft==='unikat'){
    requirements.push(k7t(def.fundort||source.text));
    links.push({tab:def.key==='waechterauge'?'galaxie:abgrund':'galaxie:kampf',text:k7t(def.fundort||source.text)});
  }else if(source.herkunft==='konvoi')links.push({tab:'karte',text:k7t('Sichtbare Wrackkonvois')});
  else if(source.herkunft==='normal')links.push({tab:'expedition',text:k7t('Expedition starten')},{tab:'galaxie:diplo',text:k7t('Fraktionen')});
  else requirements.push(k7t('Gezielte Vergabe; kein Zufallsfund.'));
  return {...source,label,requirements,links,chance,showShare:['normal','abgrund','boss'].includes(source.herkunft)&&source.anteil!==null};
}
function k7LootRow(def,art){
  const source=k7LootSource(def,art),id=art+':'+def.key,marked=k7ItemWishes().includes(id),owned=k7OwnsLoot(def,art);
  return `<div class="k7-item"><div class="k7-row"><strong>${escapeHtml(k7t(def.name))}</strong><span class="${owned?'k7-good':'k7-warn'}">${k7h(owned?'Vorhanden':'Fehlt')}</span><button data-k7-item-wish="${id}">${k7h(marked?'Wunsch entfernen':'Wunsch merken')}</button></div><div class="k7-muted">${k7View(def).desc||''}<p>${escapeHtml(source.label)}</p>${source.requirements.map(text=>`<p>${escapeHtml(text)}</p>`).join('')}${source.showShare?`<p>${(source.anteil*100).toFixed(1)}% · ${k7h('Anteil im zulässigen Fundtopf, keine Chance je Aktivität')}</p>`:''}${source.chance!==null?`<p>${(source.chance*100).toFixed(1)}% · ${k7h('Chance je erfolgreicher Expedition während dieses aktiven Events')}</p>`:''}</div><div class="k7-row">${source.links.map(link=>`<button data-k7-go="${link.tab}">${escapeHtml(link.text)}</button>`).join('')}</div></div>`;
}
function renderK7LootCompass() {
  const box = document.getElementById('k7LootCompass'); if (!box) return;
  const selected = k7WishSet(); if (!selected) return;
  const rows = k7SetOwnership(selected);
  let html = `<details class="k7-ideas" data-keep-open="k7loot"${detailsOpenAttr('k7loot')}><summary><i class="ti ti-target" aria-hidden="true"></i> ${k7h('Beutekompass und Wunschliste')} (${rows.filter(r=>r.owned).length}/${rows.length})</summary>
    <div class="k7-row"><label for="k7WishSet">${k7h('Set auswählen')}</label><select id="k7WishSet">${k7LootSets().map(s=>`<option value="${s.key}"${s.key===selected.key?' selected':''}>${escapeHtml(k7t(s.name))}</option>`).join('')}</select></div>
    <p class="k7-muted">${escapeHtml(k7t(selected.desc))}</p><p class="k7-muted">${k7h('Besitz vervollständigt die Sammlung. Set-Boni wirken erst durch passende Ausrüstung.')}</p>`;
  for(const row of rows)html+=k7LootRow(row.def,selected.art);
  const items=k7LootItems(),picked=items.find(item=>item.id===k7PersonalGoals().wishItem)||items[0];
  html+=`<h4>${k7h('Einzelne Gegenstände und Wunschziele')}</h4><label for="k7WishItem">${k7h('Gegenstand auswählen')}</label><select id="k7WishItem">${items.map(item=>`<option value="${item.id}"${item===picked?' selected':''}>${escapeHtml(k7t(item.def.name))} · ${k7h(item.art==='schiff'?'Schiffsmodul':'Standortmodul')}</option>`).join('')}</select>${k7LootRow(picked.def,picked.art)}`;
  for(const id of k7ItemWishes()){const item=items.find(row=>row.id===id);if(item.id!==picked.id&&!rows.some(row=>selected.art===item.art&&row.def.key===item.def.key))html+=k7LootRow(item.def,item.art);}
  html+='</details>';
  setBoxHtml(box, 'k7LootCompass', html);
  box.querySelector('#k7WishSet').onchange = e => k7SelectWish(e.target.value);
  box.querySelector('#k7WishItem').onchange=e=>{k7PersonalGoals().wishItem=e.target.value;save();e.target.blur();renderK7LootCompass();};
  box.querySelectorAll('[data-k7-item-wish]').forEach(btn=>btn.onclick=()=>k7ToggleItemWish(btn.dataset.k7ItemWish));
  k7BindGoalLinks(box);
}
function k7BindGoalLinks(box) {
  box.querySelectorAll('[data-k7-go]').forEach(btn => btn.onclick = () => geheZuZiel(btn.dataset.k7Go));
}
function k7Blueprints() {
  const goals = k7PersonalGoals();
  if (!Array.isArray(goals.blueprints)) goals.blueprints = [];
  return goals.blueprints.filter(plan=>plan&&typeof plan.id==='string'&&typeof plan.name==='string'&&Array.isArray(plan.steps));
}
function k7SaveBlueprint(name) {
  name = String(name||'').trim().slice(0,48);
  k7Blueprints();if (!name || k7PersonalGoals().blueprints.length >= 8) return false;
  const levels = currentBuildings();
  const steps = BUILDING_DEFS.filter(d=>d.category!=='defense' && Number.isFinite(levels[d.key]) && levels[d.key]>0)
    .map(d=>({key:d.key, level:Math.min(d.maxLevel||100, Math.floor(levels[d.key]))}));
  if (!steps.length) return false;
  k7PersonalGoals().blueprints.push({id:'bp-'+Date.now()+'-'+Math.random().toString(36).slice(2,8), name, steps});
  save(); renderK7Blueprints(); return true;
}
function k7BlueprintPreview(plan, planet) {
  if(planet!=='home'&&!Object.hasOwn(state.colonies||{},planet))return [];
  const buildings = planet==='home'?state.buildings:(state.colonies[planet]||{}).buildings;
  if (!buildings || !plan || !Array.isArray(plan.steps)) return [];
  return plan.steps.map(step => {
    if(!step||typeof step!=='object')return null;
    const def = BUILDING_DEFS.find(d=>d.key===step.key);
    if (!def || !Number.isInteger(step.level) || step.level<1 || step.level>(def.maxLevel||100)) return null;
    const current = buildings[def.key]||0;
    const queued = (state.buildQueue||[]).filter(q=>q.planet===planet && q.key===def.key).length
      + (state.constructionQueue||[]).filter(q=>q.planet===planet && q.key===def.key && q.kind==='building').reduce((sum,q)=>sum+(q.qty||1),0);
    const remaining = Math.max(0,step.level-current-queued);
    const moonBlocked=!!def.moonOnly&&!isMoonKey(planet);
    const unsupported=def.category==='defense';
    const specialItem=SPECIAL_UNIT_ITEMS[def.key]||null;
    const specialAvailable=specialItem?Math.max(0,(state.rareItems[specialItem]||0)-(state.buildQueue||[]).filter(q=>SPECIAL_UNIT_ITEMS[q.key]===specialItem).length):0;
    const specialMissing=specialItem?Math.max(0,remaining-specialAvailable):0;
    return {def, target:step.level, current, queued, remaining, moonBlocked, unsupported, specialItem, specialAvailable, specialMissing, unlocked:!unsupported&&!moonBlocked&&techUnlockedGeneric(def.requires)&&(!specialItem||specialAvailable>=1), cost:costForRange(def,current+queued,remaining)};
  }).filter(Boolean);
}
function k7QueueBlueprintStep(id, key, planet) {
  const plan = k7Blueprints().find(p=>p.id===id), row = k7BlueprintPreview(plan,planet).find(r=>r.def.key===key);
  if (!row || !row.unlocked || row.remaining<1 || (state.buildQueue||[]).length>=komfortGrenze('warteschlange')) return false;
  addToQueue(planet,key); return true;
}
let k7BlueprintSelection = '';
function renderK7Blueprints() {
  const box = document.getElementById('k7Blueprints'); if (!box || isTypingIn('k7Blueprints')) return;
  const plans = k7Blueprints();
  const plan = plans.find(p=>p.id===k7BlueprintSelection)||plans[0];
  if (plan) k7BlueprintSelection = plan.id;
  let html = `<details class="k7-ideas" data-keep-open="k7plans"${detailsOpenAttr('k7plans')}><summary><i class="ti ti-list-details" aria-hidden="true"></i> ${k7h('Kolonie-Baupläne')}</summary>
    <div class="k7-row"><input id="k7PlanName" maxlength="48" placeholder="${k7h('Name des Bauplans')}" aria-label="${k7h('Name des Bauplans')}"><button id="k7SavePlan"${k7PersonalGoals().blueprints.length>=8?' disabled':''}>${k7h('Aktuellen Ausbau speichern')}</button></div>
    <p class="k7-muted">${k7h('Planung zeigt Restkosten. Jede Übernahme reiht genau eine Stufe in die bestehende Bau-Wunschliste ein; ihre normalen Kosten und Regeln gelten.')}</p>`;
  if (plan) {
    html += `<div class="k7-row"><label for="k7PlanSelect">${k7h('Plan auswählen')}</label><select id="k7PlanSelect">${plans.map(p=>`<option translate="no" value="${escapeHtml(p.id)}"${p===plan?' selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select><button id="k7DeletePlan">${k7h('Löschen')}</button></div>`;
    for (const row of k7BlueprintPreview(plan,state.activeBasePlanet)) html += `<div class="k7-item"><strong>${escapeHtml(k7View(row.def).name)}</strong> ${row.current} → ${row.target}${row.queued?' · '+row.queued+' '+k7h('Bereits eingeplant'):''}<div class="k7-muted">${row.remaining?costHtml(row.cost):k7h('Erreicht')}${row.specialItem&&row.remaining?' · '+row.remaining+' '+escapeHtml(k7View(RARE_ITEMS.find(item=>item.key===row.specialItem)||{name:row.specialItem}).name)+' ('+row.specialAvailable+'/'+row.remaining+')':''}</div>
      ${!row.unlocked?`<div class="k7-warn">${k7h('Voraussetzungen fehlen')}: ${row.unsupported?k7h('Verteidigungsbauwerke gehören nicht zu Ausbauvorlagen.')+' · ':''}${row.moonBlocked?k7h('Nur auf einem eigenen Mond')+' · ':''}${(row.def.requires||[]).map(r=>{const v=techVoraussetzung(r);return escapeHtml(k7View(RESEARCH_DEFS.find(d=>d.key===v.key)||{name:v.key}).name)+' '+v.level;}).join(', ')}</div>`:''}
      ${row.remaining?`<button data-k7-plan-step="${row.def.key}"${!row.unlocked?' disabled':''}>${k7h('Nächste Stufe einreihen')}</button>`:''}</div>`;
  } else html += `<p class="k7-muted">${k7h('Noch kein Bauplan gespeichert.')}</p>`;
  html += '</details>'; setBoxHtml(box,'k7Blueprints',html);
  box.querySelector('#k7SavePlan').onclick = () => k7SaveBlueprint(box.querySelector('#k7PlanName').value);
  const select = box.querySelector('#k7PlanSelect');
    if (select) select.onchange = e => {k7BlueprintSelection=e.target.value;select.blur();renderK7Blueprints();};
  const remove = box.querySelector('#k7DeletePlan');
  if (remove) remove.onclick = () => {k7PersonalGoals().blueprints=k7PersonalGoals().blueprints.filter(p=>!p||p.id!==plan.id);save();renderK7Blueprints();};
  box.querySelectorAll('[data-k7-plan-step]').forEach(btn=>btn.onclick=()=>{k7QueueBlueprintStep(plan.id,btn.dataset.k7PlanStep,state.activeBasePlanet);renderK7Blueprints();});
}
// A dry run through the existing refinery engine includes its actual input consumption.
function renderK7Bottleneck(boxId){return k7RenderPlanningBottleneck(boxId);}
function k7AvailableTrophies() { return ACHIEVEMENTS.filter(a=>!!state.achievements[a.key]); }
function k7ProfileTrophies(){
  const available=k7AvailableTrophies(),list=k7PersonalGoals().trophies||[];
  return `<div class="k7-grid" aria-label="${k7h('Trophäenhalle')}">${[0,1,2].map(slot=>{const trophy=available.find(a=>a.key===list[slot]);return `<div class="k7-item">${trophy?`<i class="ti ${escapeHtml(trophy.icon)}" aria-hidden="true"></i> <strong>${escapeHtml(k7View(trophy).name)}</strong><p class="k7-muted">${escapeHtml(k7View(trophy).desc)}</p>`:`<span class="k7-muted">${k7h('Leerer Ausstellungsplatz')}</span>`}</div>`;}).join('')}</div>`;
}
function k7SetTrophy(slot,key) {
  if(!Number.isInteger(slot)||slot<0||slot>2||key&&!k7AvailableTrophies().some(a=>a.key===key))return false;
  const list=Array.isArray(k7PersonalGoals().trophies)?k7PersonalGoals().trophies.slice(0,3):['','',''];
  if(key)for(let i=0;i<3;i++)if(i!==slot&&list[i]===key)list[i]='';
  list[slot]=key;k7PersonalGoals().trophies=list;lastCmdProfileSig=null;save();renderCommanderProfile();return true;
}
function renderK7Trophies() {
  const box=document.getElementById('k7Trophies');if(!box||isTypingIn('k7Trophies'))return;
  const available=k7AvailableTrophies(),list=k7PersonalGoals().trophies||[];
  const html=`<details class="k7-ideas" data-keep-open="k7trophies"${detailsOpenAttr('k7trophies')}><summary><i class="ti ti-award" aria-hidden="true"></i> ${k7h('Trophäenhalle')}</summary><p class="k7-muted">${k7h('Drei Plätze für bereits freigeschaltete Erfolge. Die Ausstellung verleiht keine Boni.')}</p><div class="k7-grid">${[0,1,2].map(slot=>{const picked=available.find(a=>a.key===list[slot]);return `<div class="k7-item"><label for="k7Trophy${slot}">#${slot+1}</label><select id="k7Trophy${slot}" data-k7-trophy="${slot}"><option value="">${k7h('Leerer Ausstellungsplatz')}</option>${available.map(a=>`<option value="${a.key}"${picked===a?' selected':''}>${escapeHtml(k7View(a).name)}</option>`).join('')}</select><p class="k7-muted">${picked?escapeHtml(k7View(picked).desc):''}</p></div>`;}).join('')}</div></details>`;
  setBoxHtml(box,'k7Trophies',html);box.querySelectorAll('[data-k7-trophy]').forEach(select=>select.onchange=()=>{k7SetTrophy(Number(select.dataset.k7Trophy),select.value);select.blur();renderK7Trophies();});
}
function renderK7Ideas() {
  if(activeTab==='karte')renderK7MapTasks();
  if(['expedition','sammlung','allianz'].includes(activeTab)){k7RefreshProgress();renderK7ServerIdeas();}
  if(activeTab==='basis'){renderK7Bottleneck('k7BottleneckBasis');renderK7Blueprints();renderK7FeedbackToggle();}
  if(activeTab==='forschung')renderK7Bottleneck();
  if(activeTab==='sammlung'){renderK7LootCompass();renderK7Archive();}
  if(activeTab==='galaxie')renderK7Trophies();
}
let k7ServerProgress=null,k7ServerBusy=false,k7ServerLastRead=0,k7ServerNotice='',k7ServerUnavailable=false;
async function k7RefreshProgress(force=false){
  if(!useBackend()||k7ServerUnavailable||k7ServerBusy||!force&&Date.now()-k7ServerLastRead<15000)return;
  k7ServerLastRead=Date.now();
  try{
    const response=await backendFetch('/k7/progress');
    if(response.status===404){k7ServerUnavailable=true;renderK7ServerIdeas();return;}
    if(!response.ok)throw new Error();k7ServerProgress=await response.json();renderK7ServerIdeas();k7RenderReturnEncounters();
  }catch(_){k7ServerNotice=k7t('Fortschritt konnte nicht geladen werden. Bitte später erneut versuchen.');}
}
async function k7ServerAction(path,body={},paid=false){
  if(k7ServerBusy||!useBackend())return false;k7ServerBusy=true;k7ServerNotice='';renderK7ServerIdeas();
  try{
    if(paid&&!await spielstandVorAnfrageSichern('Allianzoperation'))return false;
    const response=await backendFetch('/k7/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||k7t('Aktion nicht verfügbar.'));
    if(result.doc)allianceRaidCache=result.doc;
    if(paid&&!result.duplicate){
      for(const [key,amount]of Object.entries(result.cost||{}))if(Number.isFinite(amount)&&amount>0)state.resources[key]=Math.max(0,(state.resources[key]||0)-amount);
      if(Number.isFinite(result.saveVersion))gameSaveVersion=Math.max(gameSaveVersion||0,result.saveVersion);
      await save({nurSpielstand:true});
    }
    if(result.event){
      if(!k7ServerProgress)k7ServerProgress={};const old=k7ServerProgress.encounters||[];
      k7ServerProgress.encounters=[result.event,...old.filter(e=>e.id!==result.event.id)];
    }
    if(result.story){if(!k7ServerProgress)k7ServerProgress={};k7ServerProgress.story=result.story;}
    if(result.pity){if(!k7ServerProgress)k7ServerProgress={};k7ServerProgress.pity=result.pity;}
    if(path.endsWith('/claim'))await claimPendingRewards();
    k7ServerNotice=k7t('Gespeichert.');return true;
  }catch(error){k7ServerNotice=k7t(error.message||'Aktion nicht verfügbar.');return false;}
  finally{k7ServerBusy=false;k7ServerLastRead=0;renderK7ServerIdeas();renderAllianceRaidBox();}
}
async function k7RegisterExpedition(mission){
  // The ordinary expedition is already launched; this optional event must never block its return.
  if(!useBackend()||!mission||k7ServerUnavailable)return;
  if(!await spielstandVorAnfrageSichern('Expeditionsentscheidung',true))return;
  await k7ServerAction('expedition/register',{missionId:mission.id});
}
function k7ServerBox(id,parent){let box=document.getElementById(id);if(!box){const host=document.getElementById(parent);if(!host)return null;box=document.createElement('div');box.id=id;host.prepend(box);}return box;}
function k7ActionButton(path,text,body={},disabled=false){return `<button data-k7-action="${path}" data-k7-body="${escapeHtml(JSON.stringify(body))}"${disabled||k7ServerBusy?' disabled':''}>${k7h(text)}</button>`;}
function k7BindServerActions(box){
  if(!box)return;
  box.querySelectorAll('[data-k7-action]').forEach(button=>button.onclick=()=>{
    let body;try{body=JSON.parse(button.dataset.k7Body);}catch(_){return;}
    k7ServerAction(button.dataset.k7Action,body,button.dataset.k7Action==='operation/contribute');
  });
}
function renderK7ServerIdeas(){
  const notice=`<p class="k7-muted" role="status">${escapeHtml(k7ServerNotice)}</p>`;
  const unavailable=!useBackend()||k7ServerUnavailable;
  if(activeTab==='expedition'){
    const box=k7ServerBox('k7Story','tab-expedition');if(!box||isTypingIn('k7Story'))return;
    const s=k7ServerProgress&&k7ServerProgress.story||{stage:0},stage=s.stage||0;
    const chapters=[['Signal untersuchen','Ein abgebrochenes Logbuch nennt ein Forschungsschiff, dessen letzte Messung nie ankam. Starte die Kampagne und sende anschließend eine Expedition. Berge bei ihrer Rückkehr das Wrack oder untersuche es.'],['Daten bergen','Das Signal ist gesichert. Rekonstruiere die geborgenen Koordinaten, bevor du dich der Gefahr stellst.'],['Gefahr überwinden','Ein fremdes Signal stört die Rekonstruktion. Beteilige dich an einem serverbestätigten PvE-Sieg: Festung, Alien-Nest, Wrackkonvoi oder finaler Allianz-Raid. Auch ein bestätigter Weltboss-Treffer genügt.'],['Entscheidung treffen','Das Schiff hat keine Besatzung mehr, aber seine Messung ist erhalten. Bewahre die Daten in Quarantäne oder übermittle sie an die Randkolonien. Beide Wege schließen die Geschichte ab.'],['Abschluss erleben','Deine Entscheidung ist gespeichert. Die einmalige Abschlussgabe beträgt 100 Kredite.'],['Kampagne abgeschlossen',s.choice==='quarantine'?'Die Daten ruhen im versiegelten Archiv. Du hast die Erinnerung bewahrt und Zeit gewonnen, ihre Bedeutung zu verstehen.':'Die Randkolonien empfangen die Messung. Aus einem verstummten Schiff wird ein gemeinsamer Beginn.']];
    let html=`<details class="k7-ideas" data-keep-open="k7story"${detailsOpenAttr('k7story')}><summary><i class="ti ti-rocket" aria-hidden="true"></i> ${k7h('Das verstummte Forschungsschiff')} · ${Math.min(stage,5)}/5</summary><h4>${k7h(chapters[stage][0])}</h4><p>${k7h(chapters[stage][1])}</p>`;
    if(unavailable)html+=`<p class="k7-warn">${k7h('Diese Funktion benötigt den passenden Kepler-Server und eine Anmeldung.')}</p>`;
    else if(!s.startedAt)html+=k7ActionButton('story/start','Kampagne beginnen');
    else if(stage===1)html+=k7ActionButton('story/recover','Daten rekonstruieren');
    else if(stage===3)html+=k7ActionButton('story/choice','In Quarantäne bewahren',{choice:'quarantine'})+k7ActionButton('story/choice','An die Randkolonien übermitteln',{choice:'transmit'});
    else if(stage===4)html+=k7ActionButton('story/claim','Abschlussgabe abholen');
    html+=`<h4>${k7h('Wrack-Entscheidungen')}</h4><p class="k7-muted">${k7h('Zusätzliche Bergung neben der normalen Expedition: sicher 120 Erz und 60 Kristalle; untersuchen mit 80% Chance auf 500 Erz und 250 Kristalle, sonst keine zusätzliche Beute; umkehren ohne zusätzliche Beute. Die Entscheidung verursacht keine zusätzlichen Schiffsverluste. Ohne Antwort gilt sichere Bergung bei der Rückkehr. Lagergrenzen gelten.')}</p>`;
    const events=k7ServerProgress&&k7ServerProgress.encounters||[];
    for(const e of events.slice(0,8)){
      html+=`<article class="k7-item"><strong>${k7h('Geborgenes Wrack')}</strong> · ${escapeHtml(e.missionId)}<div class="k7-muted">${e.status==='resolved'?k7h('Aufgelöst'):fmtDuration(Math.max(0,e.readyAt-Date.now())/1000)}</div>`;
      if(e.status!=='resolved'&&!e.decidedAt)html+=k7ActionButton('expedition/choose','Sicher bergen',{id:e.id,choice:'salvage'})+k7ActionButton('expedition/choose','Gründlich untersuchen',{id:e.id,choice:'inspect'})+k7ActionButton('expedition/choose','Umkehren',{id:e.id,choice:'return'});
      else html+=`<p>${k7h(({salvage:'Sicher bergen',inspect:'Gründlich untersuchen',return:'Umkehren'})[e.choice]||'Sicher bergen')}${e.result?' · '+costHtml(e.result.resources||{}):''}${e.result&&e.result.automatic?' · '+k7h('Automatische sichere Bergung'):''}</p>`;
      html+='</article>';
    }
    const known=new Set(events.map(e=>String(e.missionId)));
    const missions=[state.fleet,...Object.values(state.colonies||{}).map(c=>c.fleet)].filter(Boolean).flatMap(f=>f.missions||[]).filter(m=>m.type==='expedition'&&m.endTime>Date.now()&&!known.has(String(m.id)));
    if(!unavailable)for(const m of missions.slice(0,8))html+=k7ActionButton('expedition/register','Wrack-Ereignis vormerken',{missionId:m.id});
    if(!events.length)html+=`<p class="k7-muted">${k7h('Noch kein Wrack-Ereignis registriert.')}</p>`;
    html+=notice+'</details>';setBoxHtml(box,'k7Story',html);k7BindServerActions(box);
    // Manual retry also flushes the actual active mission before the server checks it.
    box.querySelectorAll('[data-k7-action="expedition/register"]').forEach(b=>b.onclick=()=>k7RegisterExpedition(missions.find(m=>String(m.id)===String(JSON.parse(b.dataset.k7Body).missionId))));
  }
  if(activeTab==='sammlung'){
    const box=k7ServerBox('k7Pity','tab-sammlung');if(!box||isTypingIn('k7Pity'))return;
    const p=k7ServerProgress&&k7ServerProgress.pity||{},parts=bosssetTeile('panzerhuelle');
    let html=`<details class="k7-ideas" data-keep-open="k7pity"${detailsOpenAttr('k7pity')}><summary><i class="ti ti-target" aria-hidden="true"></i> ${k7h('Panzerhüllen-Pechschutz')} · ${p.victories||0}/${p.required||12}</summary><p class="k7-muted">${k7h('Zwölf bestätigte finale Panzerhüllen-Raid-Siege ergeben ein gewähltes seltenes Set-Teil. Jede finale Welle zählt einmal; andere Gegner zählen nicht. Zufallsfunde bleiben erhalten. Danach beginnt der Zähler erneut.')}</p>`;
    if(unavailable)html+=`<p class="k7-warn">${k7h('Diese Funktion benötigt den passenden Kepler-Server und eine Anmeldung.')}</p>`;
    else{html+=`<label for="k7PityPart">${k7h('Wunschstück')}</label><select id="k7PityPart"><option value="">${k7h('Bitte auswählen')}</option>${parts.map(d=>`<option value="${d.key}"${d.key===p.part?' selected':''}>${escapeHtml(k7View(d).name)}</option>`).join('')}</select>`+k7ActionButton('pity/claim','Wunschstück abholen',{},!p.part||(p.victories||0)<(p.required||12));}
    html+=notice+'</details>';setBoxHtml(box,'k7Pity',html);k7BindServerActions(box);
    const select=box.querySelector('select');if(select)select.onchange=()=>{const part=select.value;select.blur();if(part)k7ServerAction('pity/target',{part});};
  }
  if(activeTab==='allianz'){
    const host=document.getElementById('allianceRaidBox');if(!host)return;let box=document.getElementById('k7Operation');if(!box){box=document.createElement('div');box.id='k7Operation';host.after(box);}if(isTypingIn('k7Operation'))return;
    const tag=myAllianceTag(),doc=allianceRaidCache,op=doc&&doc.operation;
    if(!tag||!doc||unavailable){box.innerHTML='';return;}
    let html=`<details class="k7-ideas" data-keep-open="k7op"${detailsOpenAttr('k7op')}><summary><i class="ti ti-users" aria-hidden="true"></i> ${k7h('Allianzoperation')}</summary><p class="k7-muted">${k7h('Aufklärung → Versorgung → Angriff. Aufklärungsdaten kosten 100 Energie und benötigen einen stationierten Spionagekreuzer oder Forscher. Versorgung kostet 250 Erz und 100 Kristalle. Aktive Beiträge senken die Gegenwehr bzw. die Verlustquote um je 10%. Nach dem finalen Sieg erhalten weiterhin zugehörige Beitragende einmalig 40 Kredite, auch offline.')}</p>`;
    if(!op&&amIAllianceMusterLeader())html+=k7ActionButton('operation/start','Operation beginnen',{tag},!['idle','gathering'].includes(doc.phase));
    if(op){html+=`<p>${k7h('Phase')}: ${k7h(({scout:'Aufklärung',supply:'Versorgung',attack:'Angriff',completed:'Abgeschlossen',cancelled:'Abgebrochen'})[op.phase]||op.phase)}</p>`;
      if(['scout','supply'].includes(op.phase))html+=k7ActionButton('operation/contribute',op.phase==='scout'?'Aufklärungsdaten liefern':'Versorgung liefern',{tag,role:op.phase},!['idle','gathering'].includes(doc.phase));
      if(op.phase==='attack')html+=`<p class="k7-muted">${k7h('Flotten schließen sich über den vorhandenen Raid-Beitritt an. Normale Kampfverluste und Raid-Regeln gelten.')}</p>`;
      html+=`<p class="k7-muted">${k7h('Ein Austritt entfernt die Wirkung des Beitrags und den Anspruch auf die Teilnehmergabe. Ein Abbruch vor dem Abflug beendet die Zusatzoperation ohne Erstattung oder Teilnehmergabe; der normale Raid bleibt bestehen.')}</p>`;
      if(!op.completedAt&&!op.cancelledAt&&amIAllianceMusterLeader())html+=k7ActionButton('operation/cancel','Operation abbrechen',{tag},!['idle','gathering'].includes(doc.phase));
    }
    if(doc.bossKey==='panzerhuelle'){
      html+=`<h4>${k7h('Schildzyklus')}</h4><p class="k7-muted">${k7h('Optionale Bossvariante: Ab 50% Hülle gilt ×0,65 Schaden, mit Bombern ×0,90. Unter 50% Hülle gilt ×1,20 Schaden und ×0,80 Gegenwehr. Die vorhandene Trefferschwäche gilt zusätzlich. Die Phase wird zu Beginn jeder Welle festgelegt.')}</p>`;
      if(doc.variant==='shield-cycle')html+=`<strong>${k7h('Schildzyklus aktiv')}</strong>`;
      else if(amIAllianceMusterLeader())html+=k7ActionButton('raid/variant','Schildzyklus aktivieren',{tag},doc.phase!=='gathering'||doc.waveNumber!==1);
    }
    html+=notice+'</details>';setBoxHtml(box,'k7Operation',html);k7BindServerActions(box);
  }
}
function k7GrantTargetedSet(bs){
  const def=bs&&bosssetTeile(bs.bossKey).find(d=>d.key===bs.defKey);if(!def||bs.seltenheit!=='selten')return null;
  const key=def.key+':selten:1:'+mitWertWurf(rollModuleSubs('selten',false,def.effect));state.modules[key]=(state.modules[key]||0)+1;return k7View(def).name;
}
function k7ReceiveReward(reward){
  if(!['expedition-choice','set-pity','story-campaign','alliance-operation'].includes(reward.type))return false;
  const resources={};for(const key of ['erz','kristalle'])if(Number.isFinite((reward.resources||{})[key])&&reward.resources[key]>0)resources[key]=reward.resources[key];
  if(Object.keys(resources).length)gainResources(resources);
  const credits=Math.max(0,Math.floor(Number(reward.credits)||0));if(credits)state.credits=(state.credits||0)+credits;
  const part=reward.type==='set-pity'?k7GrantTargetedSet(reward.bossset):null;
  log(k7t('Belohnung erhalten')+': '+(part||credits+' '+k7t('Kredite')+(Object.keys(resources).length?' · '+Object.entries(resources).map(([k,n])=>fmt(n)+' '+k7t(resDefFor(k).label)).join(', '):'')),'ti-trophy','wichtig');save();return true;
}
function k7BossPhase(doc,composition){
  if(!doc||doc.variant!=='shield-cycle'||doc.bossKey!=='panzerhuelle')return null;
  const shield=(doc.hp||0)>=(doc.maxHp||1)*0.5;
  const pierces=(composition&&composition.bomber||0)>0;
  return {key:shield?'shield':'vulnerable',damage:shield?(pierces?0.9:0.65):1.2,counter:shield?1:0.8,pierces:shield&&pierces};
}
function k7RaidPreview(doc){
  if(!doc||!doc.dispatch)return '';
  const hp=doc.status&&doc.status.brand?Math.max(0,doc.hp-Math.round(doc.hp*0.06)):doc.hp;
  const phase=k7BossPhase({...doc,hp},doc.dispatch.totalComposition);
  if(!phase)return '';
  const boss=allianceRaidBossVon(doc),comp=doc.dispatch.totalComposition||{};
  const weakness=doc.status&&doc.status.schock||!boss.schwaeche||(comp[boss.schwaeche]||0)>0;
  const damage=Math.min(hp,Math.round(doc.dispatch.totalPower*(weakness?1:boss.ohneMult)*phase.damage));
  return `<p class="k7-muted">${k7h(phase.key==='shield'?'Schildphase':'Offene Hülle')} · ${k7h('Wellen-Schadensvorschau')}: ${fmt(damage)} · ${k7h('Gegenwehr-Faktor')}: ×${phase.counter}${phase.pierces?' · '+k7h('Bomber durchdringen den Schild'):''}</p>`;
}
function k7LootTargets(){
  const visible=new Map(visibleSystems().map(s=>[s.id,s])),rows=[];
  for(const [system,field]of Object.entries(state.asteroidFeld||{}))if(visible.has(system)&&field&&field.festung&&(field.festung.kern||0)>0)rows.push({kind:'loot',id:'festung:'+system,system,name:k7t('Asteroidenfestung')+' · '+k7View(visible.get(system)).name});
  for(const [kind,list,label]of [['nest',galaxyCache.alienNester,'Alien-Nest'],['konvoi',galaxyCache.wrackKonvois,'Wrackkonvoi']])for(const target of list||[])if(target&&visible.has(target.sys)&&(target.lp||0)>0&&(!target.expiresAt||target.expiresAt>Date.now()))rows.push({kind:'loot',id:kind+':'+target.id,system:target.sys,name:k7t(label)+' · '+k7View(visible.get(target.sys)).name});
  return rows;
}
function k7LootBookmarks(){
  const list=k7PersonalGoals().lootBookmarks,seen=new Set();if(!Array.isArray(list))return [];
  return list.filter(r=>r&&typeof r.id==='string'&&r.id.length<=120&&!seen.has(r.id)&&seen.add(r.id)).map(r=>({id:r.id,note:typeof r.note==='string'?r.note.slice(0,240):''})).slice(0,24);
}
function k7LootFavoriteRows(){return k7LootBookmarks().map(row=>{const t=k7LootTargets().find(t=>t.id===row.id);return {...row,kind:'loot',name:t?t.name:k7t('Nicht mehr verfügbar'),available:!!t};});}
function k7SaveLootFavorite(id,note){
  if(typeof note!=='string'||!k7LootTargets().some(t=>t.id===id))return false;
  const rows=k7LootBookmarks(),at=rows.findIndex(r=>r.id===id);if(at<0&&rows.length>=24)return false;
  const value={id,note:note.trim().slice(0,240)};if(at<0)rows.push(value);else rows[at]=value;
  k7PersonalGoals().lootBookmarks=rows;save();return true;
}
const K7_ARCHIVE = [
  {system:'zenith',title:'Die unterbrochene Messung',text:'Eine Zeile im geborgenen Logbuch endet mitten im Satz. Die Besatzung hatte die Anomalie vermessen, dann blieb nur Stille. Dein Archiv bewahrt die letzte Beobachtung, ohne ihr eine Erklärung aufzuzwingen.'},
  {system:'tiefsee',title:'Licht unter dem Nebel',text:'Im Tiefsee-Nebel verschwinden die Konturen im Streulicht. Ein altes Navigationsprotokoll beschreibt dieselbe Ruhe. Auf dem Rand der Karte steht: Nicht jede Leere ist unbewohnt.'},
  {system:'sys_wispern_nebel',title:'Die wartende Bake',text:'Die Bake im Wispern-Nebel wiederholt einen Gruß, dessen Empfänger längst unbekannt ist. Du hast das Signal dokumentiert. Vielleicht war das Warten selbst ihre letzte Aufgabe.'},
  {system:'sys_obsidian_guertel',title:'Spuren im Gestein',text:'Die Gesteine des Obsidian-Gürtels bewahren feine Linien wie ein verlassener Lageplan. Dein Erkundungsbericht enthält eine Skizze. Ob es Werkspuren oder Zufall sind, bleibt offen.'},
  {system:'sys_pandora_saum',title:'Am Rand der alten Karte',text:'Am Pandora-Saum endet die Beschriftung einer alten Sternenkarte. Dahinter steht nur eine handschriftliche Frage. Mit deiner Erkundung beginnt eine neue Seite im Archiv.'}
];
k7RegisterDefinitions(K7_ARCHIVE);
function k7ArchiveUnlocked(entry) {
  if((state.discoveredSystems||{})[entry.system])return true;
  return PLANETS.some(p=>p.system===entry.system&&!!(state.discovered||{})[p.id]);
}
function k7UpdateArchive() {
  const goals=k7PersonalGoals();if(!goals.archive||typeof goals.archive!=='object'||Array.isArray(goals.archive))goals.archive={};
  let changed=false;
  for(const entry of K7_ARCHIVE)if(!goals.archive[entry.system]&&k7ArchiveUnlocked(entry)){goals.archive[entry.system]=true;changed=true;}
  const rep=factionRepOf('kartell');
  for(const threshold of [1,100,300])if(rep>=threshold&&!goals.archive['kartell:'+threshold]){goals.archive['kartell:'+threshold]=true;changed=true;}
  return changed;
}
function renderK7Archive() {
  const box=document.getElementById('k7Archive');if(!box)return;
  if(k7UpdateArchive())save();
  const unlocked=k7PersonalGoals().archive;
  let html=`<details class="k7-ideas" data-keep-open="k7archive"${detailsOpenAttr('k7archive')}><summary><i class="ti ti-list-details" aria-hidden="true"></i> ${k7h('Entdeckerarchiv')}</summary><p class="k7-muted">${k7h('Archivtexte öffnen sich erst nach einer tatsächlichen Entdeckung. Einmal geöffnete Geschichten bleiben erhalten.')}</p>`;
  for(const entry of K7_ARCHIVE){
    const open=!!unlocked[entry.system],system=visibleSystems().find(s=>s.id===entry.system);
    const origin=STAR_SYSTEMS.find(s=>s.id===entry.system);
    html+=`<article class="k7-item"><strong>${open?escapeHtml(k7View(entry).title):k7h('Noch nicht erkundet')}</strong>${open?`<p class="k7-muted">${k7h('Herkunft')}: ${escapeHtml(k7t(origin.name))} · ${k7h('Fundbedingung: System oder einen seiner Planeten erkundet.')}</p><p class="k7-muted">${escapeHtml(k7View(entry).text)}</p>${system?`<button data-k7-archive-map="${entry.system}">${k7h('Kartenziel öffnen')}</button>`:''}`:''}</article>`;
  }
  const chapters=[
    [1,'Das erste Geschäft','Das Aschen-Kartell nennt Handel eine Sprache. Dein erster guter Kontakt öffnet die Tür zu seinem Archiv: Verträge sind dort Erinnerungen, keine Freundschaften.'],
    [100,'Die Namen im Register','Mit wachsendem Ruf darfst du ältere Register lesen. Neben jedem Geschäft steht ein Name, manchmal gestrichen. Die Händler erinnern sich an ihre Partner länger als an die Preise.'],
    [300,'Was nicht verkauft wird','Im inneren Dossier steht eine Regel: Nicht jede Information ist eine Ware. Das Kartell bewahrt auch Geschichten, die es nicht preisgibt. Dein Ruf hat dir Vertrauen verschafft, keinen Anspruch auf alles.']
  ];
  html+=`<h4>${escapeHtml(k7t(FACTION_DIPLOMACY.kartell.name))}</h4>`;
  for(const [rep,title,text]of chapters)html+=`<article class="k7-item">${unlocked['kartell:'+rep]?`<strong>${escapeHtml(k7t(title))}</strong><p class="k7-muted">${k7h('Herkunft')}: ${escapeHtml(k7t(FACTION_DIPLOMACY.kartell.name))} · ${k7h('Fundbedingung')}: ${k7h('Ruf')} ≥ ${rep}</p><p class="k7-muted">${escapeHtml(k7t(text))}</p>`:`<span class="k7-muted">${k7h('Ruf')} ${rep}</span>`}</article>`;
  html+='</details>';setBoxHtml(box,'k7Archive',html);
  box.querySelectorAll('[data-k7-archive-map]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.k7ArchiveMap;if(!visibleSystems().some(s=>s.id===id))return;switchTab('karte');galaxyOeffne(id);});
}
let k7FeedbackTimer=null;
function k7ColonyFeedback(kind,name) {
  if(!bootDataReady||k7PersonalGoals().feedback===false)return;
  const box=document.getElementById('k7ActivityFeedback');if(!box)return;
  box.textContent=k7t(kind==='return'?'Flotte zurückgekehrt':'Bauauftrag fertiggestellt')+(name?' · '+name:'');
  box.hidden=false;box.classList.remove('k7-feedback-pulse');void box.offsetWidth;
  box.classList.add('k7-feedback-pulse');
  if(k7FeedbackTimer)clearTimeout(k7FeedbackTimer);
  k7FeedbackTimer=setTimeout(()=>{box.hidden=true;box.classList.remove('k7-feedback-pulse');},4500);
}
function renderK7FeedbackToggle() {
  const box=document.getElementById('k7FeedbackToggle');if(!box)return;
  const html=`<label class="k7-muted"><input type="checkbox" id="k7FeedbackEnabled"${k7PersonalGoals().feedback===false?'':' checked'}> ${k7h('Rückmeldung bei Bauabschluss und Flottenrückkehr')}</label>`;
  setBoxHtml(box,'k7FeedbackToggle',html);box.querySelector('input').onchange=e=>{k7PersonalGoals().feedback=e.target.checked;if(!e.target.checked)document.getElementById('k7ActivityFeedback').hidden=true;save();};
}
function k7OfflineLootSnapshot() {
  return {inventory:{...state.inventory},modules:{...state.modules},shipModules:{...state.shipModules}};
}
function k7OfflineLootDelta(before) {
  const rows=[];
  for(const kind of ['inventory','modules','shipModules'])for(const [key,count]of Object.entries(state[kind]||{})){
    const diff=count-((before[kind]||{})[key]||0);if(!(diff>0))continue;
    const def=kind==='inventory'?ITEM_DEFS.find(d=>d.key===key):(kind==='modules'?MODULE_DEFS:SHIP_MODULE_DEFS).find(d=>d.key===key.split(':')[0]);
    rows.push({kind,key,count:diff,name:def?def.name:key});
  }
  return rows;
}
function k7ReturnExtras(summary) {
  if(!summary)return '';
  let html=(summary.loot||[]).map(row=>`<div class="card-row"><span>${k7h('Neue Beute')}: ${escapeHtml(k7t(row.name))}</span><span>+${fmt(row.count)}</span></div>`).join('');
  const full=[...RES_DEFS,...TIER2_DEFS,{key:'protomaterie',label:'Protomaterie'}].filter(d=>k7ResourceCapacity(d.key)>0&&(state.resources[d.key]||0)>=k7ResourceCapacity(d.key));
  if(full.length)html+=`<p class="k7-warn">${k7h('Lager voll')}: ${full.map(d=>escapeHtml(k7t(d.label))).join(', ')}</p>`;
  return html+'<div id="k7ReturnEncounters">'+k7ReturnEncounters(summary)+'</div>';
}
function k7EncounterReportHtml(result){
  const label=({salvage:'Sicher bergen',inspect:'Gründlich untersuchen',return:'Umkehren'})[result.choice]||'Sicher bergen';
  const resources=Object.entries(result.resources||{}).filter(([,n])=>Number.isFinite(n)&&n>0);
  return `<strong>${k7h(label)}</strong>${result.automatic?' · '+k7h('Automatische sichere Bergung'):''}<p>${resources.length?k7h('Zusätzlicher Fund')+': '+resources.map(([key,n])=>fmt(n)+' '+escapeHtml(resLabel(key))).join(', '):k7h('Keine zusätzliche Beute')}. ${k7h('Lagergrenzen gelten.')}</p>`;
}
function k7ReturnEncounters(summary){
  if(!summary||!Number.isFinite(summary.since))return '';
  return (k7ServerProgress&&k7ServerProgress.encounters||[]).filter(e=>e.status==='resolved'&&e.resolvedAt>=summary.since&&e.result).map(e=>`<article class="k7-item"><i class="ti ti-rocket" aria-hidden="true"></i> ${k7h('Wrack-Entscheidung')} · ${k7EncounterReportHtml({...e.result,choice:e.choice})}</article>`).join('');
}
function k7RenderReturnEncounters(){const box=document.getElementById('k7ReturnEncounters');if(box)box.innerHTML=k7ReturnEncounters(lastOfflineSummary);}
function k7ResourceCapacity(key) {
  if(key==='credits')return Infinity;
  if(key==='protomaterie')return protomaterieCap();
  const def=TIER2_DEFS.find(d=>d.key===key);
  return def?Math.max(tier2StorageCap(def),def.storageBase):storageCap();
}
function k7ReturnActions() {
  const candidates=spielBedarfGecacht().filter(b=>b.art==='aktion').concat([
    {tab:'basis',text:k7t('Kolonie und Bau-Wunschliste prüfen')},
    {tab:'forschung',text:k7t('Nächstes Forschungsziel planen')},
    {tab:'karte',text:k7t('Erkundungen und Kartenziele prüfen')}
  ]);
  const tabs=new Set(),rows=[];
  for(const row of candidates){
    if(tabs.has(row.tab)||!document.querySelector('.tab-btn[data-tab="'+row.tab+'"]'))continue;
    tabs.add(row.tab);rows.push(row);if(rows.length===3)break;
  }
  return rows;
}
