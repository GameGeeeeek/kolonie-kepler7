// Serverabhaengige Anzeigebereiche mit ECHTEN Daten v8.298.30.
//
// WARUM ES DIESEN TEST GIBT
// -------------------------
// Am 26.07.2026 kam ein Spieler-Screenshot: der Fraktionsbereich war leer. Dahinter lagen drei
// Fehler, von denen einer (ein ReferenceError im Fraktionsladen, seit v8.298.22) monatelang durch
// KEINEN Test aufgefallen war. Der Grund war strukturell: die Mock-Backends aller Tests liefern fuer
// die serverabhaengigen Endpunkte leere Antworten. Jeder Anzeigebereich lief damit in seinen
// Leerzustand ("Noch keine Daten geladen.") und der eigentliche Rendercode wurde nie ausgefuehrt.
// Der Sweep meldete gruen, weil er nur nach Konsolenfehlern schaut - und wo nichts rendert, kann
// auch nichts krachen.
//
// Dieser Test schliesst die Luecke fuer die uebrigen serverabhaengigen Bereiche: er fuettert eine
// REICHHALTIGE Attrappe und prueft dann zweierlei je Bereich:
//   1. keine JS-Fehler   (wie der Sweep)
//   2. der Bereich hat WIRKLICH INHALT und steht nicht in seinem Leerzustand
// Punkt 2 ist der Kern. Ohne ihn waere dieser Test genauso blind wie der Sweep.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const now = Date.now();
const TAG = 'VOID';
const UID = 'u';

// ---------------------------------------------------------------- Server-Antworten
const GALAXY = {
  factions: {
    kartell:  { id:'kartell',  name:'Aschen-Kartell', color:'#e0a548', systems:['kepler','sirius'], strength:12.5 },
    legion:   { id:'legion',   name:'Eisenlegion',    color:'#e24b4a', systems:['vega'],            strength:9.1 },
    void:     { id:'void',     name:'Void-Marodeure', color:'#c3bef5', systems:[],                  strength:4.2 },
    schatten: { id:'schatten', name:'Schattenbund',   color:'#6fd0c0', systems:['altair'],          strength:7.7 }
  },
  news: [
    { icon:'ti-sword', text:'Die Eisenlegion hat Vega besetzt.', ts: now-600000 },
    { icon:'ti-flag',  text:'Das Aschen-Kartell baut seine Handelsroute aus.', ts: now-1800000 }
  ],
  controlledSystems: {}, npcEmpireStrength: 1.2, activeWar: null
};
const MARKET = { market: { prices:{ erz:1.0, kristalle:2.1, deuterium:4.2, antimaterie:31.0 },
                           baseline:{ erz:1.0, kristalle:2.0, deuterium:4.0, antimaterie:30.0 }, ts: now } };
const MODULMARKT = { listings: [
  { id:'l1', seller:'HandelsHans', sellerId:'other', instKey:'waffen:selten', price:4200, ts:now-100000 },
  { id:'l2', seller:'AdmiralX',    sellerId:UID,     instKey:'sonde:episch',  price:19000, ts:now-200000 }
], limits: { maxListings:5, maxPrice:250000 } };
// Die Feldnamen sind der ECHTE Vertrag von renderReportsBox: type/result/time plus die je Typ
// erwarteten Zusatzfelder. Genau daran ist die erste Fassung dieses Tests gescheitert - die Attrappe
// hatte sich eigene Namen ausgedacht und der Bereich blieb leer, ohne dass ein Fehler auffiel.
const BERICHTE = [
  { id:'r1', time: now-300000, type:'attack-received', result:'win',  attackerName:'Roter Baron',
    attackPower: 41000, defensePower: 68000 },
  { id:'r2', time: now-900000, type:'attack-sent',     result:'win',  targetName:'HandelsHans',
    attackPower: 92000, defensePower: 51000, stolen:{ erz:12000, kristalle:6000 } }
];
const NACHRICHTEN = [{ id:'m1', from:'HandelsHans', fromId:'other', time: now-120000, text:'Willst du tauschen?', read:false }];
const WELTBOSS = { id:'wb1', name:'Leviathan der Leere', hp: 640000, maxHp: 1000000,
                   endsAt: now+7200000, contributors:{ u:{ name:'AdmiralX', dmg:52000 }, other:{ name:'HandelsHans', dmg:31000 } } };
const RUHMESHALLE = { records: [{ season:'2026-S1', name:'AdmiralX', score:998000, ts: now-8640000 }] };
// names ist ein Objekt userId -> Anzeigename (pactOtherName liest genau daraus). Mit aName/bName,
// wie zuerst geraten, stand in der Anzeige "Pakt mit Unbekannt".
const PAKT = { a:UID, b:'other', names:{ [UID]:'AdmiralX', other:'HandelsHans' }, status:'active',
               startedAt: now-86400000, expiresAt: now+86400000*20, tier:2 };
const BESTENLISTE = { name:'HandelsHans', score:812000, prestige:3, allianceTag:'IRON', ts: now-60000 };

function backend(store){
  return async r => {
    const req = r.request();
    const url = req.url();
    const p = url.split('/api/')[1].split('?')[0];
    const query = (url.split('?')[1]||'');
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:UID, username:'AdmiralX', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j(GALAXY);
    if (p === 'market') return j(MARKET);
    if (p === 'modulemarket') return j(MODULMARKT);
    if (p === 'reports') return j({ reports: BERICHTE });
    if (p === 'messages') return j({ messages: NACHRICHTEN });
    if (p === 'notifications') return j([{ id:'n1', ts:now-60000, text:'Deine Forschung ist fertig.' }]);
    if (p === 'notification-prefs') return j({ prefs:{} });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'storage-list'){
      // Der Praefix entscheidet, welche Schluessel es "gibt" - so finden Bestenliste, Pakte und
      // Allianzdaten jeweils etwas vor, statt in eine leere Liste zu laufen.
      const m = decodeURIComponent((query.match(/prefix=([^&]*)/)||[])[1] || '');
      if (m === 'leaderboard:') return j({ keys:['leaderboard:other'] });
      if (m === 'pact:') return j({ keys:['pact:'+UID+':other'] });
      if (m === 'alliance:') return j({ keys:['alliance:'+TAG] });
      return j({ keys: Object.keys(store).filter(k => k.startsWith(m)) });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      const fest = {
        'worldboss:current': JSON.stringify(WELTBOSS),
        'halloffame:records': JSON.stringify(RUHMESHALLE),
        ['pact:'+UID+':other']: JSON.stringify(PAKT),
        'leaderboard:other': JSON.stringify(BESTENLISTE)
      };
      if (fest[k] !== undefined) return j({ key:k, value:fest[k], version:1 });
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/wars|halloffame|bounty|friends/.test(p)) return j([]);
    // Versions-Pruefung holt die Spieldatei selbst - unter file:// verbietet das die
    // Same-Origin-Regel des Browsers. Reine Umgebungsfolge, kein Spielfehler (siehe unten).
    return j({});
  };
}

const SAVE = {
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:480000, erz:520000, kristalle:310000, deuterium:200000, antimaterie:9000, forschungspunkte:22000 },
  buildings:{ solar:20, mine:20, kristallmine:18, deutsynth:15, labor:12, lager:14, werft:10, hangar:8, habitat:10, botschaft:6, geschuetz:8, schild:6 },
  research:{ rsolar:8, rerz:8, rbauplan:5, rdiplomatie:3, rmodultechnik:3, rhandel:2 },
  fleet:{ jaeger:400, bomber:120, zerstoerer:60, schlachtschiff:30, missions:[] },
  colonies:{}, activeBasePlanet:'home',
  player:{ id:UID, name:'AdmiralX', allianceTag:TAG, avatarKey:'crown' },
  factionRep:{ kartell:80, legion:55, void:20, schatten:-40 },
  factionFavor:{ kartell:9, legion:4 }, embassySeats:{ kartell:true },
  modules:{ 'waffen:selten':2, 'sonde:episch':1 }, moduleFragments:60, commandPoints:25,
  battleStats:{ wins:120, losses:14 }, expeditionsCompleted:40,
  seasonLeague:{ seasonKey:'2026-S2', points:4200, tier:'gold' },
  xp:520000, credits:840000, prestige:6, buffs:[], lastTick:now, colonyNames:{},
  officers:{ admiral:6, ingenieur:5, haendler:4 }
};

// Bereich, Tab, ein Textstueck das bei ECHTEM Inhalt vorkommt, und der Leertext der NICHT kommen darf.
const BEREICHE = [
  { name:'NPC-Fraktionen',   tab:'galaxie', box:'factionBox',      hat:/Aschen-Kartell/,        leer:/Noch keine Fraktionsdaten geladen/ },
  { name:'Galaxie-News',     tab:'galaxie', box:'galaxyNewsBox',   hat:/Eisenlegion hat Vega/,  leer:/Noch keine/ },
  { name:'Weltboss',         tab:'galaxie', box:'worldBossBox',    hat:/Leviathan/,             leer:/Weltboss lädt/ },
  { name:'Bestenliste',      tab:'rangliste', box:'leaderboard',   hat:/HandelsHans/,           leer:/lädt…/ },
  { name:'Diplomatie',       tab:'diplomatie', box:'diplomacyBox',     hat:/HandelsHans/,           leer:/Diplomatie ist verfügbar, sobald/ },
  { name:'Markt',            tab:'markt',   box:'marketBox',       hat:/Kristalle/,             leer:null },
  { name:'Modulmarkt',       tab:'markt',   box:'moduleMarketBox', hat:/Angebot\(e\)[\s\S]*Waffenmodul/, leer:/Keine Angebote/ },
  { name:'Kampfberichte',    tab:'rangliste', box:'reportsBox',    hat:/Roter Baron[\s\S]*HandelsHans/, leer:/Noch keine Berichte/ }
];

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify(SAVE);
  const ctx = await browser.newContext({ viewport:{ width:900, height:1200 } });
  const page = await ctx.newPage();
  const errs = [];
  // Unter file:// scheitert die Versions-Pruefung an der Same-Origin-Regel (sie holt die
  // Spieldatei selbst per fetch). Reine Folge der Testumgebung, im Browser am Server nicht
  // vorhanden - deshalb ausgefiltert, alles andere zaehlt.
  const istUmgebung = t => /blocked by CORS policy|Failed to fetch/.test(t);
  page.on('pageerror', e => { if (!istUmgebung(String(e))) errs.push(String(e)); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !/blocked by CORS policy/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);

  // Welche Boxen gibt es überhaupt? Ein Tippfehler in der ID würde sonst als „kein Inhalt" erscheinen
  // und wäre nicht von einem echten Fehler zu unterscheiden.
  const vorhanden = await page.evaluate(ids => ids.filter(i => !!document.getElementById(i)), BEREICHE.map(b=>b.box));
  for (const b of BEREICHE){
    check('Box "'+b.box+'" ('+b.name+') existiert im DOM', vorhanden.includes(b.box), b.box);
  }

  for (const b of BEREICHE){
    if (!vorhanden.includes(b.box)) continue;
    const vorher = errs.length;
    await page.evaluate(t => { const x = document.querySelector('.tab-btn[data-tab="'+t+'"]'); if (x) x.click(); }, b.tab);
    await page.waitForTimeout(1000);
    const txt = await page.evaluate(id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g,' ').trim() : ''; }, b.box);
    // (1) keine Fehler beim Rendern dieses Bereichs
    check(b.name+': keine JS-Fehler', errs.length === vorher, errs.slice(vorher, vorher+3));
    // (2) der Bereich hat wirklich Inhalt - das ist der Punkt, den der Sweep nicht prüft
    check(b.name+': hat echten Inhalt', b.hat.test(txt), txt.slice(0, 160));
    if (b.leer) check(b.name+': steht NICHT im Leerzustand', !b.leer.test(txt), txt.slice(0, 120));
    // Und keine Platzhalter, die auf unaufgelöste Daten hindeuten.
    check(b.name+': keine undefined/NaN in der Anzeige', !/\bundefined\b|\bNaN\b/.test(txt), (txt.match(/.{0,40}(undefined|NaN).{0,40}/)||[])[0]);
  }

  // Alle Tabs noch einmal durchklicken, jetzt MIT gefüllten Server-Daten - der Sweep macht dasselbe,
  // aber mit leeren. Genau in dieser Differenz lag der Fraktionsladen-Fehler monatelang verborgen.
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.tab-btn')).map(b => b.getAttribute('data-tab')));
  check('Es gibt Tabs zum Durchklicken', tabs.length >= 8, tabs.length);
  for (const t of tabs){
    const vorher = errs.length;
    await page.evaluate(tt => { const b = document.querySelector('.tab-btn[data-tab="'+tt+'"]'); if (b) b.click(); }, t);
    await page.waitForTimeout(500);
    check('Tab '+t+' mit gefüllten Server-Daten fehlerfrei', errs.length === vorher, errs.slice(vorher, vorher+2));
  }

  check('Insgesamt keine JS-Fehler', errs.length === 0, errs.slice(0, 5));
  await ende(async () => { await ctx.close(); await browser.close(); });
})();
