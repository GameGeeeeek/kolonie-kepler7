// Persistent planning only. Valuable progression stays on the server, never in these fields.
function k7PersonalGoals() {
  if (!state.personalGoals || typeof state.personalGoals !== 'object' || Array.isArray(state.personalGoals)) state.personalGoals = {};
  return state.personalGoals;
}
function k7WishSet() {
  const wanted = k7PersonalGoals().wishSet;
  return MODULE_SET_DEFS.find(s => s.bossKey && s.key === wanted) || MODULE_SET_DEFS.find(s => s.bossKey);
}
function k7SetOwnership(set) {
  return set.req.map(key => ({def: MODULE_DEFS.find(d => d.key === key), owned: besitztModulTyp(state, key)})).filter(row => row.def);
}
function k7SelectWish(key) {
  if (!MODULE_SET_DEFS.some(s => s.bossKey && s.key === key)) return false;
  k7PersonalGoals().wishSet = key; save(); renderK7LootCompass(); return true;
}
function renderK7LootCompass() {
  const box = document.getElementById('k7LootCompass'); if (!box) return;
  const selected = k7WishSet(); if (!selected) return;
  const wishes = Array.isArray(k7PersonalGoals().wishParts) ? k7PersonalGoals().wishParts : [];
  const rows = k7SetOwnership(selected);
  let html = `<details class="k7-ideas" data-keep-open="k7loot"${detailsOpenAttr('k7loot')}><summary><i class="ti ti-target" aria-hidden="true"></i> ${k7h('Beutekompass und Wunschliste')} (${rows.filter(r=>r.owned).length}/${rows.length})</summary>
    <div class="k7-row"><label for="k7WishSet">${k7h('Set auswählen')}</label><select id="k7WishSet">${MODULE_SET_DEFS.filter(s=>s.bossKey).map(s=>`<option value="${s.key}"${s.key===selected.key?' selected':''}>${escapeHtml(k7View(s).name)}</option>`).join('')}</select></div>
    <p class="k7-muted">${escapeHtml(k7View(selected).desc)}</p>`;
  for (const row of rows) {
    const d = row.def, source = modulFundort(d, MODULE_DEFS, 'standort'), marked = wishes.includes(d.key);
    html += `<div class="k7-item"><div class="k7-row"><i class="ti ${d.icon||'ti-target'}" aria-hidden="true"></i><strong>${escapeHtml(k7View(d).name)}</strong><span class="${row.owned?'k7-good':'k7-warn'}">${k7h(row.owned?'Vorhanden':'Fehlt')}</span><button data-k7-wish="${d.key}">${k7h(marked?'Wunsch entfernen':'Wunsch merken')}</button></div>
      <div class="k7-muted">${escapeHtml(k7View(d).desc.replace(/<[^>]+>/g,''))}<br>${source.anteil===null?'':(source.anteil*100).toFixed(1)+'% · '+k7h('Anteil im Set-Fundtopf, keine Chance je Kampf')}</div></div>`;
  }
  html += `<p class="k7-muted">${k7h('Weitere zulässige Quellen: Asteroidenfestungen, Alien-Nester und Weltboss. Der Server bestimmt Boss-Set und Seltenheit; dort ist ein bestimmtes Set nicht garantiert.')}</p>
    <div class="k7-row"><button data-k7-go="allianz:uebersicht">${k7h('Allianz-Raid')}</button><button data-k7-go="galaxie:kampf">${k7h('Weltboss')}</button><button data-k7-go="karte">${k7h('Sektorkarte')}</button></div>
    ${!state.player.allianceTag?'<p class="k7-warn">'+k7h('Allianzmitgliedschaft und eine laufende Raid-Welle erforderlich.')+'</p>':''}</details>`;
  setBoxHtml(box, 'k7LootCompass', html);
  box.querySelector('#k7WishSet').onchange = e => k7SelectWish(e.target.value);
  box.querySelectorAll('[data-k7-wish]').forEach(btn => btn.onclick = () => {
    const key = btn.dataset.k7Wish;
    if (!bosssetTeile(selected.bossKey).some(d=>d.key===key)) return;
    const old = Array.isArray(k7PersonalGoals().wishParts)?k7PersonalGoals().wishParts:[];
    k7PersonalGoals().wishParts = old.includes(key)?old.filter(k=>k!==key):old.concat(key).slice(0,20);
    save(); renderK7LootCompass();
  });
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
  const buildings = planet==='home'?state.buildings:(state.colonies[planet]||{}).buildings;
  if (!buildings || !plan || !Array.isArray(plan.steps)) return [];
  return plan.steps.map(step => {
    if(!step||typeof step!=='object')return null;
    const def = BUILDING_DEFS.find(d=>d.key===step.key && d.category!=='defense');
    if (!def || !Number.isInteger(step.level) || step.level<1 || step.level>(def.maxLevel||100)) return null;
    const current = buildings[def.key]||0;
    const queued = (state.buildQueue||[]).filter(q=>q.planet===planet && q.key===def.key).length
      + (state.constructionQueue||[]).filter(q=>q.planet===planet && q.key===def.key && q.kind==='building').reduce((sum,q)=>sum+(q.qty||1),0);
    const remaining = Math.max(0,step.level-current-queued);
    return {def, target:step.level, current, queued, remaining, unlocked:techUnlockedGeneric(def.requires), cost:costForRange(def,current+queued,remaining)};
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
    for (const row of k7BlueprintPreview(plan,state.activeBasePlanet)) html += `<div class="k7-item"><strong>${escapeHtml(k7View(row.def).name)}</strong> ${row.current} → ${row.target}${row.queued?' · '+row.queued+' '+k7h('Bereits eingeplant'):''}<div class="k7-muted">${row.remaining?costHtml(row.cost):k7h('Erreicht')}</div>
      ${!row.unlocked?`<div class="k7-warn">${k7h('Voraussetzungen fehlen')}: ${(row.def.requires||[]).map(r=>{const v=techVoraussetzung(r);return escapeHtml(k7View(RESEARCH_DEFS.find(d=>d.key===v.key)||{name:v.key}).name)+' '+v.level;}).join(', ')}</div>`:''}
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
function k7NetRates() {
  const gross = ratesPerSecond(), stock = {...state.resources};
  for (const [key,rate] of Object.entries(gross)) stock[key]=(stock[key]||0)+Math.max(0,rate);
  const before = {...stock};
  for (const def of TIER2_DEFS) tier2Step(def,stock,1);
  const rates = {};
  for (const key of new Set([...Object.keys(stock),...Object.keys(gross)])) rates[key]=(gross[key]||0)+(stock[key]||0)-(before[key]||0);
  return rates;
}
function k7ResearchBottleneck(key) {
  const def = RESEARCH_DEFS.find(d=>d.key===key); if (!def) return null;
  const level = (state.research[key]||0)+1, finished=level>def.maxLevel;
  const cost = finished?{}:researchCostFor(def,level), account=finished?'':baustelleSchluessel(key,level);
  const rest=finished?{}:baustelleRestKosten(cost,account), net=k7NetRates(), bank=account?baustelleStand(account):{};
  const target=baustelleZiel(), saving=target && target.schluessel===account;
  const rows=Object.entries(rest).map(([res,amount])=>{
    const have=costAmountAvailable(res), missing=Math.max(0,amount-have), cap=res==='credits'?Infinity:(TIER2_DEFS.find(d=>d.key===res)?tier2StorageCap(TIER2_DEFS.find(d=>d.key===res)):storageCap());
    const rate=net[res]||0, share=saving?baustelleAnteil():0;
    // A funded oversized target can eventually complete through the existing account.
    const oversized=amount>cap, accountRate=Math.max(0,(ratesPerSecond()[res]||0)*share);
    const effective=oversized&&share>0?accountRate:rate-baustelleAbzweigRate(res,rate);
    const blocked=missing>0 && (effective<=0 || oversized&&share<=0);
    return {res,amount,have,missing,cap,rate,effective,bank:bank[res]||0,blocked,oversized,eta:missing===0?0:blocked?null:missing/effective};
  });
  return {def,level,finished,unlocked:techUnlocked(def),rows,eta:rows.some(r=>r.eta===null)?null:Math.max(0,...rows.map(r=>r.eta))};
}
let k7ResearchTarget = '';
function renderK7Bottleneck() {
  const box=document.getElementById('k7Bottleneck');if(!box||isTypingIn('k7Bottleneck'))return;
  const defs=RESEARCH_DEFS.filter(d=>(state.research[d.key]||0)<d.maxLevel);
  const target=defs.find(d=>d.key===k7ResearchTarget)||defs[0];if(!target){box.innerHTML='';return;}
  k7ResearchTarget=target.key;const view=k7ResearchBottleneck(target.key);
  let html=`<details class="k7-ideas" data-keep-open="k7engpass"${detailsOpenAttr('k7engpass')}><summary><i class="ti ti-flask" aria-hidden="true"></i> ${k7h('Engpassanalyse')}</summary><div class="k7-row"><label for="k7ResearchTarget">${k7h('Forschungsziel')}</label><select id="k7ResearchTarget">${defs.map(d=>`<option value="${d.key}"${d.key===target.key?' selected':''}>${escapeHtml(k7View(d).name)}</option>`).join('')}</select></div>`;
  if(!view.unlocked)html+=`<p class="k7-warn">${k7h('Voraussetzungen fehlen')}: ${(target.requires||[]).map(req=>{const r=techVoraussetzung(req);return escapeHtml(k7View(RESEARCH_DEFS.find(d=>d.key===r.key)||{name:r.key}).name)+' '+r.level;}).join(', ')}</p>`;
  for(const row of view.rows)html+=`<div class="k7-item"><strong>${escapeHtml(k7t(resDefFor(row.res).label))}</strong><div class="k7-muted">${k7h('Restbedarf')}: ${fmt(row.missing)} · ${k7h('Nettozufluss')}: ${fmt(row.rate)}/s<br>${k7h('Lagergrenze')}: ${Number.isFinite(row.cap)?fmt(row.cap):'∞'} · ${k7h('Baustellen-Konto')}: ${fmt(row.bank)}</div>${row.blocked?`<div class="k7-warn">${k7h(row.res==='credits'?'Kredite haben keinen passiven Zufluss. Handel oder bestehende Aufträge nutzen.':row.oversized?'Lager ausbauen oder Forschungs-Konto nutzen':'Keine positive Produktion')}</div>`:''}</div>`;
  html+=`<p class="k7-muted">${view.eta===null?k7h('Keine garantierte Wartezeit; zuerst den Engpass beheben.'):view.eta===0?k7h('Bezahlbar'):k7h('Geschätzte Wartezeit bei unveränderten Bedingungen')+': '+fmtDuration(view.eta)}</p><p class="k7-muted">${k7h('Vorschau verändert weder Ressourcen noch Warteschlangen.')}</p></details>`;
  setBoxHtml(box,'k7Bottleneck',html);box.querySelector('#k7ResearchTarget').onchange=e=>{k7ResearchTarget=e.target.value;e.target.blur();renderK7Bottleneck();};
}
function k7AvailableTrophies() { return ACHIEVEMENTS.filter(a=>!!state.achievements[a.key]); }
function k7SetTrophy(slot,key) {
  if(!Number.isInteger(slot)||slot<0||slot>2||key&&!k7AvailableTrophies().some(a=>a.key===key))return false;
  const list=Array.isArray(k7PersonalGoals().trophies)?k7PersonalGoals().trophies.slice(0,3):['','',''];
  if(key)for(let i=0;i<3;i++)if(i!==slot&&list[i]===key)list[i]='';
  list[slot]=key;k7PersonalGoals().trophies=list;save();return true;
}
function renderK7Trophies() {
  const box=document.getElementById('k7Trophies');if(!box||isTypingIn('k7Trophies'))return;
  const available=k7AvailableTrophies(),list=k7PersonalGoals().trophies||[];
  const html=`<details class="k7-ideas" data-keep-open="k7trophies"${detailsOpenAttr('k7trophies')}><summary><i class="ti ti-award" aria-hidden="true"></i> ${k7h('Trophäenhalle')}</summary><p class="k7-muted">${k7h('Drei Plätze für bereits freigeschaltete Erfolge. Die Ausstellung verleiht keine Boni.')}</p><div class="k7-grid">${[0,1,2].map(slot=>{const picked=available.find(a=>a.key===list[slot]);return `<div class="k7-item"><label for="k7Trophy${slot}">#${slot+1}</label><select id="k7Trophy${slot}" data-k7-trophy="${slot}"><option value="">${k7h('Leerer Ausstellungsplatz')}</option>${available.map(a=>`<option value="${a.key}"${picked===a?' selected':''}>${escapeHtml(k7View(a).name)}</option>`).join('')}</select><p class="k7-muted">${picked?escapeHtml(k7View(picked).desc):''}</p></div>`;}).join('')}</div></details>`;
  setBoxHtml(box,'k7Trophies',html);box.querySelectorAll('[data-k7-trophy]').forEach(select=>select.onchange=()=>{k7SetTrophy(Number(select.dataset.k7Trophy),select.value);select.blur();renderK7Trophies();});
}
function renderK7Ideas() {
  if(['expedition','sammlung','allianz'].includes(activeTab)){k7RefreshProgress();renderK7ServerIdeas();}
  if(activeTab==='basis'){renderK7Blueprints();renderK7FeedbackToggle();}
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
    if(!response.ok)throw new Error();k7ServerProgress=await response.json();renderK7ServerIdeas();
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
    if(op){html+=`<p>${k7h('Phase')}: ${k7h(({scout:'Aufklärung',supply:'Versorgung',attack:'Angriff',completed:'Abgeschlossen'})[op.phase]||op.phase)}</p>`;
      if(['scout','supply'].includes(op.phase))html+=k7ActionButton('operation/contribute',op.phase==='scout'?'Aufklärungsdaten liefern':'Versorgung liefern',{tag,role:op.phase},!['idle','gathering'].includes(doc.phase));
      if(op.phase==='attack')html+=`<p class="k7-muted">${k7h('Flotten schließen sich über den vorhandenen Raid-Beitritt an. Normale Kampfverluste und Raid-Regeln gelten.')}</p>`;
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
    html+=`<article class="k7-item"><strong>${open?escapeHtml(k7View(entry).title):k7h('Noch nicht erkundet')}</strong>${open?`<p class="k7-muted">${escapeHtml(k7View(entry).text)}</p>${system?`<button data-k7-archive-map="${entry.system}">${k7h('Kartenziel öffnen')}</button>`:''}`:''}</article>`;
  }
  const chapters=[
    [1,'Das erste Geschäft','Das Aschen-Kartell nennt Handel eine Sprache. Dein erster guter Kontakt öffnet die Tür zu seinem Archiv: Verträge sind dort Erinnerungen, keine Freundschaften.'],
    [100,'Die Namen im Register','Mit wachsendem Ruf darfst du ältere Register lesen. Neben jedem Geschäft steht ein Name, manchmal gestrichen. Die Händler erinnern sich an ihre Partner länger als an die Preise.'],
    [300,'Was nicht verkauft wird','Im inneren Dossier steht eine Regel: Nicht jede Information ist eine Ware. Das Kartell bewahrt auch Geschichten, die es nicht preisgibt. Dein Ruf hat dir Vertrauen verschafft, keinen Anspruch auf alles.']
  ];
  html+=`<h4>${escapeHtml(k7t(FACTION_DIPLOMACY.kartell.name))}</h4>`;
  for(const [rep,title,text]of chapters)html+=`<article class="k7-item">${unlocked['kartell:'+rep]?`<strong>${escapeHtml(k7t(title))}</strong><p class="k7-muted">${escapeHtml(k7t(text))}</p>`:`<span class="k7-muted">${k7h('Ruf')} ${rep}</span>`}</article>`;
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
  const full=RES_DEFS.filter(d=>(state.resources[d.key]||0)>=storageCap());
  if(full.length)html+=`<p class="k7-warn">${k7h('Lager voll')}: ${full.map(d=>escapeHtml(k7View(d).label)).join(', ')}</p>`;
  return html;
}
