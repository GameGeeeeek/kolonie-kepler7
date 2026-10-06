// Reuse production, storage, refinery and account rules on a disposable save.
function k7PlanningCopy(calculate){
  const live=state,cached=_bstZiel,cachedAt=_bstZielAt;
  state=typeof structuredClone==='function'?structuredClone(live):JSON.parse(JSON.stringify(live));_bstZiel=null;_bstZielAt=0;
  try{return calculate();}finally{state=live;_bstZiel=cached;_bstZielAt=cachedAt;}
}
function k7EconomySnapshot(){return k7PlanningCopy(()=>{
  const before={...state.resources},accounts=JSON.parse(JSON.stringify((state.baustelle||{}).konten||{})),gross=ratesPerSecond();
  for(const [key,rate] of Object.entries(gross))applySoftCappedGain(state.resources,key,rate,storageCap());
  const supplied={...state.resources};processTier2Factories(1);
  const net={},consumption={},caps={},bankRates={};
  for(const key of new Set([...Object.keys(before),...Object.keys(state.resources)])){
    net[key]=(state.resources[key]||0)-(before[key]||0);consumption[key]=Math.max(0,(supplied[key]||0)-(state.resources[key]||0))+Math.max(0,-(gross[key]||0));caps[key]=k7ResourceCapacity(key);
  }
  for(const [account,stock] of Object.entries((state.baustelle||{}).konten||{})){bankRates[account]={};for(const [key,count] of Object.entries(stock))bankRates[account][key]=count-((accounts[account]||{})[key]||0);}
  return {gross,net,consumption,caps,bankRates};
});}
function k7CostBottleneck(cost,account){
  const rest=account?baustelleRestKosten(cost,account):cost,bank=account?baustelleStand(account):{},economy=k7EconomySnapshot();
  return Object.entries(rest).map(([res,amount])=>{
    const have=costAmountAvailable(res),missing=Math.max(0,amount-have),cap=k7ResourceCapacity(res),rate=economy.net[res]||0,accountRate=((economy.bankRates[account]||{})[res]||0);
    const oversized=amount>cap,effective=rate+accountRate,blocked=missing>0&&accountRate<=0&&(effective<=0||oversized);
    let eta=missing===0?0:blocked?null:missing/effective;
    if(missing>0&&!blocked&&accountRate>0){
      if(rate>0){const untilFull=Math.max(0,cap-have)/rate;eta=missing<=effective*untilFull?missing/effective:untilFull+(missing-effective*untilFull)/accountRate;}
      else if(effective<=0||(rate<0&&eta>have/-rate))eta=amount/accountRate;
    }
    return {res,amount,have,missing,cap,rate,gross:economy.gross[res]||0,consumption:economy.consumption[res]||0,effective,bank:bank[res]||0,accountRate,blocked,oversized,eta};
  });
}
function k7TargetBottleneck(kind,key,planet=state.activeBasePlanet){return k7PlanningCopy(()=>{
  const research=kind==='research',defs=research?RESEARCH_DEFS:BUILDING_DEFS,def=defs.find(d=>d.key===key);if(!def||!['research','building'].includes(kind))return null;
  if(!research&&planet!=='home'&&!Object.hasOwn(state.colonies||{},planet))return null;
  const buildings=planet==='home'?state.buildings:(state.colonies[planet]||{}).buildings;
  const current=research?(state.research[key]||0):(buildings[key]||0),level=current+1,finished=!!def.maxLevel&&level>def.maxLevel;
  const cost=finished?{}:research?researchCostFor(def,level):costFor(def,current),account=research&&!finished?baustelleSchluessel(key,level):'';
  const unlocked=research?techUnlocked(def):techUnlockedGeneric(def.requires)&&(!def.moonOnly||isMoonKey(planet));
  const rows=k7CostBottleneck(cost,account),queued=research?(state.researchQueue||[]).includes(key)||state.activeResearch?.key===key:(state.buildQueue||[]).some(q=>q.planet===planet&&q.key===key)||(state.constructionQueue||[]).some(q=>q.kind==='building'&&q.planet===planet&&q.key===key);
  return {def,kind,planet,level,finished,unlocked,queued,cost,rows,eta:!unlocked||rows.some(r=>r.eta===null)?null:Math.max(0,...rows.map(r=>r.eta))};
});}
function k7ImprovementPreview(kind,key,planet=state.activeBasePlanet){
  const target=k7TargetBottleneck(kind,key,planet);if(!target||!target.unlocked||target.finished)return {allowed:false,target};
  const before=k7EconomySnapshot(),after=k7PlanningCopy(()=>{
    if(kind==='research')state.research[key]=target.level;
    else (planet==='home'?state.buildings:state.colonies[planet].buildings)[key]=target.level;
    return k7EconomySnapshot();
  });
  const rows=[...new Set([...Object.keys(before.net),...Object.keys(after.net)])].map(res=>({res,before:before.net[res]||0,after:after.net[res]||0,capBefore:before.caps[res],capAfter:after.caps[res]})).filter(r=>Math.abs(r.after-r.before)>1e-9||r.capBefore!==r.capAfter);
  return {allowed:true,target,rows};
}
function k7RenderPlanningBottleneck(boxId='k7Bottleneck'){
  const box=document.getElementById(boxId);if(!box||isTypingIn(boxId))return;
  const saved=k7PersonalGoals().economyTarget||{},kind=saved.kind==='building'?'building':'research',defs=kind==='building'?BUILDING_DEFS:RESEARCH_DEFS,target=defs.find(d=>d.key===saved.key)||defs[0];
  const view=k7TargetBottleneck(kind,target.key);if(!view)return;
  const control=boxId==='k7Bottleneck'?'k7ResearchTarget':'k7BuildTarget',improvement=k7ImprovementPreview(kind,target.key),open='k7engpass'+boxId;
  let html=`<details class="k7-ideas" data-keep-open="${open}"${detailsOpenAttr(open)}><summary><i class="ti ti-flask" aria-hidden="true"></i> ${k7h('Engpassanalyse')}</summary><div class="k7-row"><label>${k7h('Zielart')}<select data-k7-economy-kind><option value="research"${kind==='research'?' selected':''}>${k7h('Forschung')}</option><option value="building"${kind==='building'?' selected':''}>${k7h('Gebäude')}</option></select></label><label for="${control}">${k7h('Vorhaben auswählen')}</label><select id="${control}" data-k7-economy-target>${defs.map(d=>`<option value="${d.key}"${d.key===target.key?' selected':''}>${escapeHtml(k7t(d.name))}</option>`).join('')}</select></div>`;
  if(view.finished)html+=`<p>${k7h('Maximalstufe erreicht')}</p>`;
  if(view.queued)html+=`<p>${k7h('Bereits eingeplant; diese Anzeige startet keinen weiteren Auftrag.')}</p>`;
  if(!view.unlocked)html+=`<p class="k7-warn">${k7h('Voraussetzungen fehlen')}: ${(target.requires||[]).map(req=>{const r=techVoraussetzung(req);return k7h((RESEARCH_DEFS.find(d=>d.key===r.key)||{name:r.key}).name)+' '+r.level;}).join(', ')}${target.moonOnly?' · '+k7h('Nur auf einem eigenen Mond'):''}</p>`;
  for(const row of view.rows)html+=`<div class="k7-item"><strong>${escapeHtml(resLabel(row.res))}</strong><div class="k7-muted">${k7h('Restbedarf')}: ${fmt(row.missing)} · ${k7h('Nettozufluss')}: ${fmtRatePreview(row.rate)}/s<br>${k7h('Verbrauch')}: ${fmtRatePreview(row.consumption)}/s · ${k7h('Lagergrenze')}: ${Number.isFinite(row.cap)?fmt(row.cap):'∞'} · ${k7h('Baustellen-Konto')}: ${fmt(row.bank)} (+${fmtRatePreview(row.accountRate)}/s)</div>${row.blocked?`<div class="k7-warn">${k7h(row.res==='credits'?'Kredite haben keinen passiven Zufluss. Handel oder bestehende Aufträge nutzen.':row.oversized?(kind==='research'?'Lager ausbauen oder Forschungs-Konto nutzen':'Lager ausbauen; für Bauten gibt es kein Forschungs-Konto.'):row.rate<0?'Verbrauch übersteigt Zufluss':'Keine positive Produktion')}</div>`:''}</div>`;
  html+=`<p class="k7-muted">${view.eta===null?k7h('Keine garantierte Wartezeit; zuerst den Engpass beheben.'):view.eta===0?k7h('Bezahlbar'):k7h('Geschätzte Wartezeit bei unveränderten Bedingungen')+': '+fmtDuration(view.eta)}</p><h4>${k7h('Vorschau der nächsten Stufe')}</h4><div class="k7-muted">${k7View(target).desc||''}</div>`;
  if(improvement.allowed){for(const row of improvement.rows)html+=`<p class="k7-muted">${escapeHtml(resLabel(row.res))}: ${fmtRatePreview(row.before)}/s → ${fmtRatePreview(row.after)}/s · ${k7h('Lagergrenze')}: ${fmt(row.capBefore)} → ${fmt(row.capAfter)}</p>`;if(!improvement.rows.length)html+=`<p class="k7-muted">${k7h('Keine Änderung an Nettozufluss oder Lagergrenzen; weitere Effekte stehen in der Beschreibung.')}</p>`;}
  else html+=`<p class="k7-warn">${k7h('Verbesserung ist mit den aktuellen Voraussetzungen nicht verfügbar.')}</p>`;
  html+=`<p class="k7-muted">${k7h('Vorschau verändert weder Ressourcen noch Warteschlangen.')}</p></details>`;
  setBoxHtml(box,boxId,html);
  box.querySelector('[data-k7-economy-kind]').onchange=e=>{k7PersonalGoals().economyTarget={kind:e.target.value,key:''};e.target.blur();save();k7RenderPlanningBottleneck(boxId);};
  box.querySelector('[data-k7-economy-target]').onchange=e=>{k7PersonalGoals().economyTarget={kind,key:e.target.value};e.target.blur();save();k7RenderPlanningBottleneck(boxId);};
}
