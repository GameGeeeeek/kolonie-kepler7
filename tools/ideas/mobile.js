// A second click can land on a freshly rendered purchase or an unequip button.
// Guard the gesture at the document boundary, while keeping deliberate later actions available.
const k7RecentGestures=new Map();
document.addEventListener('click',event=>{
  if(!event.isTrusted)return;
  const el=event.target.closest('[data-build],[data-research],#sendExpeditionBtn,[data-equip-module],[data-unequip-module],[data-equip-ship-module],[data-unequip-ship-module],[data-k7-action],[data-claim-quest],#collectAllBtn,#claimAllQuestsBtn');
  if(!el)return;
  const equip=el.matches('[data-equip-module],[data-unequip-module],[data-equip-ship-module],[data-unequip-ship-module]');
  const key=(equip?'equipment':el.id||Object.entries(el.dataset).map(([k,v])=>k+':'+v).join('|'))+':'+state.activeBasePlanet;
  const now=performance.now(),previous=k7RecentGestures.get(key);k7RecentGestures.set(key,now);
  for(const [id,at]of k7RecentGestures)if(now-at>1000)k7RecentGestures.delete(id);
  const repeated=event.detail>1||event.sourceCapabilities?.firesTouchEvents;
  if(repeated&&previous!==undefined&&now-previous<350){event.preventDefault();event.stopImmediatePropagation();}
},true);
document.addEventListener('keydown',event=>{
  const el=event.target.closest('[data-claim-quest],[data-quest-nav]');
  if(el&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(!event.repeat)el.click();}
});
