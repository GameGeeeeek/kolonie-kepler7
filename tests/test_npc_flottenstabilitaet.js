// NPC-Flotten muessen bei gleichen Eingaben gleich bleiben, auch nach dem Warmwerden des JS-Motors.
// Befund: Chrome 153 wechselte im Cache-Test bei 18 NPCs trotz identischem Seed/Pool/Zielwert
// die Flotte. Ein Zufallskomparator in Array.sort verbrauchte je Ausfuehrungspfad andere Zufallswerte.
// Gegenprobe: alter Shuffle -> fachlich rot, auch ohne gluecklichen JIT-Zeitpunkt. Zwei stabile,
// fuer konsistente Komparatoren gueltige Sortierverfahren muessen dasselbe NPC-Ergebnis liefern.
// Keine nachgebaute Flottenerzeugung: alle Rechenfunktionen und Zahlen kommen aus SPIELDATEI.
const fs = require('fs');
const vm = require('vm');
const { SPIELDATEI, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const source = fs.readFileSync(SPIELDATEI, 'utf8').replace(/\r\n/g, '\n');

function block(name, expression) {
  const matches = [...source.matchAll(new RegExp(expression.source, 'gm'))];
  check('Anker: '+name+' ist genau einmal lesbar', matches.length === 1, { treffer:matches.length });
  return matches.length === 1 ? matches[0][0] : '';
}
function funktion(name) {
  // Oberste Spielfunktionen sind zwei Leerzeichen eingerueckt. Einzeiler separat behandeln;
  // sonst endet der Ausschnitt erst an der schliessenden Klammer derselben Einrueckung.
  return block(name, new RegExp('^  function '+name+'\\([^\\n]*\\)\\{(?:[^\\n]*\\}$|[\\s\\S]*?^  \\})'));
}
const ships = block('SHIP_DEFS', /^  const SHIP_DEFS = \[[\s\S]*?^  \];/);
const npcs = block('NPCS', /^  const NPCS = \[[\s\S]*?^  \];/);
const pool = block('RAIDER_SHIP_POOL', /^  const RAIDER_SHIP_POOL = \[[^\n]*\n[^;]+;/);
const prestige = block('PRESTIGE_CHALLENGE_FROM', /^  const PRESTIGE_CHALLENGE_FROM = \d+;/);
// Nur key/atk werden aus den echten Definitionen benoetigt, nicht Kostenfunktionen/Beschreibungen.
const shipDefs = [...ships.matchAll(/^\s*\{ key:'([^']+)'[^\n]*?\batk:([\d.]+)/gm)]
  .map(m => ({ key:m[1], atk:Number(m[2]) }));
check('Anker: Angriffswerte stammen aus den Schiffdefinitionen', shipDefs.length > 20
  && new Set(shipDefs.map(s=>s.key)).size === shipDefs.length, { schiffe:shipDefs.length });
const functions = ['shipBaseAtk','npcScalingCount','sektorLageVon','sektorNpcMult',
  'npcWeltFaktor','prestigeChallengeMult','npcEffectiveDefense','generateRaiderFleet','npcFleetFor'].map(funktion);
if (!ships || !npcs || !pool || !prestige || functions.some(s=>!s) || shipDefs.length <= 20) {
  ende();
} else {
  // Die Sektor-Zuordnung ist die einzige geografische Attrappe: Die Staerkefaktoren selbst
  // rechnen die Originalfunktionen aus der vorgegebenen Serverlage und dem Spielstand.
  const bundle = `
    const state = { npcScaling:{}, prestige:0 };
    let galaxyCache = {};
    function sektorVonSystemId(){ return {key:'testsektor'}; }
    const SHIP_DEFS = ${JSON.stringify(shipDefs)};
    ${npcs}\n${prestige}\n${functions.join('\n')}\n${pool}
    return {
      state, npcs:NPCS, pool:RAIDER_SHIP_POOL, prestigeAb:PRESTIGE_CHALLENGE_FROM,
      generate:generateRaiderFleet, npc:npcFleetFor, defense:npcEffectiveDefense,
      galaxy(value){ galaxyCache=value; },
      random(value){ const old=Math.random; Math.random=value; return ()=>{Math.random=old;}; },
      input(npc){
        const old=generateRaiderFleet;
        generateRaiderFleet=(target,rng)=>({target,rng});
        try { return npcFleetFor(npc); } finally { generateRaiderFleet=old; }
      }
    };
  `;
  const fresh = () => {
    const context = vm.createContext({});
    return { context, api:vm.runInContext('(function(){'+bundle+'})()', context) };
  };
  const { api } = fresh();
  const target = api.npcs.find(n=>n.id==='raider2');
  check('Anker: der gemessene Gegner ist in den echten Definitionen vorhanden', !!target);
  if (!target) {
    ende();
  } else {
    const beforePool = JSON.stringify(api.pool);
    const expectedKeys = ['ships','jaeger','carrier','cruisers','destroyers','bomber',
      'schlachtschiff','leerenjaeger','superschlachtschiff'];
    check('1a: der bestehende Ueberfall-Pool und seine positiven Angriffswerte bleiben erhalten',
      JSON.stringify(api.pool.map(s=>s.key)) === JSON.stringify(expectedKeys)
      && api.pool.every(s=>Number.isFinite(s.atk) && s.atk > 0), api.pool);

    const input0 = api.input(target), sequence = rng => Array.from({length:16},()=>rng());
    const seed0 = sequence(input0.rng), sameSeed = sequence(api.input(target).rng);
    const differentSeed = sequence(api.input({...target,id:target.id+'-anderer-seed'}).rng);
    check('1b: gleicher NPC erzeugt dieselbe Zufallsfolge, andere ID eine andere',
      JSON.stringify(seed0) === JSON.stringify(sameSeed) && JSON.stringify(seed0) !== JSON.stringify(differentSeed));
    check('1c: der Generator erhaelt die echte effektive NPC-Verteidigung',
      input0.target === target.defense && input0.target === api.defense(target), { ziel:input0.target });
    const originalFleet = JSON.stringify(api.npc(target));
    api.state.npcScaling[target.id] = 3;
    const scaled = api.input(target);
    check('1d: Siege aendern sowohl Zielstaerke als auch Seed; Zuruecksetzen stellt die Flotte wieder her',
      scaled.target === Math.round(target.defense * (1 + 3*0.18))
      && JSON.stringify(sequence(scaled.rng)) !== JSON.stringify(seed0), { skaliertesZiel:scaled.target });
    api.state.npcScaling[target.id] = 0;
    check('1e: gleiche NPC-Eingaben liefern nach einer fremden Skalierung wieder dieselbe Flotte',
      JSON.stringify(api.npc(target)) === originalFleet);
    api.state.prestige = api.prestigeAb + 5;
    api.galaxy({npcEmpireStrength:1.4,sektorLage:{sektoren:{testsektor:{npcMult:1.25}}}});
    check('1f: Welt-, Sektor- und Prestige-Faktoren bleiben im Zielwert enthalten',
      api.input(target).target === Math.round(target.defense * 1.4 * 1.25 * 1.2));
    api.state.prestige = 0; api.galaxy({});

    let invalid = null, fightersSeen = 0;
    const outputs = new Set();
    for (const power of [-20,0,5,20,65,155,600,5000,1000000]) {
      for (let i=0;i<40;i++) {
        const npc = {...target,id:'probe-'+i};
        const value = api.generate(power, api.input(npc).rng), entries = Object.entries(value.fleet);
        const weight = entries.reduce((sum,[key,count])=>sum + count*(api.pool.find(s=>s.key===key)?.atk || 0),0);
        const fighters = (value.fleet.jaeger||0)+(value.fleet.bomber||0);
        const allowed = api.pool.filter(s=>s.atk <= Math.max(20,Math.max(5,power)*0.6)).map(s=>s.key);
        if (fighters) fightersSeen++;
        if (!entries.length || !entries.every(([key,count])=>allowed.includes(key) && Number.isInteger(count) && count > 0)
          || !Number.isFinite(value.totalPower) || value.totalPower !== weight || weight <= 0
          || (value.fleet.carrier||0)*6 < fighters) invalid ||= {power,value,weight};
        if (power===65) outputs.add(JSON.stringify(value));
      }
    }
    check('2a: Zielwert-Matrix liefert nur erlaubte ganze Schiffe, korrekte Gesamtstaerke und genug Traeger',
      !invalid && fightersSeen > 0, { fehler:invalid, faelleMitJaegernOderBombern:fightersSeen });
    check('2b: verschiedene Seeds erzeugen bei gleichem Ziel mehr als eine Flotte', outputs.size > 1, { varianten:outputs.size });
    check('2c: Zielwerte unter fuenf verhalten sich wie der vorhandene Mindestwert',
      [-20,0].every(n=>JSON.stringify(api.generate(n,api.input(target).rng)) === JSON.stringify(api.generate(5,api.input(target).rng))));
    check('2d: kein Aufruf veraendert Reihenfolge oder Werte des gemeinsamen Schiffspools', JSON.stringify(api.pool) === beforePool);

    let calls = 0;
    const fallbackRng = api.input(target).rng;
    const restoreRandom = api.random(()=>{calls++; return fallbackRng();});
    let fallback, explicit;
    try { fallback=api.generate(65); explicit=api.generate(65,api.input(target).rng); }
    finally { restoreRandom(); }
    check('3a: ohne RNG nutzt der Ueberfall Math.random mit demselben Ergebnis wie eine explizite Quelle',
      calls > 0 && JSON.stringify(fallback) === JSON.stringify(explicit), { aufrufe:calls });
    const stopRandom = api.random(()=>{throw new Error('NPC benutzt ungesetzten Zufall');});
    let seededError = null;
    try { api.npc(target); } catch(e) { seededError=e.message; } finally { stopRandom(); }
    check('3b: ein NPC benoetigt Math.random nicht', !seededError, seededError);

    // Beide Verfahren sind stabil und sortieren konsistente Komparatoren korrekt. Ein
    // Zufallskomparator ist NICHT konsistent: andere Vergleichsfolgen duerfen dann anders enden.
    // Die Produktregel darf weder von dieser Wahl noch vom JIT-Zeitpunkt abhaengen.
    function insertion(compare) {
      for (let i=1;i<this.length;i++) { const value=this[i]; let j=i-1;
        while (j>=0 && compare(this[j],value)>0) { this[j+1]=this[j]; j--; }
        this[j+1]=value;
      }
      return this;
    }
    function merge(compare) {
      const order = arr => {
        if (arr.length<2) return arr;
        const middle=Math.floor(arr.length/2), left=order(arr.slice(0,middle)), right=order(arr.slice(middle));
        const out=[]; let a=0,b=0;
        while(a<left.length && b<right.length) out.push(compare(left[a],right[b])<=0?left[a++]:right[b++]);
        return out.concat(left.slice(a),right.slice(b));
      };
      const sorted=order([...this]); for(let i=0;i<sorted.length;i++) this[i]=sorted[i];
      return this;
    }
    check('4-Anker: beide Test-Sortierer sortieren stabil', [insertion,merge].every(sort=>
      sort.call([{n:2,id:'a'},{n:1,id:'b'},{n:2,id:'c'}],(a,b)=>a.n-b.n).map(x=>x.id).join(',')==='b,a,c'));
    const engines = [insertion,merge].map(sort=>{
      const e=fresh(); vm.runInContext('Array.prototype.sort=('+sort.toString()+');',e.context); return e.api;
    });
    const differences=[];
    for(const npc of api.npcs) for(const wins of [0,1,3]) {
      const values=engines.map(e=>{e.state.npcScaling[npc.id]=wins; return JSON.stringify(e.npc(npc));});
      if(values[0]!==values[1]) differences.push({npc:npc.id,wins,links:JSON.parse(values[0]),rechts:JSON.parse(values[1])});
    }
    check('4a: gleiche Seeds liefern unabhaengig von der gueltigen Sortierungsstrategie dieselbe Flotte',
      differences.length===0, { abweichungen:differences.length, beispiele:differences.slice(0,2) });

    (async()=>{
      let browser;
      try {
        browser=await starteBrowser();
        const page=await browser.newPage();
        const result=await page.evaluate(code=>{
          const a=new Function(code)(), npc=a.npcs.find(n=>n.id==='raider2');
          const baseline=JSON.stringify(a.npc(npc)), poolBefore=JSON.stringify(a.pool);
          const changes=[]; let invalid=false;
          for(let i=1;i<=10000;i++) {
            const got=JSON.stringify(a.npc(npc));
            if(got!==baseline && changes.length<2) changes.push({aufruf:i,vorher:JSON.parse(baseline),nachher:JSON.parse(got)});
          }
          const starts=a.npcs.map(n=>JSON.stringify(a.npc(n)));
          for(let i=0;i<100;i++) a.npcs.forEach((n,j)=>{if(JSON.stringify(a.npc(n))!==starts[j]) invalid=true;});
          return {changes,allStable:!invalid,poolStable:poolBefore===JSON.stringify(a.pool),npcCount:a.npcs.length,
            eligible:a.pool.filter(s=>s.atk<=Math.max(20,a.defense(npc)*0.6)).length};
        },bundle);
        check('5a: gleicher NPC bleibt in Chromium ueber 10000 Aufrufe stabil (kalter und warmer Motor)',
          result.changes.length===0, { viererPool:result.eligible, abweichungen:result.changes });
        check('5b: alle echten NPCs bleiben bei je 100 weiteren Aufrufen stabil', result.allStable, { npcs:result.npcCount });
        check('5c: auch Chromium veraendert den gemeinsamen Schiffspool nicht', result.poolStable);
      } catch(e) { check('Browserprobe laeuft ohne Ausnahme',false,String(e.stack||e)); }
      finally { if(browser) await browser.close(); }
      await ende();
    })();
  }
}
