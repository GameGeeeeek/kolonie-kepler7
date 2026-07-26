// Gunstmarken und Fraktionsläden v8.298.22 (Fraktions-Ausbau, Paket 4/6).
//
// Bis hierher endete jede Fraktionsbeziehung in einem passiven Prozentwert - Ruf war ein Schalter,
// kein Ziel. Der Laden gibt dem System eine eigene Fortschrittsschleife und macht die vier
// Fraktionen zu GRUENDEN, unterschiedlich zu spielen.
//
// Geprueft wird:
//   1) vier Laeden mit je vier Posten, alle mit Icon (Whitelist), Beschreibung, Preis und Stufe
//   2) jeder Laden fuehrt Ware, die zu seiner Fraktion passt (kein Waffenmodul beim Haendler)
//   3) genau EIN Spitzenposten je Laden ist Verbuendeten vorbehalten
//   4) Kauflogik: Ruf-Stufe noetig, Marken noetig, Abbuchung stimmt
//   5) FEHLGESCHLAGENE Kaeufe buchen KEINE Marken ab (derselbe Grundsatz wie beim Pakt-Geschenk)
//   6) Marken sind nicht zwischen Fraktionen uebertragbar
//   7) Marken kommen aus Auftraegen und Parteinahme - den beiden Taetigkeiten aus Paket 1 und 3
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));

// ---------------------------------------------------------------- Block ausführbar machen
const von = src.indexOf('const FAVOR_PER_TIER = {');
const bis = src.indexOf('const REP_MIN = -100', von);
check('Laden-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

function baue(opts){
  opts = opts || {};
  const ctx = {};
  const state = {
    factionFavor: Object.assign({}, opts.favor || {}),
    credits: 0, moduleFragments: 0, commandPoints: 0, modules: {},
    resources: { forschungspunkte:0, quantenchips:0, nanolegierungen:0 },
    factionShopPurchases: 0
  };
  const meldungen = [];
  const protokoll = { signale: 0 };
  new Function('ctx', 'state', 'log', 'fmt', 'playSound', 'checkAchievements', 'render', 'save',
    'factionEffectLevel', 'factionNameOf', 'maybeSpawnSignal', 'moduleInstanceInfo',
    block + ';ctx.SHOPS=FACTION_SHOPS;ctx.FAVOR=FAVOR_PER_TIER;ctx.WAR=FAVOR_WAR_SUPPORT;' +
    'ctx.favorOf=factionFavorOf;ctx.add=addFactionFavor;ctx.buy=buyFactionShopItem;ctx.item=factionShopItem;ctx.gibModul=gibModul;'
  )(ctx, state, (t)=>meldungen.push(t), (n)=>String(n), ()=>{}, ()=>{}, ()=>{}, ()=>{},
    (fid) => (opts.stufe || {})[fid] !== undefined ? opts.stufe[fid] : (opts.stufeAlle !== undefined ? opts.stufeAlle : 2),
    (fid) => fid,
    () => { if (opts.signalVoll) return null; protokoll.signale++; return { typ:{name:'Materialpeilung'}, sys:{name:'Testsystem'} }; },
    (k) => ({ rar:{label:k.split(':')[1]}, def:{name:k.split(':')[0]} }));
  return { ctx, state, meldungen, protokoll };
}

const u = baue();
const SHOPS = u.ctx.SHOPS;
const FRAKTIONEN = ['kartell','legion','void','schatten'];

// ---------------------------------------------------------------- 1) Form
check('1: jede Fraktion hat einen Laden mit vier Posten',
  FRAKTIONEN.every(f => Array.isArray(SHOPS[f]) && SHOPS[f].length === 4),
  FRAKTIONEN.map(f => f+'='+((SHOPS[f]||[]).length)));
const alle = FRAKTIONEN.flatMap(f => SHOPS[f].map(p => ({ f, p })));
check('1: jeder Posten hat Icon aus der Whitelist, Name, Beschreibung, Preis und Stufe',
  alle.every(({p}) => whitelist.has(p.icon) && p.name && p.desc && p.kosten > 0 && (p.stufe === 1 || p.stufe === 2)),
  alle.filter(({p}) => !(whitelist.has(p.icon) && p.name && p.desc && p.kosten > 0)).map(({f,p}) => f+':'+p.key));
// CLAUDE.md Regel 7: vollstaendige, selbsterklaerende Beschreibung
check('1: jede Beschreibung ist ein ganzer Satz, der die Wirkung nennt',
  alle.every(({p}) => p.desc.length >= 60), alle.filter(({p}) => p.desc.length < 60).map(({f,p}) => f+':'+p.key+'='+p.desc.length));
check('1: keine doppelten Schlüssel je Laden',
  FRAKTIONEN.every(f => new Set(SHOPS[f].map(p=>p.key)).size === 4));
check('1: jeder Posten hat eine gib()-Funktion', alle.every(({p}) => typeof p.gib === 'function'));

// ---------------------------------------------------------------- 2) Passende Ware
const gibText = (p) => String(p.gib);
check('2: der Händler führt keine Waffen- oder Panzerungsmodule',
  !SHOPS.kartell.some(p => /'waffen'|'panzerung'/.test(gibText(p))), SHOPS.kartell.map(p=>p.key));
check('2: die Legion führt Kampfausrüstung',
  SHOPS.legion.filter(p => /'waffen'|'panzerung'/.test(gibText(p))).length >= 3, SHOPS.legion.map(p=>p.key));
check('2: der Void-Zirkel führt Expeditionsausrüstung',
  SHOPS.void.filter(p => /'sonde'|maybeSpawnSignal|forschungspunkte/.test(gibText(p))).length >= 3, SHOPS.void.map(p=>p.key));
check('2: das Schatten-Syndikat führt verdeckte Ware',
  SHOPS.schatten.filter(p => /quantenchips|'expschutz'|'treibstoffdepot'|credits/.test(gibText(p))).length >= 3, SHOPS.schatten.map(p=>p.key));
// Kein Posten darf zweimal exakt dasselbe liefern - sonst waeren zwei Laeden austauschbar.
const modulPosten = alle.map(({f,p}) => (gibText(p).match(/gibModul\('([a-z]+)', ?'([a-z]+)'\)/)||[])[0]).filter(Boolean);
check('2: kein Modul-Posten kommt in zwei Läden doppelt vor', new Set(modulPosten).size === modulPosten.length, modulPosten);

// ---------------------------------------------------------------- 3) Spitzenposten
FRAKTIONEN.forEach(f => {
  const nurVerb = SHOPS[f].filter(p => p.stufe === 2);
  check('3: '+f+' hat genau EINEN Posten nur für Verbündete', nurVerb.length === 1, nurVerb.map(p=>p.key));
  check('3: '+f+' – der Spitzenposten ist auch der teuerste',
    nurVerb[0] && nurVerb[0].kosten === Math.max(...SHOPS[f].map(p=>p.kosten)),
    SHOPS[f].map(p=>p.key+'='+p.kosten));
});

// ---------------------------------------------------------------- 4) Kauflogik
const kauf = baue({ favor:{ kartell: 10 }, stufeAlle: 1 });
kauf.ctx.buy('kartell', 'kredit');
check('4: ein bezahlbarer Posten wird geliefert und abgebucht',
  kauf.state.credits === 15000 && kauf.ctx.favorOf('kartell') === 8,
  { credits: kauf.state.credits, marken: kauf.ctx.favorOf('kartell') });
check('4: der Kauf wird gezählt', kauf.state.factionShopPurchases === 1);
const arm = baue({ favor:{ kartell: 1 }, stufeAlle: 1 });
arm.ctx.buy('kartell', 'kredit');
check('4: ohne genug Marken passiert nichts',
  arm.state.credits === 0 && arm.ctx.favorOf('kartell') === 1 && /Nicht genug Gunstmarken/.test(arm.meldungen.join('|')));
const nurFreund = baue({ favor:{ kartell: 20 }, stufeAlle: 1 });
nurFreund.ctx.buy('kartell', 'exklusiv');
check('4: der Spitzenposten bleibt Freundlichen verschlossen',
  nurFreund.ctx.favorOf('kartell') === 20 && /nur Verbündeten/.test(nurFreund.meldungen.join('|')), nurFreund.meldungen);
const verb = baue({ favor:{ kartell: 20 }, stufeAlle: 2 });
verb.ctx.buy('kartell', 'exklusiv');
check('4: Verbündete bekommen ihn', verb.ctx.favorOf('kartell') === 12 && !!verb.state.modules['handelsleitstand:episch']);
const neutral = baue({ favor:{ legion: 20 }, stufeAlle: 0 });
neutral.ctx.buy('legion', 'schulung');
check('4: unterhalb von Freundlich ist der Laden ganz zu',
  neutral.ctx.favorOf('legion') === 20 && neutral.state.commandPoints === 0 && /erst ab Freundlich/.test(neutral.meldungen.join('|')));
// Alle Posten einmal durchkaufen - keiner darf werfen oder leer liefern.
const reich = baue({ favor:{ kartell:99, legion:99, void:99, schatten:99 }, stufeAlle: 2 });
let fehler = [];
alle.forEach(({f,p}) => { try { reich.ctx.buy(f, p.key); } catch(e){ fehler.push(f+':'+p.key+' '+e.message); } });
check('4: jeder einzelne Posten lässt sich kaufen', fehler.length === 0, fehler);
check('4: und alle 16 Käufe wurden gezählt', reich.state.factionShopPurchases === 16, reich.state.factionShopPurchases);

// ---------------------------------------------------------------- 5) Fehlschlag kostet nichts
// Der Grundsatz aus v8.298.4 (Pakt-Geschenk): ein Posten, der nicht liefern kann, darf die
// Waehrung nicht verschlucken.
const voll = baue({ favor:{ void: 10 }, stufeAlle: 2, signalVoll: true });
voll.ctx.buy('void', 'peilung');
check('5: schlägt die Lieferung fehl, werden KEINE Marken abgebucht',
  voll.ctx.favorOf('void') === 10, voll.ctx.favorOf('void'));
check('5: und der Spieler erfährt warum',
  /keine Gunstmarken abgebucht|bereits so viele Peilungen/.test(voll.meldungen.join('|')), voll.meldungen);
check('5: der fehlgeschlagene Kauf zählt nicht als Kauf', voll.state.factionShopPurchases === 0);
const klappt = baue({ favor:{ void: 10 }, stufeAlle: 2 });
klappt.ctx.buy('void', 'peilung');
check('5: klappt es, wird normal abgebucht',
  klappt.ctx.favorOf('void') === 7 && klappt.protokoll.signale === 1);

// ---------------------------------------------------------------- 6) Marken bleiben bei ihrer Fraktion
const getrennt = baue({ favor:{ kartell: 20, legion: 0 }, stufeAlle: 2 });
getrennt.ctx.buy('legion', 'schulung');
check('6: Marken einer Fraktion zahlen nicht bei einer anderen',
  getrennt.state.commandPoints === 0 && getrennt.ctx.favorOf('kartell') === 20);
getrennt.ctx.add('legion', 5);
getrennt.ctx.buy('legion', 'schulung');
check('6: mit eigenen Marken klappt es', getrennt.state.commandPoints === 40 && getrennt.ctx.favorOf('legion') === 2);
check('6: Marken werden nie negativ',
  (() => { const b = baue({ favor:{ legion: 3 }, stufeAlle: 2 }); b.ctx.buy('legion','elite'); return b.ctx.favorOf('legion') === 3; })());

// ---------------------------------------------------------------- 7) Woher die Marken kommen
check('7: die Stufen geben unterschiedlich viele Marken',
  u.ctx.FAVOR.bronze < u.ctx.FAVOR.silber && u.ctx.FAVOR.silber < u.ctx.FAVOR.gold, u.ctx.FAVOR);
check('7: eine Parteinahme im Krieg lohnt sich in Marken', u.ctx.WAR >= u.ctx.FAVOR.silber, u.ctx.WAR);
check('7: Aufträge schreiben die Marken gut',
  /const marken = FAVOR_PER_TIER\[q\.tier\] \|\| 1;\n    addFactionFavor\(fid, marken\);/.test(src));
check('7: und die Abschluss-Meldung nennt sie',
  /'\+'\+marken\+' Gunstmarke'\+\(marken===1\?'':'n'\)/.test(src));
check('7: die Parteinahme ebenfalls',
  /addFactionFavor\(fid, FAVOR_WAR_SUPPORT\);/.test(src) && /\+'\+FAVOR_WAR_SUPPORT\+' Gunstmarken/.test(src));
// Der Preis eines Spitzenpostens soll erreichbar, aber kein Selbstlaeufer sein.
const gold = u.ctx.FAVOR.gold, spitzenpreis = SHOPS.kartell.find(p=>p.stufe===2).kosten;
check('7: ein Spitzenposten kostet mehrere Aufträge, aber keine Ewigkeit',
  spitzenpreis >= 2*gold && spitzenpreis <= 6*gold, { spitzenpreis, gold });

// ---------------------------------------------------------------- 8) Verdrahtung und Anzeige
check('8: die Peilung nutzt denselben Spawn-Pfad wie das Zufalls-Signal',
  /function maybeSpawnSignal\(erzwingen\)/.test(src) && /const garantiert = erzwingen \|\| state\.signalDrought/.test(src));
check('8: gekaufte Module landen im normalen Inventar',
  /state\.modules\[instKey\] = \(state\.modules\[instKey\]\|\|0\) \+ 1;/.test(src));
check('8: der Laden ist aufklappbar und sitzungslokal (kein Spielstand)',
  /let offenerFraktionsladen = null;/.test(src) && !/state\.offenerFraktionsladen/.test(src));
check('8: Kopfzeile und Kauf-Knöpfe sind verdrahtet',
  /\[data-shop-toggle\]/.test(src) && /\[data-shop-buy\]/.test(src));
check('8: die Karte zeigt den Markenstand', /\$\{marken\} Gunstmarke\$\{marken===1\?'':'n'\}/.test(src));
check('8: gesperrte Posten sagen, woran es liegt',
  /erst ab Verbündet.*erst ab Freundlich|erst ab Freundlich/.test(src) && /noch '\+\(p\.kosten-marken\)\+' fehlen/.test(src));
check('8: beide neuen Zustandsfelder haben einen Vorgabewert',
  (src.match(/if \(!state\.factionFavor \|\| typeof state\.factionFavor !== 'object'\) state\.factionFavor = \{\};/g)||[]).length === 2 &&
  (src.match(/if \(state\.factionShopPurchases === undefined\) state\.factionShopPurchases = 0;/g)||[]).length === 2);
check('8: die Hilfe erklärt Marken und Läden',
  /title:'Gunstmarken & Fraktionsläden'/.test(src) && /nicht übertragbar/.test(src));
check('8: und weist darauf hin, dass ein Fehlkauf nichts kostet',
  /werden <strong>keine Marken abgebucht<\/strong>/.test(src));
check('8: zwei neue Erfolge, mit Kategorie und Icon',
  /key:'gunst10'/.test(src) && /key:'gunstvorrat'/.test(src) &&
  /gunst10:'handel'/.test(src) && /gunst10:'ti-diamond'/.test(src) &&
  /gunstvorrat:'handel'/.test(src) && /gunstvorrat:'ti-star'/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
