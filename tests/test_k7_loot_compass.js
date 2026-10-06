'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{
  const f=await fixture('sets:k7LootSets,items:k7LootItems,source:k7LootSource,owns:k7OwnsLoot,select:k7SelectWish,toggle:k7ToggleItemWish,wishes:k7ItemWishes,render:renderK7LootCompass,craftCost:tier2ModuleCraftCost,eventChance:()=>EVENT_MODULE_CHANCE,save:sicherSpeichern','en');
  try{
    const p=f.page;
    const result=await p.evaluate(()=>{
      const t=__ideas,s=t.state(),items=t.items(),sets=t.sets();s.modules={};s.shipModules={};s.equippedModules={};s.equippedShipModules={};
      const ship=sets.find(set=>set.art==='schiff'),normal=sets.find(set=>set.art==='standort'&&!set.bossKey),part=items.find(item=>item.art==='schiff'&&item.def.key===ship.req[0]);
      s.shipModules[part.def.key+':selten']=0;const zero=!t.owns(part.def,'schiff');s.equippedShipModules[ship.klasse]=[part.def.key+':selten'];const equipped=t.owns(part.def,'schiff');
      const ordinary=t.select(normal.key),shipSelection=t.select(ship.key),valid=t.toggle(part.id),invalid=t.toggle('schiff:__proto__'),kept=t.wishes().includes(part.id);
      const crafted=items.find(i=>i.def.craftOnly),craft=t.source(crafted.def,crafted.art),event=items.find(i=>i.def.eventKey),eventSource=t.source(event.def,event.art),deep=items.find(i=>i.def.minTiefe),depth=t.source(deep.def,deep.art),unique=items.find(i=>i.def.fundort),exclusive=t.source(unique.def,unique.art);
      const stock=JSON.stringify(s.resources);for(const item of items)t.source(item.def,item.art);const readonly=stock===JSON.stringify(s.resources);
      t.show('sammlung');document.querySelector('#k7LootCompass details').open=true;
      return {zero,equipped,ordinary,shipSelection,valid,invalid,kept,readonly,sets:sets.length,items:items.length,craft:!craft.showShare&&craft.requirements.some(r=>r.includes('Cost for Common')),event:eventSource.chance===t.eventChance()&&!eventSource.showShare,depth:depth.minTiefe===deep.def.minTiefe&&depth.requirements.some(r=>r.includes(String(deep.def.minTiefe))),unique:exclusive.herkunft==='unikat'&&!exclusive.showShare,shipSet:ship.key,wish:part.id};
    });
    for(const key of ['zero','equipped','ordinary','shipSelection','valid','kept','readonly','craft','event','depth','unique'])assert.equal(result[key],true,key);
    assert.equal(result.invalid,false,'unknown wish cannot expose or grant a fabricated item');
    assert.equal(await p.locator('#k7WishSet option').count(),result.sets,'compass includes all existing location and ship sets');
    assert.equal(await p.locator('#k7WishItem option').count(),result.items,'compass includes every existing module');
    await p.locator('#k7WishItem').selectOption({value:await p.evaluate(()=>__ideas.items().find(i=>i.def.craftOnly).id)});
    await p.locator('#k7LootCompass [data-k7-go="offiziere:schiffsmodule"]').first().click();
    assert.equal(await p.locator('.tab-btn.active').getAttribute('data-tab'),'offiziere');
    assert.equal(await p.locator('#officerSubtabs [data-officer-subtab].on').getAttribute('data-officer-subtab'),'schiffsmodule','craft link opens the real crafting subtab');
    await p.evaluate(()=>__ideas.save());await p.reload();await p.waitForFunction(()=>window.__ideas&&__ideas.ready());
    assert.equal(await p.evaluate(id=>__ideas.wishes().includes(id),result.wish),true,'wishlist survives reloading');
    assert.equal(await p.evaluate(()=>__ideas.state().personalGoals.wishSet),result.shipSet,'selected ship set persists');
    assert.equal(f.errors.length,0,f.errors.join('\n'));console.log('PASS all sets/items, ownership, exact sources, eligible chances, crafting link and persistence');
  }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
