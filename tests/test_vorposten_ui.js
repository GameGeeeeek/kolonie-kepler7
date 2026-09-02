// Der Vorposten im laufenden Spiel: Karte (fremd, eigen, Bauplatz), Kartenmenü, Bau, Angriff,
// Flugzeit-Nutzen, Beute und Verlust (B2, 02.09.2026).
//
//   node tests/test_vorposten_ui.js
//
// Er misst am GERENDERTEN Spiel, nicht am Quelltext - „im DOM vorhanden" ist nicht „für den
// Spieler sichtbar" (Arbeitsregel 55). Der Server ist ein Mock, der GET /api/vorposten in genau der
// Antwortform des Backends (`vorpostenFuerClient`, Stufentabelle `VORPOSTEN_STUFEN`) beantwortet -
// das Frontend führt bewusst KEINE Kopie der Stufentabelle, alle Zahlen kommen vom Server.
//
// GEPRUEFT WIRD:
//   1. Ein fremder Vorposten ist ein eigener, SICHTBARER Kartenknoten; sein Titel nennt Namen,
//      Stufe und Kern. Gegenrichtung: meldet der Server aktiv:false, gibt es keinen Knoten (1c).
//   2. Sein Kartenmenü nennt Kern, Verteidigung, Garnison und Nutzen und trägt den Eintrag
//      „Vorposten angreifen"; steht der Bauschutz noch, ist der Eintrag GESPERRT und nennt den Grund.
//   3. Die Vorschau nennt die Durchschlag-Aussage und die Verlustspanne; der Missionsstart legt
//      `vorposten-angriff` mit `vorpostenId` und `system` an.
//   4. Die Missionskarte nennt „Vorposten-Angriff" statt eines Erkundungsziels.
//   5. Der Flugzeit-Nutzen WIRKT und ist PvP-frei: ein eigener Vorposten Stufe 3 im Umkreis
//      (abyss, 0,85 Sektor von chronos) verkürzt die GEMESSENE Missionsdauer auf 85 %, einer
//      außerhalb (zenith, 3,2 Sektor) nicht - drei Läufe, dieselbe Fixture (Regel 61/62). Dazu die
//      geschnittene Funktion: PvP-Arten und ein fehlendes `art` liefern Faktor 1, der Deckel hält;
//      und im Quelltext gibt KEIN PvP-Missionsstart das fünfte Argument mit (datengetrieben, Regel 40).
//   6. Der Bauplatz: ohne Vorposten im fremden System zeigt die Karte den gestrichelten Bauplatz;
//      „Vorposten errichten" legt `vorposten-bau` an und bucht Kolonieschiff und Baukosten ab; ohne
//      Kolonieschiff ist der Eintrag gesperrt und nennt den Grund.
//   7. Der eigene Vorposten öffnet „Dein Vorposten" mit Ausbauen / Garnison / Rückruf / Aufgeben.
//   8. claimPendingRewards: `vorposten` bucht Kampfpunkte, Erfahrung und Kredite (PAAR gegen einen
//      Lauf ohne Belohnung); `vorposten-verlust` schreibt den Verlustbericht.
//   9. Die Nähte im Quelltext: Auffang-Signatur, Produktionsbonus, Spionage-Aufklärung, Hilfe.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: der Client liest den Vorposten-Stand über GET /vorposten in vorpostenCache', /backendFetch\('\/vorposten', \{ method:'GET' \}\)/.test(JS) && /vorpostenCache = Object\.assign/.test(JS));
check('0b: es gibt einen eigenen Kartenknoten', /data-map-vorposten/.test(JS));
check('0c: und die vier Missionsarten', ['vorposten-bau','vorposten-angriff','vorposten-defend','vorposten-defend-return'].every(t => JS.includes("type:'" + t + "'")));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';          // Ziel- und Bauplatz-System (fremd; Heimat ist kepler)
const NAH = 'abyss';            // 0,85 Sektor von chronos - im Umkreis (VORPOSTEN_FLUG_RADIUS_SEKTOR = 2)
const FERN = 'zenith';          // 3,19 Sektor von chronos - ausserhalb
const STUNDE = 3600 * 1000;

/* Die Stufentabelle in der Form, in der der Server sie schickt (VORPOSTEN_STUFEN im Backend). Der
   Test kopiert sie bewusst als MOCK-Antwort, nicht als Erwartung: gemessen wird, dass das Frontend
   die gelieferten Zahlen benutzt - nicht, ob sie mit dem Backend uebereinstimmen (das ist keine
   Kopie-Familie, der Client hat keine eigene Tabelle). */
const STUFEN = [
  { stufe:1, name:'Feldlager',  kernLp:20000,  verteidigung:2500,  garnisonMax:300,  flug:0.06, prod:0.015, scan:1, kampfpunkte:30,  xp:250,  credits:1200 },
  { stufe:2, name:'Stützpunkt', kernLp:90000,  verteidigung:12000, garnisonMax:800,  flug:0.10, prod:0.03,  scan:2, kampfpunkte:80,  xp:700,  credits:3500 },
  { stufe:3, name:'Bastion',    kernLp:400000, verteidigung:60000, garnisonMax:2000, flug:0.15, prod:0.05,  scan:3, kampfpunkte:200, xp:2000, credits:9000 }
];
function fremd(opt){
  const jetzt = Date.now();
  return Object.assign({ id:'vp-fremd-1', sys:SYS, besitzer:'x', besitzerName:'Borg', seit: jetzt - 48*STUNDE,
    stufe:2, name:'Stützpunkt', kern:{ lp:54000, lpMax:90000 }, verteidigung:15200, garnisonAnzahl:40,
    schutzBis: jetzt - 36*STUNDE, ausbauAb: jetzt - 12*STUNDE, nutzen:{ flug:0.10, prod:0.03, scan:2 },
    eigener:false, meinLetzterSchlag:0, letzterKampf:null }, opt || {});
}
function eigen(sys, stufe){
  const st = STUFEN[stufe - 1], jetzt = Date.now();
  return { id:'vp-eigen-' + sys, sys, besitzer:'u', besitzerName:'A', seit: jetzt - 72*STUNDE, stufe, name: st.name,
    kern:{ lp: st.kernLp, lpMax: st.kernLp }, verteidigung: st.verteidigung, garnisonAnzahl:0,
    schutzBis: jetzt - 60*STUNDE, ausbauAb: jetzt - 1000, nutzen:{ flug: st.flug, prod: st.prod, scan: st.scan },
    eigener:true, meinLetzterSchlag:0, letzterKampf:null, garnison:{}, kampfverlauf:[] };
}

function backend(store, opt){
  opt = opt || {};
  const liste = opt.liste || [];
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], wrackKonvois:[] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'vorposten'){
      return j({ ok:true, aktiv: !opt.inaktiv, bauAktiv: opt.bauAktiv !== false, maxJeKonto:3,
        schutzMs: 12*STUNDE, abklingMs: 4*STUNDE, ausbauMs: 12*STUNDE, garnisonFaktor:0.5,
        stufen: STUFEN, liste, eigene: liste.filter(v => v.eigener).length });
    }
    if (p === 'vorposten/angriff'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__schlag = (store.__schlag || []).concat([body]);
      return j({ ok:true, schaden:12000, gefallen:false, lp:42000, lpMax:90000, stufe:2, besitzerName:'Borg',
        verteidigung:15200, durchschlag:0.42, eigeneVerluste:{ cruisers:9 }, garnisonVerluste:{ cruisers:3 },
        anteil:0.3, teilnehmer:1, naechsterSchlagAb: Date.now() + 4*STUNDE });
    }
    if (p === 'vorposten/bauen') return j({ ok:true, vorposten: eigen(SYS, 1) });
    if (p.startsWith('vorposten/')) return j({ ok:true, garnison:{}, angenommen:{} });
    // Der Server liefert die vorgemerkte Belohnung GENAU EINMAL - wie der echte (list.shift()).
    if (p === 'pending-rewards/claim'){
      if (opt.pendingReward && !store.__pendingGeliefert){ store.__pendingGeliefert = true; return j({ reward: opt.pendingReward }); }
      return j({ reward: null });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { (store.__berichte = store.__berichte || []).unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
      return j({ reports: store.__berichte || [] });
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave, opt){
  const store = {};
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
async function aufKarte(t, sys){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  return oeffneSystemUeberSektoren(t.page, sys || SYS);
}
// Der Vorposten-Knoten des offenen Systems, gemessen an seinem Bildschirmplatz (Regel 55).
async function knoten(page){
  return page.evaluate(() => {
    const n = document.querySelector('#galaxyMapSvg [data-map-vorposten]');
    if (!n) return { da:false };
    const b = n.getBoundingClientRect();
    return { da:true, key: n.getAttribute('data-map-vorposten'), breite: Math.round(b.width), hoehe: Math.round(b.height),
      titel: (n.querySelector('title')||{}).textContent || '', gestrichelt: !!n.querySelector('polygon[stroke-dasharray]') };
  });
}
async function menueOeffnen(page){
  await page.evaluate(() => { const n = document.querySelector('#galaxyMapSvg [data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { offen:false, text:'', kopf:'', eintraege:[] };
    const eintraege = [...m.querySelectorAll('button[data-kmenu-i]')].map(b => ({
      label: (b.textContent || '').trim(), gesperrt: !!b.disabled,
      grund: (b.nextElementSibling && b.nextElementSibling.classList.contains('kmenu-grund')) ? (b.nextElementSibling.textContent || '').trim() : ''
    }));
    return { offen: m.getBoundingClientRect().height > 0, text: m.textContent || '', kopf: (m.querySelector('.kmenu-kopf')||{}).textContent || '', eintraege };
  });
}
async function eintragKlicken(page, muster){
  return page.evaluate(re => {
    const b = [...document.querySelectorAll('.kmenu button[data-kmenu-i]')].find(x => new RegExp(re).test(x.textContent));
    if (!b) return { da:false };
    if (!b.disabled) b.click();
    return { da:true, gesperrt: b.disabled };
  }, muster.source);
}
async function flottenwahl(page){
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return { da: !!ov && ov.getBoundingClientRect().height > 0, txt: ov ? ov.textContent : '' };
  });
}
async function starten(page){
  const r = await page.evaluate(() => {
    const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
    if (!b) return { da:false };
    const gesperrt = b.disabled;
    if (!gesperrt) b.click();
    return { da:true, gesperrt };
  });
  await page.waitForTimeout(1200);
  return r;
}
// Ein vollstaendiger Angriffs-Lauf auf den fremden Vorposten in chronos - fuer die drei
// Flugzeit-Messungen dieselbe Kette, damit sich die Laeufe NUR in der Vorposten-Liste unterscheiden.
async function angriffsLauf(browser, save, liste){
  const t = await tab(browser, save, { liste });
  await t.page.waitForTimeout(2500);
  const geoeffnet = await aufKarte(t);
  const k = await knoten(t.page);
  const menue = await menueOeffnen(t.page);
  const klick = await eintragKlicken(t.page, /Vorposten angreifen/);
  const vor = await flottenwahl(t.page);
  const knopf = await starten(t.page);
  const m = ((t.stand().fleet||{}).missions||[]).find(x => x.type === 'vorposten-angriff');
  return { t, geoeffnet, k, menue, klick, vor, knopf, m, dauer: m ? (m.endTime - m.startTime) : null };
}
function werte(stand){
  return { kampfpunkte: stand.battlePoints || 0, xp: stand.xp || 0, credits: stand.credits || 0 };
}

/* ---- Quelltext-Werkzeuge fuer Abschnitt 5 und 9 ------------------------------------------- */
// Zerlegt die Argumentliste eines Aufrufs ab der oeffnenden Klammer (Klammern, Zeichenketten
// und Template-Literale werden ueberlesen) - ein Regex ueber die Zeile zaehlt bei geschachtelten
// Aufrufen wie missionFuelCost(missionDurationFor(...), 1) die falschen Kommas.
function aufrufArgumente(src, klammerIdx){
  let tiefe = 0, cur = '', q = null; const args = [];
  for (let i = klammerIdx; i < src.length; i++){
    const c = src[i];
    if (q){ cur += c; if (c === '\\'){ cur += src[++i]; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`'){ q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{'){ tiefe++; if (tiefe === 1) continue; cur += c; continue; }
    if (c === ')' || c === ']' || c === '}'){ tiefe--; if (tiefe === 0){ if (cur.trim()) args.push(cur.trim()); return args; } cur += c; continue; }
    if (c === ',' && tiefe === 1){ args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return args;
}
const aufrufe = [];
for (const m of JS.matchAll(/missionDurationFor\(/g)){
  if (JS.slice(Math.max(0, m.index - 9), m.index) === 'function ') continue;
  aufrufe.push({ idx: m.index, args: aufrufArgumente(JS, m.index + 'missionDurationFor'.length) });
}
const artenM = /const VORPOSTEN_FLUG_ARTEN = new Set\((\[[^\]]*\])\)/.exec(JS);
let ARTEN = null;
try { ARTEN = new Set(JSON.parse(artenM[1].replace(/'/g, '"'))); } catch(e){}
check('5-bau: die Weichen-Liste VORPOSTEN_FLUG_ARTEN und die Aufrufstellen liessen sich lesen',
  !!ARTEN && ARTEN.size >= 8 && aufrufe.length >= 20, { arten: ARTEN && [...ARTEN], aufrufe: aufrufe.length });
if (ARTEN){
  // Jede Aufrufstelle, die ein fuenftes Argument mitgibt, nennt eine Art aus der Weichen-Liste -
  // eine erfundene Zeichenkette bekaeme still keinen Bonus, und niemand saehe es.
  const mitArt = aufrufe.filter(a => a.args.length >= 5);
  const fremdeArt = mitArt.filter(a => !/^'[a-z-]+'$/.test(a.args[4]) || !ARTEN.has(a.args[4].slice(1, -1)));
  check('5a: jedes fuenfte Argument ist eine Art aus der Weichen-Liste', mitArt.length >= 10 && fremdeArt.length === 0,
    { mitArt: mitArt.length, fremde: fremdeArt.map(a => a.args[4]) });
  /* PvP-Missionsstarts geben KEIN fuenftes Argument mit. Gescopt auf die Funktion, in der der push
     steht (nicht auf ein Zeichenfenster) - sonst zaehlte der PvE-Nachbar davor mit. */
  const PVP = ['player-attack','spy-player','moon-siege','asteroid-contest','alliance-muster-attack','attack-alliance-base','alliance-base-attack','raid'];
  const pvpBloecke = [];
  for (const m of JS.matchAll(/missions\.push\(\{/g)){
    const seg = JS.slice(m.index, m.index + 900);
    const typ = /type:\s*'([^']+)'/.exec(seg);
    if (!typ || !PVP.includes(typ[1])) continue;
    const fnStart = Math.max(JS.lastIndexOf('\n  function ', m.index), JS.lastIndexOf('\n  async function ', m.index));
    const von = fnStart >= 0 ? fnStart : Math.max(0, m.index - 2500);
    const calls = aufrufe.filter(a => a.idx >= von && a.idx < m.index);
    pvpBloecke.push({ typ: typ[1], calls: calls.map(a => a.args.length) });
  }
  const pvpMitBonus = pvpBloecke.filter(b => b.calls.some(n => n >= 5));
  check('5b-vorab: PvP-Missionsstarts mit Flugzeit-Rechnung wurden gefunden',
    pvpBloecke.some(b => b.calls.length > 0), { bloecke: pvpBloecke });
  check('5b: KEIN PvP-Missionsstart gibt das fuenfte Argument mit (die Weiche aus Konzept 4.2)',
    pvpMitBonus.length === 0, { mitBonus: pvpMitBonus });
  check('5c: missionDurationFor multipliziert den Vorposten-Faktor mit der Art',
    /mult \*= vorpostenFlugMult\(targetSystem, art\);/.test(JS));
}
// Die geschnittene Funktion, ausgefuehrt: Faktor 1 fuer PvP-Arten und fehlendes `art`, 0,85 fuer eine
// PvE-Art im Umkreis, unveraendert ausserhalb, Deckel 0,5.
let flugFn = null, flugBau = null;
try {
  const kA = JS.indexOf('  const VORPOSTEN_FLUG_RADIUS_SEKTOR = ');
  const fA = JS.indexOf('  function vorpostenFlugMult(targetSystem, art){');
  const fE = JS.indexOf('\n  }', fA);
  if (kA < 0 || fA < 0 || fE < 0 || !artenM) throw new Error('Anker nicht gefunden');
  const quelle = JS.slice(kA, JS.indexOf('\n', kA)) + '\n' + artenM[0] + ';\n' + JS.slice(fA, fE + 4) + '\n return vorpostenFlugMult;';
  flugFn = (liste, dist) => new Function('vorpostenEigene', 'systemSectorDistance', quelle)(() => liste, dist);
} catch(e){ flugBau = String(e.message || e); }
check('5d-bau: vorpostenFlugMult laesst sich schneiden und ausfuehren', flugBau === null, { flugBau });
if (flugFn){
  const nah = [{ sys:NAH, eigener:true, nutzen:{ flug:0.15 } }];
  const dist = (a, b) => a === NAH ? 0.85 : 3.2;
  const f = flugFn(nah, dist);
  const pve = f(SYS, 'npc'), erk = f(SYS, 'explore');
  const pvp = { angriff: f(SYS, 'player-attack'), spionage: f(SYS, 'spy'), mond: f(SYS, 'moon-siege'), anfechtung: f(SYS, 'asteroid-contest'), ohneArt: f(SYS, undefined), ohneZiel: f(null, 'npc') };
  check('5d: PvE-Arten im Umkreis bekommen den Faktor der Stufe (0,85)', Math.abs(pve - 0.85) < 1e-9 && Math.abs(erk - 0.85) < 1e-9, { pve, erk });
  check('5e: PvP-Arten, fehlendes art und fehlendes Ziel liefern 1', Object.values(pvp).every(v => v === 1), pvp);
  const fern = flugFn([{ sys:FERN, eigener:true, nutzen:{ flug:0.15 } }], dist)(SYS, 'npc');
  check('5f: ausserhalb des Umkreises kein Bonus', fern === 1, { fern });
  const deckel = flugFn([{ sys:NAH, eigener:true, nutzen:{ flug:0.9 } }], dist)(SYS, 'npc');
  check('5g: der Deckel haelt bei 0,5', deckel === 0.5, { deckel });
}

(async () => {
  const browser = await starteBrowser();

  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  /* Die Fixture: Kreuzer fuer den Angriff, zwei Kolonieschiffe fuer den Bau, Uhren weit in die
     Zukunft (Regel 18), die Ereignis-Kartenebene an, damit der Knoten gezeichnet wird. */
  function fixture(opt){
    opt = opt || {};
    const st = JSON.parse(JSON.stringify(basis));
    for (const k of Object.keys(st.fleet)) if (typeof st.fleet[k] === 'number') st.fleet[k] = 0;
    st.fleet.cruisers = 120;
    st.fleet.colonyShips = opt.colonyShips !== undefined ? opt.colonyShips : 2;
    const fern = Date.now() + 365*24*STUNDE;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.karteEbenen = Object.assign({}, st.karteEbenen, { ereignisse:true });
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    return JSON.stringify(st);
  }

  // ---- 1-4) Der fremde Vorposten: Knoten, Menü, Vorschau, Mission, Missionskarte (Lauf A) ----
  const A = await angriffsLauf(browser, fixture(), [fremd()]);
  check('1-anker: das System liess sich oeffnen', A.geoeffnet === true, { geoeffnet: A.geoeffnet });
  check('1a: der fremde Vorposten ist auf der Karte SICHTBAR', A.k.da && A.k.breite > 4 && A.k.hoehe > 4, A.k);
  check('1b: sein Titel nennt Namen, Stufe und Kern-Anteil (60 %)',
    /Stützpunkt/.test(A.k.titel) && /Stufe 2/.test(A.k.titel) && /Kern 60%/.test(A.k.titel), { titel: A.k.titel });
  check('2a: das Kartenmenü öffnet sich als fremder Vorposten', A.menue.offen && /Fremder Vorposten/.test(A.menue.kopf), { kopf: A.menue.kopf });
  check('2b: es nennt Kern, Verteidigung, Garnison und Nutzen',
    /Kern/.test(A.menue.text) && /Verteidigung/.test(A.menue.text) && /Garnison 40/.test(A.menue.text) && /Nutzen: −10% Flugzeit/.test(A.menue.text),
    { text: A.menue.text.slice(0, 400) });
  const angriffA = A.menue.eintraege.find(e => /Vorposten angreifen/.test(e.label));
  check('2c: der Angriffs-Eintrag ist da und ohne Bauschutz NICHT gesperrt', !!angriffA && !angriffA.gesperrt, angriffA);
  check('3-anker: die Flottenwahl ist offen', A.vor.da, { da: A.vor.da });
  check('3a: die Vorschau nennt den Durchschlag der Verteidigung', /Durchschlag/.test(A.vor.txt) && /Verteidigung/.test(A.vor.txt), { auszug: A.vor.txt.slice(0, 500) });
  check('3b: und die Verlustspanne', /6[–-]30% Verlusten/.test(A.vor.txt), { auszug: A.vor.txt.slice(0, 500) });
  check('4-knopf: der Startknopf ist da und nicht gesperrt', A.knopf.da && !A.knopf.gesperrt, A.knopf);
  check('4a: die Mission ist angelegt und trägt vorpostenId und system',
    !!A.m && A.m.vorpostenId === 'vp-fremd-1' && A.m.system === SYS && A.m.targetId === SYS,
    { typen: ((A.t.stand().fleet||{}).missions||[]).map(m => m.type), m: A.m && { vorpostenId: A.m.vorpostenId, system: A.m.system } });
  await A.t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
  await A.t.page.waitForTimeout(1400);
  const karte = await A.t.page.evaluate(() => { const b = document.getElementById('missionsActive'); return b ? b.textContent : ''; });
  check('4b: die Missionskarte nennt den Vorposten-Angriff statt eines Erkundungsziels',
    /Vorposten-Angriff/.test(karte) && !/Erkundungsziel/.test(karte), { auszug: karte.slice(0, 300) });
  check('4c: keine Seitenfehler im Lauf', A.t.errs.length === 0, A.t.errs.slice(0, 3));
  await A.t.ctx.close();

  // ---- 5) Der Flugzeit-Nutzen, GEMESSEN an der Missionsdauer (Laeufe B und C) --------------
  const B = await angriffsLauf(browser, fixture(), [fremd(), eigen(NAH, 3)]);
  const C = await angriffsLauf(browser, fixture(), [fremd(), eigen(FERN, 3)]);
  check('5h-vorab: alle drei Laeufe haben eine Angriffsmission mit Dauer',
    A.dauer > 0 && B.dauer > 0 && C.dauer > 0, { A: A.dauer, B: B.dauer, C: C.dauer });
  check('5h: ein eigener Vorposten Stufe 3 im Umkreis verkuerzt die Missionsdauer auf 85 %',
    A.dauer > 0 && B.dauer > 0 && Math.abs(B.dauer / A.dauer - 0.85) < 0.02,
    { A: A.dauer, B: B.dauer, verhaeltnis: A.dauer ? +(B.dauer / A.dauer).toFixed(3) : null });
  check('5i: einer ausserhalb des Umkreises aendert nichts', A.dauer > 0 && C.dauer === A.dauer, { A: A.dauer, C: C.dauer });
  await C.t.ctx.close();

  // ---- 7) Der eigene Vorposten (im Lauf B steht er in abyss) ---------------------------------
  const eigenOffen = await aufKarte(B.t, NAH);
  const kE = await knoten(B.t.page);
  const mE = await menueOeffnen(B.t.page);
  check('7-anker: das System des eigenen Vorpostens liess sich oeffnen und zeigt ihn', eigenOffen === true && kE.da && kE.key === NAH, kE);
  check('7a: das Menü heisst Dein Vorposten und trägt die vier eigenen Einträge',
    /Dein Vorposten/.test(mE.kopf) && ['Ausbauen','Garnison stationieren','Garnison zurückrufen','Vorposten aufgeben'].every(l => mE.eintraege.some(e => e.label.includes(l))),
    { kopf: mE.kopf, eintraege: mE.eintraege.map(e => e.label) });
  check('7b: ohne Garnison ist der Rückruf gesperrt, die Stationierung bei 120 Kreuzern nicht',
    mE.eintraege.some(e => /zurückrufen/.test(e.label) && e.gesperrt) && mE.eintraege.some(e => /stationieren/.test(e.label) && !e.gesperrt),
    { eintraege: mE.eintraege });
  await B.t.ctx.close();

  // ---- 2d) Bauschutz: der Angriffs-Eintrag ist gesperrt und nennt den Grund ------------------
  const tS = await tab(browser, fixture(), { liste: [fremd({ schutzBis: Date.now() + 5*STUNDE })] });
  await tS.page.waitForTimeout(2500);
  await aufKarte(tS);
  const mS = await menueOeffnen(tS.page);
  const angriffS = mS.eintraege.find(e => /Vorposten angreifen/.test(e.label));
  check('2d: mit laufendem Bauschutz ist der Angriff GESPERRT und der Grund steht dabei',
    !!angriffS && angriffS.gesperrt && /Bauschutz/.test(angriffS.grund), angriffS);
  await tS.ctx.close();

  // ---- 6) Der Bauplatz -------------------------------------------------------------------------
  const tB = await tab(browser, fixture(), { liste: [] });
  await tB.page.waitForTimeout(2500);
  await aufKarte(tB);
  const kB = await knoten(tB.page);
  check('6a: ohne Vorposten zeigt das fremde System den gestrichelten Bauplatz - SICHTBAR',
    kB.da && kB.key === 'bauplatz:' + SYS && kB.gestrichelt && kB.breite > 4, kB);
  const mB = await menueOeffnen(tB.page);
  const bauE = mB.eintraege.find(e => /Vorposten errichten/.test(e.label));
  check('6b: das Menü nennt Baukosten und Nutzen und der Bau-Eintrag ist frei',
    /Baukosten/.test(mB.text) && /Nutzen ab Stufe 1/.test(mB.text) && !!bauE && !bauE.gesperrt, { eintrag: bauE, text: mB.text.slice(0, 300) });
  const vorher = tB.stand();
  await eintragKlicken(tB.page, /Vorposten errichten/);
  await tB.page.waitForTimeout(1200);
  const nachher = tB.stand();
  const mBau = ((nachher.fleet||{}).missions||[]).find(m => m.type === 'vorposten-bau');
  check('6c: der Start legt die Bau-Mission an (Baukolonne = 1 Kolonieschiff, System chronos)',
    !!mBau && mBau.system === SYS && (mBau.composition||{}).colonyShips === 1 && (mBau.endTime - mBau.startTime) > 0,
    { typen: ((nachher.fleet||{}).missions||[]).map(m => m.type), m: mBau && { system: mBau.system, composition: mBau.composition } });
  check('6d: das Kolonieschiff verlaesst die Flotte, die Baukosten sind bezahlt (Erz −20.000, Kristalle −12.000)',
    (vorher.fleet.colonyShips - (nachher.fleet.colonyShips||0)) === 1
      && (vorher.resources.erz - nachher.resources.erz) >= 20000 && (vorher.resources.kristalle - nachher.resources.kristalle) >= 12000,
    { kolonieschiffe: [vorher.fleet.colonyShips, nachher.fleet.colonyShips], erz: vorher.resources.erz - nachher.resources.erz, kristalle: vorher.resources.kristalle - nachher.resources.kristalle });
  check('6e: keine Seitenfehler beim Bau', tB.errs.length === 0, tB.errs.slice(0, 3));
  await tB.ctx.close();

  const tB2 = await tab(browser, fixture({ colonyShips: 0 }), { liste: [] });
  await tB2.page.waitForTimeout(2500);
  await aufKarte(tB2);
  const mB2 = await menueOeffnen(tB2.page);
  const bauE2 = mB2.eintraege.find(e => /Vorposten errichten/.test(e.label));
  check('6f: ohne Kolonieschiff ist der Bau gesperrt und der Grund nennt es',
    !!bauE2 && bauE2.gesperrt && /Kolonieschiff/.test(bauE2.grund), bauE2);
  await tB2.ctx.close();

  // ---- 8) claimPendingRewards: Beute (PAAR) und Verlustbericht --------------------------------
  const belohnung = { type:'vorposten', system:SYS, stufe:2, name:'Stützpunkt', besitzerName:'Borg', anteil:0.5, kampfpunkte:80, xp:700, credits:3500, zeit: Date.now() };
  const tMit = await tab(browser, fixture(), { pendingReward: belohnung });
  await tMit.page.waitForTimeout(2500);
  const wMit = werte(tMit.stand());
  const geliefert = !!tMit.store.__pendingGeliefert;
  await tMit.ctx.close();
  const tOhne = await tab(browser, fixture());
  await tOhne.page.waitForTimeout(2500);
  const wOhne = werte(tOhne.stand());
  await tOhne.ctx.close();
  check('8-vorab: der Server hat die Belohnung wirklich einmal ausgeliefert', geliefert, { geliefert });
  check('8a: die Beute bucht Kampfpunkte, Erfahrung und Kredite (+80 / +700 / +3.500)',
    (wMit.kampfpunkte - wOhne.kampfpunkte) === 80 && (wMit.xp - wOhne.xp) === 700 && (wMit.credits - wOhne.credits) === 3500,
    { mit: wMit, ohne: wOhne });

  const verlust = { type:'vorposten-verlust', system:SYS, stufe:1, name:'Feldlager', angreiferName:'Borg', teilnehmer:2, garnisonVerloren:{ cruisers:20 }, zeit: Date.now() };
  const tV = await tab(browser, fixture(), { pendingReward: verlust });
  await tV.page.waitForTimeout(2500);
  const st = tV.stand();
  const berichte = [].concat(tV.store.__berichte || [], st.reports || [], st.__reports || []);
  const vb = berichte.find(r => r && r.type === 'vorposten-verlust');
  check('8b: der Verlust schreibt den Bericht vorposten-verlust mit Angreifer und Garnison',
    !!vb && vb.angreiferName === 'Borg' && (vb.garnisonVerloren||{}).cruisers === 20, { gefunden: !!vb, typen: berichte.map(r => r && r.type).slice(0, 8) });
  await tV.ctx.close();

  // ---- 1c) Gegenrichtung: der Server meldet aktiv:false ----------------------------------------
  const tI = await tab(browser, fixture(), { inaktiv: true, liste: [fremd()] });
  await tI.page.waitForTimeout(2500);
  await aufKarte(tI);
  const kI = await knoten(tI.page);
  check('1c: meldet der Server aktiv:false, gibt es weder Vorposten- noch Bauplatz-Knoten', kI.da === false, kI);
  await tI.ctx.close();

  // ---- 9) Die Naehte im Quelltext ---------------------------------------------------------------
  const sigA = JS.indexOf('function karteAuffangSignatur(');
  const sigE = sigA >= 0 ? JS.indexOf('\n  }', sigA) : -1;
  check('9a: die Auffang-Signatur der Karte enthaelt die Vorposten (sonst bliebe ein Wechsel unsichtbar)',
    sigA >= 0 && sigE > sigA && /vorpostenCache\.liste/.test(JS.slice(sigA, sigE)), { gefunden: sigA >= 0 });
  const prodA = JS.indexOf('  function productionBonusRaw(');
  const prodE = prodA >= 0 ? JS.indexOf('\n  }', prodA) : -1;
  check('9b: productionBonusRaw summiert den Vorposten-Produktionsbonus', prodA >= 0 && /vorpostenProdBonus\(\)/.test(JS.slice(prodA, prodE)), { gefunden: prodA >= 0 });
  check('9c: die Boni-Bilanz nennt die Vorposten als Quelle', /Schürfschiffe, Doktrin, Vorposten/.test(JS));
  check('9d: die Spionage-Entdeckung liest die Aufklaerungsstufe des Ziel-Systems', /vorpostenScanStufe\(entry\.homeSystem\)/.test(JS));
  check('9e: die Hilfe traegt den Vorposten-Eintrag', /title:'Vorposten: deine Präsenz in einem fremden System'/.test(JS));

  await browser.close();
  ende();
})();
