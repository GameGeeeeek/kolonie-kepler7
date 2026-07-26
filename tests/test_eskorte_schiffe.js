// Welche Schiffe dürfen auf Expedition? (Spieler-Report 26.07.2026)
//
// Gemeldet: "Wenn man alle fünf Expeditionen auf einmal losschicken will, berechnet er nur die
// ursprünglichen Schiffe ein - die ganzen Tier-2-Schiffe sind gar nicht mit eingerechnet."
//
// Ursache war nicht der Schnellstart-Knopf, sondern die Liste dahinter: EXPEDITION_SHIP_KEYS war von
// Hand gefuehrt und hinkte ATTACK_SHIP_KEYS um sieben Schiffe hinterher (Waechter, Hyperjaeger,
// Hyperbomber, Nanoklinge, Quantenkreuzer, Fusionsdreadnought, Singularitaets-Vernichter). Die
// konnten ueberhaupt nicht eskortieren, obwohl attackPowerRaw() ihre Angriffskraft laengst mitzaehlt.
//
// Das ist der wiederkehrende Projektfehler in Reinform (CLAUDE.md): eine ZWEITE Liste, die beim
// Einfuegen neuer Schiffe vergessen wird. Dieser Test haelt die beiden Listen zusammen - er schlaegt
// an, sobald ein Schiff angreifen darf, aber nicht eskortieren.
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const liste = (name) => {
  const m = src.match(new RegExp('const ' + name + " = \\[([^\\]]*)\\]"));
  return m ? [...m[1].matchAll(/'([a-z0-9]+)'/g)].map(x => x[1]) : null;
};
const ATTACK = liste('ATTACK_SHIP_KEYS');
check('ATTACK_SHIP_KEYS gelesen', !!ATTACK && ATTACK.length > 15, ATTACK && ATTACK.length);

// EXPEDITION_SHIP_KEYS ist bewusst KEIN Literal mehr - genau das war der Fehler.
const expZeile = (src.match(/const EXPEDITION_SHIP_KEYS = .*/) || [''])[0];
check('1: die Expeditions-Liste wird aus ATTACK_SHIP_KEYS abgeleitet, nicht von Hand geführt',
  /concat\(ATTACK_SHIP_KEYS\)/.test(expZeile), expZeile.trim().slice(0, 120));
const EXP = ['forscher','spaeher'].concat(ATTACK);
const ESCORT = EXP.filter(k => k !== 'forscher');

// ---------------------------------------------------------------- 2) Angreifen ⇒ eskortieren
const fehlend = ATTACK.filter(k => !ESCORT.includes(k));
check('2: jedes Schiff, das angreifen darf, darf auch eskortieren', fehlend.length === 0, fehlend);
check('2: das Forschungsschiff ist Pflicht, aber keine Eskorte',
  EXP.includes('forscher') && !ESCORT.includes('forscher'));
check('2: das Spähschiff ist als Utility-Eskorte dabei (Fundqualität)', ESCORT.includes('spaeher'));

// Der eigentliche Spieler-Report, namentlich.
const T2 = ['nanoklinge','quantenkreuzer','fusionsdreadnought','singularitaetsvernichter'];
check('2: die Tier-2-/Apex-Rümpfe können eskortieren',
  T2.every(k => ESCORT.includes(k)), T2.filter(k => !ESCORT.includes(k)));
check('2: auch Wächter, Hyperjäger und Hyperbomber',
  ['waechter','hyperjaeger','hyperbomber'].every(k => ESCORT.includes(k)));

// ---------------------------------------------------------------- 3) Bewusste Ausnahmen
// Beide fehlen schon in ATTACK_SHIP_KEYS, mit im Code dokumentierter Begruendung. Sie duerfen also
// auch nicht eskortieren - aber NUR sie. Ein drittes stillschweigend fehlendes Kampfschiff waere
// wieder derselbe Fehler.
const shipBlock = src.slice(src.indexOf('const SHIP_DEFS = ['), src.indexOf('\n  ];', src.indexOf('const SHIP_DEFS = [')));
const kampfschiffe = shipBlock.split('\n').filter(z => /\{ key:'/.test(z)).map(z => ({
  key: (z.match(/key:'([a-z0-9]+)'/) || [])[1],
  atk: parseInt((z.match(/atk:(\d+)/) || [])[1] || '0', 10)
})).filter(s => s.key && s.atk > 0);
check('3: Kampfschiffe aus SHIP_DEFS gelesen', kampfschiffe.length >= 20, kampfschiffe.length);
const AUSNAHMEN = ['mondzerstoerer', 'metamaterialtitan', 'ships'];
const stillFehlend = kampfschiffe.filter(s => !ESCORT.includes(s.key) && !AUSNAHMEN.includes(s.key));
check('3: kein Kampfschiff fehlt still in der Eskorte-Liste', stillFehlend.length === 0,
  stillFehlend.map(s => s.key + ' (atk ' + s.atk + ')'));
check('3: Mondzerstörer und Metamaterial-Titan bleiben draußen - wie schon beim Angriff',
  !ESCORT.includes('mondzerstoerer') && !ESCORT.includes('metamaterialtitan') &&
  !ATTACK.includes('mondzerstoerer') && !ATTACK.includes('metamaterialtitan'));
check('3: und die Begründung steht im Code',
  /Mondzerstörer \(eigener, serverseitig gehärteter Belagerungspfad\) und/.test(src) &&
  /Metamaterial-Titan \(reines Verteidigungsschiff\)/.test(src));

// ---------------------------------------------------------------- 4) Keine Karteileichen
const unbekannt = ESCORT.filter(k => k !== 'superschlachtschiff' && !new RegExp("key:'" + k + "'").test(shipBlock));
check('4: jede Eskorte-Kennung gibt es auch als Schiff', unbekannt.length === 0, unbekannt);
check('4: keine doppelten Einträge', new Set(EXP).size === EXP.length);

// ---------------------------------------------------------------- 5) Im laufenden Spiel
// Der Regex-Teil oben beweist die Listen. Diese Hälfte beweist, dass die Schiffe im Expeditions-
// Reiter tatsächlich auftauchen UND dass der Schnellstart sie mitnimmt - das war die Beschwerde.
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Bewusst je EIN Exemplar der frueher fehlenden Typen - so ist jede Zeile im Reiter eindeutig einem
// Schiffstyp zuzuordnen, und der Schnellstart muss sie auf die Expeditionen verteilen.
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:9e5,deuterium:9e5,antimaterie:9e4,forschungspunkte:5e4,nanolegierungen:500,quantenchips:500,fusionskerne:500,hochenergiekristalle:500,kikerne:200,metamaterial:200,singularitaetskerne:200},
  buildings:{solar:25,mine:22,lager:20,werft:15,hangar:10,labor:15,orbitalstation:4},
  research:{rsolar:8,rerz:8,rmodultechnik:5,rexpedition:5,rkolonisation:6,rexpslots:4},
  fleet:{ forscher:6, spaeher:4, jaeger:60, cruisers:20,
          nanoklinge:8, quantenkreuzer:8, fusionsdreadnought:8, singularitaetsvernichter:8,
          waechter:8, hyperjaeger:8, hyperbomber:8, missions:[] },
  colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',allianceTag:'',avatarKey:null}, battleStats:{wins:5,losses:1},
  xp:60000, credits:200000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{},
  expeditionsCompleted:30, modules:{}, shipModules:{} });

(async () => {
  const browser = await starteBrowser();
  const store={}; store['kepler7-save-v3']=SAVE;
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome']));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(SPIEL_URL); await page.waitForTimeout(2500);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); });
  await page.evaluate(()=>{ const b=document.querySelector('.tab-btn[data-tab="expedition"]'); if(b)b.click(); });
  await page.waitForTimeout(1200);

  const zeilen = await page.evaluate(()=>Array.from(document.querySelectorAll('[data-escort-inc]')).map(b=>b.getAttribute('data-escort-inc')));
  check('5: der Expeditions-Reiter bietet die Tier-2-Rümpfe als Eskorte an',
    ['nanoklinge','quantenkreuzer','fusionsdreadnought','singularitaetsvernichter'].every(k => zeilen.includes(k)),
    { angeboten: zeilen });
  check('5: und Wächter, Hyperjäger, Hyperbomber',
    ['waechter','hyperjaeger','hyperbomber'].every(k => zeilen.includes(k)), zeilen);

  // "Ganze Flotte als Eskorte" muss die neuen Typen mitnehmen.
  await page.evaluate(()=>{ const b=document.getElementById('escortMaxAllBtn'); if(b)b.click(); });
  await page.waitForTimeout(800);
  const gewaehlt = await page.evaluate(()=>{
    const raus = {};
    document.querySelectorAll('[data-escort-inc]').forEach(b=>{
      const k = b.getAttribute('data-escort-inc');
      const pille = b.parentElement.querySelector('.lvl-pill');
      raus[k] = pille ? parseInt(pille.textContent.trim(), 10) : -1;
    });
    return raus;
  });
  const nichtGewaehlt = ['nanoklinge','quantenkreuzer','fusionsdreadnought','singularitaetsvernichter','waechter','hyperjaeger','hyperbomber']
    .filter(k => !(gewaehlt[k] > 0));
  check('5: „Ganze Flotte als Eskorte" nimmt die früher fehlenden Typen mit',
    nichtGewaehlt.length === 0, { nichtGewaehlt, gewaehlt });

  // Schnellstart: alle möglichen Expeditionen auf einmal - die neuen Typen müssen mitfliegen.
  await page.evaluate(()=>{ const b=document.getElementById('sendMaxExpeditionsBtn'); if(b)b.click(); });
  await page.waitForTimeout(2000);
  // Der Spielstand geht per PUT an den Mock-Backend - von dort lesen, nicht aus localStorage
  // (im Backend-Modus schreibt das Spiel dorthin, localStorage ist nur der Solo-Fallback).
  const unterwegs = (() => {
    let s = null;
    try { s = JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; }
    if (!s) return null;
    const miss = ((s.fleet||{}).missions||[]).filter(m=>m.type==='expedition');
    const summe = {};
    miss.forEach(m => { const c = m.composition||{}; for (const k of Object.keys(c)) if (typeof c[k]==='number') summe[k]=(summe[k]||0)+c[k]; });
    return { anzahl: miss.length, summe };
  })();
  check('5: der Schnellstart hat mehrere Expeditionen gestartet',
    unterwegs && unterwegs.anzahl >= 2, unterwegs && unterwegs.anzahl);
  if (unterwegs && unterwegs.anzahl >= 2){
    const nichtMit = ['nanoklinge','quantenkreuzer','fusionsdreadnought','singularitaetsvernichter','waechter','hyperjaeger','hyperbomber']
      .filter(k => !(unterwegs.summe[k] > 0));
    check('5: und die früher fehlenden Typen fliegen tatsächlich mit',
      nichtMit.length === 0, { nichtMit, verteilt: unterwegs.summe });
  }
  check('5: keine Konsolenfehler im Expeditions-Reiter', errs.length === 0, errs.slice(0,3));

  console.log(fail ? '\nFAIL' : '\nPASS');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
