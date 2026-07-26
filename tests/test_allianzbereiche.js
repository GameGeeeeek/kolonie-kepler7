// Allianz-Anzeigebereiche mit ECHTEN Daten v8.298.31.
//
// Fortsetzung von test_serverbereiche.js. Die dortige Nachsorge zum leeren Fraktionsbereich hat acht
// serverabhaengige Bereiche abgedeckt, die Allianz-Bereiche aber ausgelassen: sie brauchen einen
// vollstaendigen Allianz-Datensatz im GETEILTEN Speicher (alliance:<TAG>:...), nicht bloss eine
// Endpunkt-Antwort. Genau deshalb sind sie bisher in JEDEM Test leer geblieben - und damit ist der
// gesamte Allianz-Rendercode nie ausgefuehrt worden. Dieselbe blinde Stelle, in der der
// Fraktionsladen-Fehler von v8.298.22 bis v8.298.28 unentdeckt lag.
//
// Geprueft wird je Bereich dasselbe Paar wie dort:
//   1. keine JS-Fehler
//   2. der Bereich hat WIRKLICH INHALT und steht nicht in seinem Leerzustand
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const now = Date.now();
const TAG = 'VOID';
const UID = 'u';
const STD = 3600 * 1000;

// ---------------------------------------------------------------- Allianz-Datensatz
// Eine gut ausgebaute Allianz: gegruendete Basis mit Beitraegen, laufende Forschung, aktiver Raid,
// aktiver Musterangriff, ein erklaerter Krieg. So rendert jeder Bereich seinen VOLLEN Zweig statt
// des jeweiligen "noch nichts da"-Falls.
const MITGLIEDER = [
  { id:UID,      name:'AdmiralX',     role:'admin',   score:980000, joinedAt: now-40*24*STD },
  { id:'m2',     name:'HandelsHans',  role:'officer', score:640000, joinedAt: now-30*24*STD },
  { id:'m3',     name:'NovaKind',     role:'member',  score:310000, joinedAt: now-12*24*STD }
];
const INFO = { name:'Void Syndikat', tag:TAG, description:'Wir halten den Rand der Karte.',
               joinMode:'open', color:'#c3bef5', level:6, members: MITGLIEDER, createdAt: now-45*24*STD };
const BASE = {
  foundedAt: now - 30*24*STD, sector: 3, system:'kepler',
  contributions: {
    [UID]:  { erz:900000, kristalle:600000, deuterium:300000, antimaterie:20000 },
    m2:     { erz:400000, kristalle:250000, deuterium:120000, antimaterie:8000 },
    m3:     { erz:120000, kristalle:80000,  deuterium:40000,  antimaterie:2000 }
  },
  readyAtByLevel: { 1: now-29*24*STD, 2: now-25*24*STD, 3: now-20*24*STD, 4: now-14*24*STD },
  resourcesReadyForLevel: 4, resourcesReadyAt: now-14*24*STD,
  buildings: { schild:4, geschuetz:3, werft:2 }, hp: 48000, maxHp: 52000
};
const PUNKTE = { points: 42000, spent: 12000, techs: { a_prod:6, a_def:4, a_storage:5, ep_handel:3 } };
const UNLOCKED = { titles:['veteran','pionier'], skins:['gold'] };
// Die Feldnamen stammen aus renderAllianceRaidBox selbst (doc.level/hp/maxHp/targetSector/
// expiresAt/gatherEndsAt/waveNumber). Das Dokument erzeugt der Server, seine Form ist hier also nur
// ueber die Leseseite belegbar - genau deshalb ist die undefined/NaN-Pruefung unten so wertvoll:
// die erste Fassung dieser Attrappe hatte sich bossKey/dispatchAt ausgedacht, und die Anzeige zeigte
// "Stufe undefined", "NaN / NaN HP" und "Standort: undefined" - ohne einen einzigen JS-Fehler.
const RAID = { id:'raid1', phase:'gathering', level:3, waveNumber:1,
               hp: 820000, maxHp: 1200000, targetSector:'sirius',
               expiresAt: now + 60*STD, gatherEndsAt: now + 1800000,
               participants: { [UID]:{ name:'AdmiralX', fleet:{ jaeger:200, bomber:50 }, joinedAt: now-1700000 },
                               m2:{ name:'HandelsHans', fleet:{ jaeger:150 }, joinedAt: now-1600000 } } };
const MUSTER = { phase:'gathering', targetTag:'IRON', createdBy:UID, createdAt: now-900000,
                 dispatchAt: now+900000,
                 participants: { [UID]:{ name:'AdmiralX', fleet:{ jaeger:180, zerstoerer:20 }, joinedAt: now-800000 } } };
const KRIEGE = { enemies: ['IRON'] };
const CHRONIK = { entries: [
  { ts: now-3*24*STD, text:'Allianzbasis auf Stufe 4 ausgebaut.' },
  { ts: now-9*24*STD, text:'NovaKind ist beigetreten.' }
] };
const AUDIT = { entries: [{ ts: now-2*24*STD, actor:'AdmiralX', action:'banner_change', detail:'nebula' }] };

const FESTE_SCHLUESSEL = {
  ['alliance:'+TAG+':info']:     JSON.stringify(INFO),
  ['alliance:'+TAG+':base']:     JSON.stringify(BASE),
  ['alliance:'+TAG+':points']:   JSON.stringify(PUNKTE),
  ['alliance:'+TAG+':unlocked']: JSON.stringify(UNLOCKED),
  ['alliance:'+TAG+':raid']:     JSON.stringify(RAID),
  ['alliance:'+TAG+':musterattack']: JSON.stringify(MUSTER),
  ['alliance:'+TAG+':wars']:     JSON.stringify(KRIEGE),
  ['alliance:'+TAG+':chronicle']: JSON.stringify(CHRONIK),
  ['alliance:'+TAG+':auditlog']:  JSON.stringify(AUDIT),
  ['alliance:'+TAG+':banner']:    'nebula',
  // Mitglieder sind EIGENE Dokumente alliance:<TAG>:role:<playerId> mit { playerId, name, role,
  // joinedAt } - nicht ein members-Array in :info. Mit dem Array stand dort "Keine Mitglieder
  // gefunden.", ohne dass irgendetwas krachte.
  ['alliance:'+TAG+':role:'+UID]: JSON.stringify({ playerId:UID, name:'AdmiralX',    role:'admin',   joinedAt: now-40*24*STD }),
  ['alliance:'+TAG+':role:m2']:   JSON.stringify({ playerId:'m2', name:'HandelsHans', role:'officer', joinedAt: now-30*24*STD }),
  ['alliance:'+TAG+':role:m3']:   JSON.stringify({ playerId:'m3', name:'NovaKind',    role:'member',  joinedAt: now-12*24*STD }),
  ['alliance:IRON:info']:         JSON.stringify({ name:'Eisernes Kollektiv', tag:'IRON' }),
  ['alliance:IRON:role:x']:       JSON.stringify({ playerId:'x', name:'Feind', role:'admin', joinedAt: now-20*24*STD }),
  ['alliance:IRON:wars']:         JSON.stringify({ enemies:[TAG] })
};

function backend(store){
  return async r => {
    const req = r.request();
    const url = req.url();
    const p = url.split('/api/')[1].split('?')[0];
    const query = (url.split('?')[1]||'');
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:UID, username:'AdmiralX', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ factions:{}, news:[], controlledSystems:{} });
    if (p === 'reports') return j({ reports: [] });
    if (p === 'messages') return j({ messages: [] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'storage-list'){
      const pre = decodeURIComponent((query.match(/prefix=([^&]*)/)||[])[1] || '');
      const alle = Object.keys(Object.assign({}, FESTE_SCHLUESSEL, store));
      return j({ keys: alle.filter(k => k.startsWith(pre)) });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (FESTE_SCHLUESSEL[k] !== undefined) return j({ key:k, value:FESTE_SCHLUESSEL[k], version:1 });
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|ranking|halloffame|bounty|friends|notifications/.test(p)) return j([]);
    return j({});
  };
}

const SAVE = {
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:480000, erz:520000, kristalle:310000, deuterium:200000, antimaterie:9000, forschungspunkte:22000 },
  buildings:{ solar:20, mine:20, kristallmine:18, deutsynth:15, labor:12, lager:14, werft:10, hangar:8, habitat:10 },
  research:{ rsolar:8, rerz:8, rbauplan:5 },
  fleet:{ jaeger:400, bomber:120, zerstoerer:60, schlachtschiff:30, missions:[] },
  colonies:{}, activeBasePlanet:'home',
  player:{ id:UID, name:'AdmiralX', allianceTag:TAG, allianceRole:'admin', avatarKey:'crown' },
  allianceTag: TAG, allianceRole:'admin',
  battleStats:{ wins:120, losses:14 }, expeditionsCompleted:40,
  xp:520000, credits:840000, prestige:6, buffs:[], lastTick:now, colonyNames:{},
  officers:{ admiral:6, ingenieur:5 }, commandPoints:25, moduleFragments:60
};

// Bereich, Unterreiter (falls nötig), Box-ID, Beleg für echten Inhalt, Leertext der nicht kommen darf.
const BEREICHE = [
  { name:'Mitgliederliste', box:'allianceMembersBox', hat:/HandelsHans[\s\S]*NovaKind/, leer:/Keine Mitglieder|lädt/ },
  { name:'Allianzbasis',    box:'allianceBaseBox',    hat:/Stufe|Ausbau/,               leer:/Noch keine Allianzbasis/ },
  { name:'Basis-Hero',      box:'allianceBaseHeroBox',hat:/Stufe/,                      leer:null },
  { name:'Allianzforschung',box:'allianceTechBox',    hat:/\d/,                          leer:null },
  { name:'Allianz-Raid',    box:'allianceRaidBox',    hat:/AdmiralX|Teilnehm|Sammel/,   leer:/Kein Raid|lädt/ },
  { name:'Musterangriff',   box:'allianceMusterBox',  hat:/IRON|Sammel|AdmiralX/,       leer:null },
  { name:'Allianz-Kriege',  box:'allianceWarsBox',    hat:/IRON/,                        leer:/Keine Kriege/ }
];

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify(SAVE);
  const ctx = await browser.newContext({ viewport:{ width:900, height:1400 } });
  const page = await ctx.newPage();
  const errs = [];
  const istUmgebung = t => /blocked by CORS policy|Failed to fetch|Failed to load resource/.test(t);
  page.on('pageerror', e => { if (!istUmgebung(String(e))) errs.push(String(e)); });
  page.on('console', m => { if (m.type() === 'error' && !istUmgebung(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);

  // Erst die Unterreiter des Allianz-Tabs durchklicken, damit alle Boxen einmal gerendert wurden.
  const subtabs = await page.evaluate(() => Array.from(document.querySelectorAll('#allianceSubtabBar [data-alliance-subtab]'))
    .map(b => b.getAttribute('data-alliance-subtab')));
  check('Der Allianz-Tab hat Unterreiter', subtabs.length >= 2, subtabs);
  for (const st of subtabs){
    const vorher = errs.length;
    await page.evaluate(s => { const b = document.querySelector('#allianceSubtabBar [data-alliance-subtab="'+s+'"]'); if (b) b.click(); }, st);
    await page.waitForTimeout(700);
    check('Unterreiter '+st+' rendert fehlerfrei', errs.length === vorher, errs.slice(vorher, vorher+2));
  }

  // Jetzt die einzelnen Bereiche einsammeln (die Boxen bleiben im DOM, auch wenn der Unterreiter
  // gerade nicht sichtbar ist - gerendert wurden sie beim Durchklicken oben).
  const inhalte = await page.evaluate(ids => {
    const o = {};
    for (const id of ids){ const e = document.getElementById(id); o[id] = e ? e.textContent.replace(/\s+/g,' ').trim() : null; }
    return o;
  }, BEREICHE.map(b => b.box));

  for (const b of BEREICHE){
    const txt = inhalte[b.box];
    check(b.name+': Box "'+b.box+'" existiert', txt !== null, b.box);
    if (txt === null) continue;
    check(b.name+': hat echten Inhalt', b.hat.test(txt), txt.slice(0, 160));
    if (b.leer) check(b.name+': steht NICHT im Leerzustand', !b.leer.test(txt), txt.slice(0, 120));
    check(b.name+': keine undefined/NaN in der Anzeige', !/\bundefined\b|\bNaN\b/.test(txt),
      (txt.match(/.{0,40}(undefined|NaN).{0,40}/)||[])[0]);
  }

  check('Insgesamt keine JS-Fehler im Allianz-Tab', errs.length === 0, errs.slice(0, 5));
  await ende(async () => { await ctx.close(); await browser.close(); });
})();
