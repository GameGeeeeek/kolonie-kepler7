// Etappe C des Wirtschafts-Rebalance-Konzepts (docs/wirtschaft-rebalance-konzept.md):
// Die stille Drossel der Veredelungsketten wird sichtbar. Bis v8.555.0 stand an einer gedrosselten
// Kette nur „Rohstoffe knapp" - das sagte weder, WIE stark gedrosselt wird (5 % oder 95 %?), noch
// WORAN es liegt. Genau diese Drossel ist der groesste Tier-2-Abnehmer des Spiels, sobald Tier 3
// laeuft (gemessen: eine voll ausgebaute Gitter-Kette braucht 0,09 Metamaterial/s gegen 0,06/s
// Produktion) - sie gehoert damit auf die Karte, nicht ins Verborgene.
//
// Der Test haelt vier Dinge fest, die beim Bauen je einzeln schiefgehen koennen:
//   (1) Der ENGPASS entscheidet sich am VERHAELTNIS Bestand-zu-Bedarf, nicht am Bestand. Ein
//       Stoff, von dem viel da ist, kann der knappste sein, wenn die Kette viel davon braucht -
//       und der kleinste Bestand kann reichlich sein. Eine Anzeige, die den kleinsten Bestand
//       nennt, sagt dem Spieler, er solle das Falsche nachliefern. Nur an dieser Stelle im Code
//       steht neben jedem Bestand auch der Bedarf je Einheit; spaeter ist die Information weg.
//   (2) Die AUSLASTUNG kennt drei Faelle, nicht zwei: 0 % (die Kette steht wirklich), <1 % (ein
//       Rinnsal, das auf 0 runden wuerde) und n %. Der erste Entwurf klemmte mit Math.max(1, ...)
//       auf mindestens 1 % - gemessen an einer Kette ganz ohne Energie zeigte er „1 %", obwohl
//       nichts produziert wurde. Eine beschoenigte Null ist eine Falschaussage.
//   (3) Die drei Anzeigestellen (Ressourcenleiste, Tooltip, Fabrikkarte im Basis-Tab) rechnen
//       ueber DIESELBE Quelle. Die Fabrikkarte ist der Wiederholungsfehler dieses Projekts: Sie
//       wirbt mit dem theoretischen Durchsatz, und genau dort entscheidet der Spieler ueber den
//       Ausbau - ein Ausbau bei bestehendem Engpass verschiebt nur die Zahl (Hausregel 6).
//   (4) Die Signatur des Anzeige-Caches kennt die neuen Felder. Tut sie es nicht, friert genau
//       das neue Feld ein (die Wertlisten-Falle aus CLAUDE.md): Art, Auslastung und Engpass
//       koennen sich aendern, ohne dass Bestand, Deckel oder gerundete Rate sich bewegen.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig gefahren, jeweils gemessen):
//   - Am Stand v8.555.0: 13 Fehlschlaege - aber nur 19 der 27 Pruefungen laufen ueberhaupt, weil
//     der Block dort nicht existiert und Abschnitt 1/2 damit uebersprungen wird. Ein roter
//     Exit-Code allein ist deshalb KEIN Beleg (Regel 34); die eigentlichen Belege sind die drei
//     gezielten Sabotagen darunter, bei denen alle 27 Pruefungen laufen.
//   - Engpass-Suche durch „kleinster Bestand" ersetzt: 27 Pruefungen, es fallen 1b und 1d.
//   - Math.max(1, ...) des ersten Entwurfs wieder eingesetzt: 27 Pruefungen, es faellt GENAU 2a.
//   - Die drei Felder aus der Signatur genommen: 27 Pruefungen, es faellt GENAU 4.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

// Verneinende Pruefungen duerfen den PATCHNOTES-Block nicht mitlesen (Regel 46).
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();

// ---------- 1: tier2Step AUSGEFUEHRT (Regel 43: Verhalten messen, nicht lesen) ----------
/* Die Helfer werden aus der Datei GESCHNITTEN, nicht durch Platzhalter ersetzt (Regel 36): Ein
   nachgebautes gravInputMult() oder tier2StorageCap() wuerde eine andere Rechnung messen als die,
   die im Spiel laeuft - und genau der Unterschied waere das, was ein Test finden soll. */
let API = null, bauFehler = null;
try {
  const schnitt = (von, bis) => {
    const a = JS.indexOf(von), b = JS.indexOf(bis, a);
    if (a < 0 || b <= a) throw new Error('Anker nicht gefunden: ' + von);
    return JS.slice(a, b);
  };
  const quelle = schnitt('function allBuildingSets(){', 'function currentBuildings(){')
    + '\n' + schnitt('function skillHat(key){', 'function skillTier2Bonus(){')
    + '\n' + schnitt('function skillTier2Bonus(){', '\n')
    + '\n' + schnitt('function tier2TotalLevel(def){', 'let lastTier2BadgeSig');
  API = new Function('state', quelle + '\n; return { tier2Step, tier2StorageCap, tier2TotalLevel, tier2AuslastungText };');
  /* Einmal WIRKLICH aufrufen, nicht nur bauen: new Function() parst nur - ein fehlender Name im
     return-Objekt faellt erst beim Aufruf auf. Der erste Entwurf dieses Tests meldete deshalb
     "laesst sich ausfuehren" und stuerzte drei Pruefungen spaeter ab (Regel 34). */
  const probe = API({ buildings:{ nanolegierungsfabrik:1 }, colonies:{}, activeBasePlanet:'home',
                      research:{}, skillTree:{}, allianceResearch:{},
                      resources:{ erz:100, kristalle:100, energie:100, nanolegierungen:0 } });
  if (typeof probe.tier2AuslastungText !== 'function') throw new Error('tier2AuslastungText fehlt');
  /* Einen ECHTEN Schritt rechnen, nicht nur typeof pruefen: Der erste Entwurf begnuegte sich mit
     dem Bau, meldete gruen und stuerzte drei Pruefungen spaeter an einer Hilfsfunktion ab, die im
     Schnitt fehlte (Regel 34 - der rote Exit-Code sah dabei aus wie eine gelungene Gegenprobe). */
  const gProbe = {};
  probe.tier2Step({ key:'nanolegierungen', buildingKey:'nanolegierungsfabrik',
                    inputs:{ erz:8, kristalle:5, energie:4 }, ratePerLevel:0.006,
                    storageBase:200, storagePerLevel:150 },
                  { erz:100, kristalle:100, energie:100, nanolegierungen:0 }, 1, gProbe);
  if (!gProbe.art) throw new Error('tier2Step lieferte keinen Grund zurueck');
} catch (e) { API = null; bauFehler = String(e).slice(0, 200); }
check('1-bau: der Ketten-Block laesst sich mit den ECHTEN Helfern ausfuehren', !!API, bauFehler);

if (API) {
  /* Nanolegierungsfabrik: 8 Erz + 5 Kristalle + 4 Energie je Einheit, Rate 0,006/s je Stufe.
     Bei Gesamtstufe 15 will die Kette 0,09/s und braucht dafuer 0,72 Erz + 0,45 Kristalle
     + 0,36 Energie je Sekunde. */
  const bau = { nanolegierungsfabrik: 15 };
  const welt = (resources) => {
    const state = { buildings: bau, colonies: {}, activeBasePlanet: 'home', research: {},
                    skillTree: {}, allianceResearch: {}, resources };
    const api = API(state);
    const def = { key:'nanolegierungen', buildingKey:'nanolegierungsfabrik',
                  inputs:{ erz:8, kristalle:5, energie:4 }, ratePerLevel:0.006,
                  storageBase:200, storagePerLevel:150 };
    return { api, def, state };
  };
  {
    // 1a: laeuft alles, ist die Auslastung 1 und kein Engpass gesetzt.
    const { api, def } = welt({ erz:1e6, kristalle:1e6, energie:1e6, nanolegierungen:0 });
    const g = {};
    const produziert = api.tier2Step(def, { erz:1e6, kristalle:1e6, energie:1e6, nanolegierungen:0 }, 1, g);
    check('1a: ungedrosselt meldet die Kette volle Auslastung und keinen Engpass',
      g.art === 'voll' && Math.abs(g.anteil - 1) < 1e-9 && !g.engpass,
      { art:g.art, anteil:g.anteil, engpass:g.engpass, produziert });
  }
  {
    /* 1b: DIE Kernpruefung. Erz hat den GROESSTEN der drei Bestaende und ist trotzdem der Engpass;
       Energie hat den KLEINSTEN und ist es nicht. Eine Anzeige, die den kleinsten Bestand nennt,
       liefert hier „Energie" - und schickt den Spieler das Falsche nachliefern.
         Erz      0,10 / 8 = 0,0125  <- knappster ANTEIL, groesster Bestand
         Kristall 0,09 / 5 = 0,018
         Energie  0,08 / 4 = 0,020   <- kleinster Bestand, aber am reichlichsten */
    const res = { erz:0.10, kristalle:0.09, energie:0.08, nanolegierungen:0 };
    const { api, def } = welt(res);
    const g = {};
    api.tier2Step(def, Object.assign({}, res), 1, g);
    const kleinsterBestand = Object.keys(def.inputs).reduce((a,k) => res[k] < res[a] ? k : a, 'erz');
    check('1b: der Engpass entscheidet sich am VERHAELTNIS, nicht am kleinsten Bestand',
      g.art === 'rohstoffe' && g.engpass === 'erz' && kleinsterBestand === 'energie',
      { engpass:g.engpass, kleinsterBestand, bestaende:res, anteil:g.anteil });
    // Und die Auslastung stimmt der Groesse nach: 0,0125 von 0,09 = rund 14 %.
    check('1c: die Auslastung ist der Anteil am moeglichen Durchsatz',
      Math.abs(g.anteil - (0.10/8) / 0.09) < 1e-6, { anteil:g.anteil, erwartet:(0.10/8)/0.09 });
  }
  {
    /* 1d: Hebt man ausgerechnet den bisherigen Engpass an, bis ein anderer bindet, WANDERT die
       Auskunft mit - der Anteil bleibt dabei gleich, weil der neue Engpass genauso bindet. Ohne
       diese Richtung waere ein fest verdrahteter Engpass ("immer der erste Eingangsstoff")
       genauso gruen wie die richtige Rechnung. */
    const vorher = { erz:0.10, kristalle:0.09, energie:0.08, nanolegierungen:0 };
    const nachher = { erz:1e6,  kristalle:0.09, energie:0.08, nanolegierungen:0 };
    const g1 = {}, g2 = {};
    welt(vorher).api.tier2Step(welt(vorher).def, Object.assign({}, vorher), 1, g1);
    welt(nachher).api.tier2Step(welt(nachher).def, Object.assign({}, nachher), 1, g2);
    check('1d: faellt der Engpass weg, benennt die Kette den naechsten - nicht immer denselben',
      g1.engpass === 'erz' && g2.engpass === 'kristalle',
      { vorher:g1.engpass, nachher:g2.engpass });
  }
  {
    // 1e: Volles Lager bleibt „lager" - die Unterscheidung von v8.310.0 darf nicht verlorengehen.
    const { api, def } = welt({ erz:1e6, kristalle:1e6, energie:1e6, nanolegierungen:0 });
    const cap = api.tier2StorageCap(def);
    const res = { erz:1e6, kristalle:1e6, energie:1e6, nanolegierungen: cap };
    const g = {};
    api.tier2Step(def, res, 1, g);
    check('1e: bei vollem Lager bleibt es „lager" (nicht „rohstoffe") und der Anteil ist 0',
      g.art === 'lager' && g.anteil === 0 && !g.engpass, { art:g.art, anteil:g.anteil, cap });
  }
  // ---------- 2: der Prozenttext, drei Faelle ----------
  {
    const t = API({ buildings:{}, colonies:{}, activeBasePlanet:'home', research:{}, skillTree:{},
                    allianceResearch:{}, resources:{} }).tier2AuslastungText;
    check('2a: eine wirklich stehende Kette zeigt 0 %, nicht beschoenigte 1 %',
      t(0) === '0 %', { text: t(0) });
    check('2b: ein Rinnsal unter einem halben Prozent zeigt <1 %, nicht 0 %',
      t(0.001) === '<1 %' && t(0.004) === '<1 %', { bei0_001: t(0.001), bei0_004: t(0.004) });
    check('2c: dazwischen wird gerundet und die volle Kette zeigt 100 %',
      t(0.139) === '14 %' && t(1) === '100 %', { bei0_139: t(0.139), bei1: t(1) });
  }
}

// ---------- 3: EINE Quelle fuer alle drei Anzeigestellen ----------
{
  const nutzer = (JS.match(/tier2AuslastungText\(/g) || []).length;
  check('3a: der Prozenttext hat eine Definition und wird von allen Anzeigestellen benutzt',
    /function tier2AuslastungText\(/.test(JS) && nutzer >= 4,
    { aufrufe: nutzer, hinweis: '1 Definition + Leiste + Tooltip + Fabrikkarte' });
  /* Kein zweiter, handgerechneter Prozentwert in einer ANZEIGE - genau so entstuende die zweite
     Anzeigestelle mit der alten Annahme. Die Signatur des Caches ist ausgenommen und muss es
     sein: Sie rundet den Anteil bewusst selbst, um Aenderungen zu erkennen, und zeigt nichts an.
     Der erste Entwurf dieser Pruefung suchte ungescopt und schlug an der Signatur an - ein
     Werkzeugfehler, kein Befund. */
  const OHNE_SIGNATUR = (() => {
    const a = JS.indexOf('const sig = (proto ?');
    const b = JS.indexOf('if (sig === lastTier2BadgeSig)', a);
    return (a >= 0 && b > a) ? JS.slice(0, a) + JS.slice(b) : JS;
  })();
  check('3b-vorab: der Signatur-Block liess sich zum Ausschneiden finden', OHNE_SIGNATUR.length < JS.length);
  const rohe = [...OHNE_SIGNATUR.matchAll(/Math\.round\(\(g[A-Za-z]*\.anteil[^)]*\)\s*\*\s*100\)/g)].map(m => m[0]);
  check('3b: keine rohe Prozentrechnung mehr in einer Anzeige', rohe.length === 0, { gefunden: rohe });
  check('3c: die Fabrikkarte im Basis-Tab nennt die aktuelle Auslastung',
    /Läuft derzeit auf \$\{tier2AuslastungText\(/.test(JS));
}

// ---------- 4: die Signatur kennt die neuen Felder ----------
{
  const a = JS.indexOf('const sig = (proto ?');
  const b = JS.indexOf('if (sig === lastTier2BadgeSig)', a);
  check('4-anker: der Signatur-Block der Ressourcenleiste ist auffindbar', a >= 0 && b > a, { a, b });
  if (a >= 0 && b > a){
    const sig = JS.slice(a, b);
    check('4: Art, Auslastung und Engpass stehen in der Signatur (sonst friert die Anzeige ein)',
      /g\.art/.test(sig) && /g\.anteil/.test(sig) && /g\.engpass/.test(sig), { sig: sig.slice(-260) });
  }
}

// ---------- 5: die Schmiede meldet den BEZAHLTEN Preis ----------
/* Seit die Primordial-Kosten mit der Stueckzahl steigen, liefert kostenText() NACH plan.zaehlen()
   den naechsten Preis. Die Erfolgsmeldung nannte damit einen Preis, den niemand bezahlt hat.
   Geprueft wird die Reihenfolge im gescopten Block - ausserhalb davon ist kostenText() legitim. */
{
  const a = JS.indexOf('function craftForgedModule(');
  const b = JS.indexOf('const MYTHIC_PLAN = {', a);
  check('5-anker: craftForgedModule ist auffindbar', a >= 0 && b > a, { a, b });
  if (a >= 0 && b > a){
    const block = JS.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const iAblesen = block.indexOf('const bezahlterPreis = plan.kostenText();');
    const iBezahlen = block.indexOf('plan.bezahlen();');
    const iZaehlen = block.indexOf('plan.zaehlen();');
    check('5: der Preis wird VOR dem Bezahlen und VOR dem Zaehlen abgelesen',
      iAblesen > 0 && iAblesen < iBezahlen && iBezahlen < iZaehlen,
      { iAblesen, iBezahlen, iZaehlen });
    check('5b: und die Erfolgsmeldung nutzt genau diesen Wert, nicht den naechsten Preis',
      /geschmiedet \(' \+ bezahlterPreis \+ '\)/.test(block) &&
      block.slice(iZaehlen).indexOf('plan.kostenText()') < 0,
      { nachDemZaehlen: block.slice(iZaehlen, iZaehlen + 260) });
  }
}

// ---------- 6: der Schmiede-Hilfetext nennt die REGEL, nicht eine Momentaufnahme ----------
/* HELP_SECTIONS ist ein Array-Literal und wird EINMAL beim Laden gebaut. Ein dort eingesetzter
   primordialCostText() waere ab sofort eine Zahl, die den Rest der Sitzung stehen bleibt und nach
   dem ersten geschmiedeten Modul falsch ist. */
{
  const a = OHNE_HISTORIE.indexOf("title:'Die beiden Schmieden: Mythisch und Primordial'");
  const b = a < 0 ? -1 : OHNE_HISTORIE.indexOf('},', a);
  check('6-anker: der Schmiede-Hilfetext ist auffindbar', a >= 0 && b > a, { a, b });
  if (a >= 0 && b > a){
    const t = OHNE_HISTORIE.slice(a, b);
    check('6a: er sagt, dass der Preis mit jedem gefertigten Modul steigt',
      /Preis steigt mit jedem Modul/.test(t));
    check('6b: er leitet Anfangspreis, Schrittweite und Deckel aus den Konstanten ab',
      /PRIMORDIAL_CRAFT_BASE/.test(t) && /PRIMORDIAL_CRAFT_JE/.test(t) && /PRIMORDIAL_CRAFT_MAX/.test(t));
    check('6c: und er friert keinen Momentanpreis ein', t.indexOf('primordialCostText()') < 0);
  }
  check('6d: die widerlegte Vierzehn-Stunden-Behauptung steht nicht mehr im Code',
    !/vierzehn Stunden Produktion - ein einzelnes Modul/.test(OHNE_HISTORIE));
}

// ---------- 7: live - die Leiste zeigt Prozent und Stoff, der Tooltip die ganze Auskunft ----------
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
// Ohne Mine und Solarfeld: Die Inputs fuellen sich bis zur Messung nicht wieder auf, der Mangel
// ist also bei der Messung noch da (dieselbe Falle wie in test_tier2_hinweis).
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:0.3, erz:0.3, kristalle:0.3, deuterium:9e8, antimaterie:9e6,
              forschungspunkte:3e4, nanolegierungen:500 },
  buildings:{ labor:20, lager:60, nanolegierungsfabrik:15 },
  research:{ rnanotech:5 }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  const z = await page.evaluate(() => {
    const k = Array.from(document.querySelectorAll('.rescard'))
      .find(c => /Nanolegierungen/.test((c.querySelector('.label')||{}).textContent||''));
    return k ? { rate: ((k.querySelector('.rate')||{}).textContent||'').trim(), titel: k.getAttribute('title') } : null;
  });
  check('7a: die gedrosselte Kette beziffert ihre Auslastung', !!z && /(<1 %|\d+ %)/.test(z.rate), z);
  check('7b: und benennt den knappsten Eingangsstoff', !!z && /zu wenig \S/.test(z.rate), z);
  check('7c: der Tooltip erklaert, dass die Kette NICHT pausiert, sondern verarbeitet was ankommt',
    !!z && !!z.titel && /verarbeitet laufend so viel, wie ankommt/.test(z.titel), z && z.titel);
  check('7d: keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await browser.close();
  ende();
})();
