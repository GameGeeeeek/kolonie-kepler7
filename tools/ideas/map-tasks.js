const K7_MAP_FILTERS={all:'Alle Aufgaben',colonies:'Eigene Kolonien',loot:'Sichtbare Beuteziele',alliance:'Allianztreffpunkt',missions:'Laufende Missionen'};
function k7MapTasks(filter='all'){
  if(!Object.hasOwn(K7_MAP_FILTERS,filter))return [];
  const visible=new Set(visibleSystems().map(s=>s.id)),rows=[];
  if(filter==='all'||filter==='colonies')for(const id of ['home',...Object.keys(state.colonies||{})]){
    const system=planetSystemOf(id);if(visible.has(system))rows.push({key:'colony:'+id,kind:'colony',id,system,name:planetDisplayName(id),private:true,label:k7t('Eigene Kolonien')});
  }
  if(filter==='all'||filter==='loot')for(const target of k7LootTargets())rows.push({...target,key:'loot:'+target.id,label:k7t('Sichtbare Beuteziele')});
  const base=state.allianceBase;
  if((filter==='all'||filter==='alliance')&&myAllianceTag()&&base&&base.foundedAt&&visible.has(base.sector))rows.push({key:'alliance:base',kind:'alliance',system:base.sector,name:k7t('Allianzbasis'),label:k7t('Allianztreffpunkt')});
  if(filter==='all'||filter==='missions')for(const [origin,fleet]of [['home',state.fleet],...Object.entries(state.colonies||{}).map(([id,c])=>[id,c.fleet])])for(const mission of fleet&&fleet.missions||[]){
    if(!mission||!mission.id||!(mission.endTime>Date.now()))continue;
    const target=missionMapZiel(mission),system=target&&visible.has(target.system)?target.system:null;
    rows.push({key:'mission:'+origin+':'+mission.id,kind:'mission',system,name:k7t((MISSION_LINIEN[mission.type]||{}).was||'Mission'),label:k7t('Laufende Missionen'),remaining:Math.ceil((mission.endTime-Date.now())/1000)});
  }
  return rows;
}
function k7MapTaskJump(key){
  const row=k7MapTasks().find(r=>r.key===key);if(!row)return false;
  if(row.kind==='colony')findMyColony(row.id);
  else if(row.system){switchTab('karte');switchToSystem(row.system);}
  else switchTab('flotte');
  return true;
}
function renderK7MapTasks(){
  const box=document.getElementById('k7MapTasks');if(!box||bedienungLaeuft('k7MapTasks'))return;
  const saved=k7PersonalGoals().mapTaskFilter,filter=Object.hasOwn(K7_MAP_FILTERS,saved)?saved:'all',rows=k7MapTasks(filter);
  const html=`<details class="k7-ideas" data-keep-open="k7maptasks"${detailsOpenAttr('k7maptasks')}><summary><i class="ti ti-list-details" aria-hidden="true"></i> ${k7h('Kartenaufgaben')}</summary><div class="k7-row"><label for="k7MapTaskFilter">${k7h('Aufgabenfilter')}</label><select id="k7MapTaskFilter">${Object.entries(K7_MAP_FILTERS).map(([id,label])=>`<option value="${id}"${filter===id?' selected':''}>${k7h(label)}</option>`).join('')}</select></div><p class="k7-muted">${k7h('Es werden nur bekannte Ziele angezeigt. Missionen ohne bekanntes Kartenziel öffnen die Flottenübersicht. Sichtbarkeit bedeutet keine garantierte Kampfstärke.')}</p>${rows.map(row=>`<article class="k7-item"><strong${row.private?' translate="no"':''}>${escapeHtml(row.name)}</strong><p class="k7-muted">${escapeHtml(row.label)}${row.remaining!==undefined?' · '+fmtDuration(row.remaining):''}</p><button data-k7-task="${escapeHtml(row.key)}">${k7h(row.system?'Kartenziel öffnen':'Flotte öffnen')}</button></article>`).join('')||`<p class="k7-muted">${k7h('Keine aktuellen Aufgaben in diesem Filter.')}</p>`}</details>`;
  setBoxHtml(box,'k7MapTasks',html);
  box.querySelector('select').onchange=e=>{k7PersonalGoals().mapTaskFilter=e.target.value;save();renderK7MapTasks();};
  box.querySelectorAll('[data-k7-task]').forEach(btn=>btn.onclick=()=>k7MapTaskJump(btn.dataset.k7Task));
}
