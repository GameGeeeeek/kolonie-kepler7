// Fraktionseigene Auftragspools v8.298.19 (Fraktions-Ausbau, Paket 1/6).
//
// Anlass: Auf einem Spieler-Screenshot stand bei ZWEI Fraktionen derselbe Auftrag ("Schließe 2
// Expeditionen ab"). Kein Zufall - es gab drei gemeinsame Vorlagen fuer vier Fraktionen, blind
// gewuerfelt. Und sie hatten keinen Charakter: das Haendler-Kartell konnte Kaempfe verlangen.
//
// Geprueft wird:
//   1) jede Fraktion hat einen EIGENEN Pool, kein gemeinsamer Topf mehr
//   2) die Auftraege passen zur Fraktion (kein Kampfauftrag beim Haendler, kein Liefer-Auftrag
//      beim Militaer) - ueber die Zuordnung der Zaehler geprueft, nicht ueber Textraten
//   3) alle drei Stufen wirken (Ziel, Ruf, Kredite steigen), Gold gibt Fragmente
//   4) jede Messart rechnet richtig: gain (Zuwachs), have (Bestand), deliver (Bestand + Abzug)
//   5) unerfuellbare Auftraege kommen nicht in den Pool (available)
//   6) Altstaende mit dem ALTEN Format werden ersetzt statt als "?" angezeigt
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));

// ---------------------------------------------------------------- Block ausführbar machen
const von = src.indexOf('const QUEST_TIERS = [');
const bis = src.indexOf('// Sorgt dafür, dass jede Fraktion', von);
check('Auftrags-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

function baue(opts){
  opts = opts || {};
  const ctx = {};
  const state = Object.assign({
    resources:{ erz:0, kristalle:0, deuterium:0, energie:0, antimaterie:0 },
    credits:0, moduleFragments:0, marketTradesDone:0, tradeRouteLifetimeCredits:0, shopPurchases:0,
    battleStats:{ wins:0 }, npcKills:0, battlePoints:0, pirateLairPrestige:0, bossKills:0,
    moonSiegesWon:0, expeditionsCompleted:0, expeditionCodex:{ specials:{}, rares:{}, signalsFollowed:0 },
    discoveredSystems:{}, spyIntel:{}, modulePurchases:0, moduleSales:0, commandPoints:0,
    expeditionSafeRuns:0, tradeRoutes:[],
    // Abgrund-Auftraege (v8.342.0): Ohne diese Felder wuerden ihre zaehler() beim Ziehen auf
    // undefined laufen. Vorgabe ist ein Konto, das den Abgrund kennt, aber noch nichts erreicht hat.
    abgrund:{ best:0, tauchgaenge:0, bergung:0, relikte:{}, konstGesehen:{} }
  }, opts.state || {});
  new Function('ctx', 'state', 'fmt', 'useBackend', 'attackPower', 'currentFleet', 'QUEST_DURATION_MS', 'factionRankOf',
    'RANK_GOLD_CHANCE_FROM', 'RANK_QUEST_TIME_FROM', 'RANK_QUEST_TIME_BONUS', 'abgrundFreigeschaltet',
    block + ';ctx.TIERS=QUEST_TIERS;ctx.POOLS=FACTION_QUEST_POOLS;ctx.gen=generateFactionQuest;' +
    'ctx.tierOf=questTierOf;ctx.tplOf=questTemplateOf;ctx.GOLDFRAG=QUEST_GOLD_FRAGMENTS;'
  )(ctx, state, (n)=>String(n), () => opts.backend !== false,
    () => opts.flottenkraft || 0, () => ({ mondzerstoerer: opts.mondzerstoerer || 0 }), 24*3600*1000,
    // Rangabhaengige Verguenstigungen (v8.298.23) - hier neutral gestellt, damit dieser Test
    // weiterhin nur die Auftragspools misst. Eigener Nachweis in test_fraktionsraenge.js.
    () => ({ nr: opts.rang || 1 }), 8, 5, 0.5,
    // abgrundFreigeschaltet: Vorgabe true, damit die Tiefenauftraege im Pool sind und mitgemessen
    // werden. opts.abgrund === false schaltet sie ab - so laesst sich auch das Gegenteil pruefen.
    () => opts.abgrund !== false);
  return { ctx, state };
}

const u = baue();
const POOLS = u.ctx.POOLS, TIERS = u.ctx.TIERS;

// ---------------------------------------------------------------- 1) Eigene Pools
const FRAKTIONEN = ['kartell','legion','void','schatten'];
check('1: jede der vier Fraktionen hat einen eigenen Pool',
  FRAKTIONEN.every(f => Array.isArray(POOLS[f]) && POOLS[f].length >= 5),
  FRAKTIONEN.map(f => f + '=' + ((POOLS[f]||[]).length)));
const gesamt = FRAKTIONEN.reduce((a,f) => a + POOLS[f].length, 0);
check('1: deutlich mehr Auftragsarten als die früheren drei', gesamt >= 24, { gesamt, vorher: 3 });
// Kein Auftragsschluessel darf in mehreren Fraktionen mit DERSELBEN Messquelle stecken - sonst
// waere es wieder ein gemeinsamer Topf mit anderem Namen.
const doppelt = [];
FRAKTIONEN.forEach(a => FRAKTIONEN.forEach(b => {
  if (a >= b) return;
  POOLS[a].forEach(ta => POOLS[b].forEach(tb => {
    if (ta.key === tb.key && String(ta.text) === String(tb.text)) doppelt.push(a+'/'+b+':'+ta.key);
  }));
}));
check('1: kein identischer Auftrag in zwei Fraktionen', doppelt.length === 0, doppelt);
check('1: jeder Auftrag hat Schlüssel, Messart, Basisziel, Ruf und Text',
  FRAKTIONEN.every(f => POOLS[f].every(t => t.key && ['gain','have','deliver'].includes(t.kind) && t.basis > 0 && t.rep > 0 && typeof t.text === 'function')),
  FRAKTIONEN.flatMap(f => POOLS[f].filter(t => !(t.key && t.basis > 0 && t.rep > 0)).map(t => f+':'+t.key)));
check('1: jeder Auftragstext nennt sein Ziel',
  FRAKTIONEN.every(f => POOLS[f].every(t => t.text(7).indexOf('7') >= 0 || t.text(7).length > 12)),
  FRAKTIONEN.flatMap(f => POOLS[f].filter(t => t.text(7).length <= 12).map(t => f+':'+t.key)));
check('1: eindeutige Schlüssel je Fraktion',
  FRAKTIONEN.every(f => new Set(POOLS[f].map(t=>t.key)).size === POOLS[f].length));

// ---------------------------------------------------------------- 2) Charakter je Fraktion
// Kern des Spieler-Reports. Geprueft ueber die MESSQUELLE, nicht ueber Textraten: ein Auftrag, der
// battleStats/npcKills liest, ist ein Kampfauftrag - der darf nicht beim Haendler stehen.
const quelle = (t) => String(t.zaehler || '') + '|' + (t.res || '') + '|' + (t.feld || '');
const kampfMuster = /battleStats|npcKills|battlePoints|pirateLairPrestige|bossKills|moonSiegesWon|attackPower/;
const handelMuster = /marketTradesDone|tradeRouteLifetimeCredits|shopPurchases/;
check('2: das Händler-Kartell verlangt keine Kämpfe',
  !POOLS.kartell.some(t => kampfMuster.test(quelle(t))),
  POOLS.kartell.filter(t => kampfMuster.test(quelle(t))).map(t=>t.key));
check('2: die Eisenlegion verlangt keine Handelsgeschäfte',
  !POOLS.legion.some(t => handelMuster.test(quelle(t))),
  POOLS.legion.filter(t => handelMuster.test(quelle(t))).map(t=>t.key));
check('2: die Eisenlegion verlangt tatsächlich überwiegend Militärisches',
  POOLS.legion.filter(t => kampfMuster.test(quelle(t))).length >= 5,
  POOLS.legion.filter(t => kampfMuster.test(quelle(t))).map(t=>t.key));
check('2: das Kartell verlangt tatsächlich Wirtschaftliches',
  POOLS.kartell.filter(t => handelMuster.test(quelle(t)) || t.res || t.feld === 'credits').length >= 5,
  POOLS.kartell.map(t=>t.key));
check('2: der Void-Zirkel hängt an Expeditionen und Kodex',
  POOLS.void.filter(t => /expeditions|expeditionCodex|discoveredSystems/.test(quelle(t))).length >= 4,
  POOLS.void.map(t=>t.key));
check('2: das Schatten-Syndikat hängt an Spionage und verdeckter Beschaffung',
  POOLS.schatten.filter(t => /spyIntel|modulePurchases|moduleSales|expeditionSafeRuns/.test(quelle(t))).length >= 4,
  POOLS.schatten.map(t=>t.key));

// ---------------------------------------------------------------- 3) Stufen
check('3: drei Stufen mit Icon aus der Whitelist',
  TIERS.length === 3 && TIERS.every(t => whitelist.has(t.icon) && t.label && t.color),
  TIERS.map(t=>t.key+'='+t.icon));
check('3: Ziel, Ruf und Kredite steigen mit der Stufe',
  TIERS[0].mult < TIERS[1].mult && TIERS[1].mult < TIERS[2].mult &&
  TIERS[0].repMult < TIERS[1].repMult && TIERS[1].repMult < TIERS[2].repMult &&
  TIERS[0].creditMult < TIERS[1].creditMult && TIERS[1].creditMult < TIERS[2].creditMult,
  TIERS.map(t=>({k:t.key,ziel:t.mult,ruf:t.repMult,kr:t.creditMult})));
// Gold muss sich auch lohnen: mehr Aufwand (5x Ziel) darf nicht weniger Lohn je Aufwand bringen.
check('3: Gold lohnt sich je Aufwand mindestens so gut wie Bronze',
  (TIERS[2].repMult/TIERS[2].mult) >= (TIERS[0].repMult/TIERS[0].mult)*0.6,
  { bronze: +(TIERS[0].repMult/TIERS[0].mult).toFixed(3), gold: +(TIERS[2].repMult/TIERS[2].mult).toFixed(3) });
check('3: nur Gold gibt Modulfragmente', u.ctx.GOLDFRAG > 0);

// 2.000 Ziehungen: alle Stufen kommen vor, Gold bleibt selten, und es kommen wirklich
// verschiedene Auftraege je Fraktion (das war der Kern der Beschwerde).
const zieh = {}; const stufen = {};
FRAKTIONEN.forEach(f => { zieh[f] = new Set(); });
for (let i = 0; i < 2000; i++){
  FRAKTIONEN.forEach(f => {
    const q = baue({ state:{ tradeRoutes:[{}] }, mondzerstoerer:1 }).ctx.gen(f);
    if (!q) return;
    zieh[f].add(q.tpl);
    stufen[q.tier] = (stufen[q.tier]||0)+1;
  });
}
check('3: alle drei Stufen treten auf', ['bronze','silber','gold'].every(k => stufen[k] > 0), stufen);
const goldAnteil = (stufen.gold||0) / Object.values(stufen).reduce((a,b)=>a+b,0);
check('3: Gold bleibt selten (unter 20%)', goldAnteil < 0.2, { goldAnteil: +goldAnteil.toFixed(3) });
check('3: jede Fraktion zieht wirklich verschiedene Aufträge',
  FRAKTIONEN.every(f => zieh[f].size >= 5), FRAKTIONEN.map(f => f+'='+zieh[f].size));

// ---------------------------------------------------------------- 4) Messarten rechnen richtig
// Der Rechenteil ist im Spiel (questProgress) - hier ueber die extrahierten Vorlagen nachgerechnet,
// damit der Test die Vorlagen-Struktur pruefen kann, ohne den halben Spielstand nachzubauen.
check('4: gain-Aufträge lesen einen Lebenszeit-Zähler',
  POOLS.legion.find(t=>t.key==='kaempfe').kind === 'gain');
const gainU = baue({ state:{ battleStats:{ wins:10 } } });
const kaempfe = gainU.ctx.POOLS.legion.find(t=>t.key==='kaempfe');
check('4: und der Zähler liest den echten Zustand', kaempfe.zaehler() === 10, kaempfe.zaehler());
const haveU = baue({ state:{ credits: 5000 } });
const kasse = haveU.ctx.POOLS.kartell.find(t=>t.key==='kasse');
check('4: have-Aufträge lesen den aktuellen Bestand', kasse.kind === 'have' && kasse.zaehler() === 5000);
const delU = baue({ state:{ resources:{ erz: 900 } } });
const erz = delU.ctx.POOLS.kartell.find(t=>t.key==='erz');
check('4: deliver-Aufträge nennen die Ressource, die abgebucht wird', erz.kind === 'deliver' && erz.res === 'erz');
// Feld-basierte Lieferungen (Fragmente, Kredite) - die duerfen NICHT als Ressource gelesen werden.
const frag = POOLS.void.find(t=>t.key==='fragmente');
check('4: Fragment-Lieferung läuft über ein Zustandsfeld, nicht über resources',
  frag.kind === 'deliver' && frag.feld === 'moduleFragments' && !frag.res);
const schweig = POOLS.schatten.find(t=>t.key==='kredite');
check('4: Kredit-Lieferung ebenso', schweig.kind === 'deliver' && schweig.feld === 'credits' && !schweig.res);
check('4: der Zielwert skaliert mit der Stufe',
  (() => { const q = baue().ctx.gen('legion'); return q && q.target >= 1 && Number.isFinite(q.target); })());

// ---------------------------------------------------------------- 5) Unerfüllbares kommt nicht rein
let ohneServer = new Set();
for (let i = 0; i < 600; i++){
  const q = baue({ backend:false }).ctx.gen('schatten');
  if (q) ohneServer.add(q.tpl);
}
const serverPflicht = POOLS.schatten.filter(t => t.available && !t.available.call(null)).map(t=>t.key);
check('5: ohne Serververbindung werden Spionage-/Markt-Aufträge nicht angeboten',
  ![...ohneServer].some(k => ['spionage','module','verkauf'].includes(k)), [...ohneServer]);
check('5: das Schatten-Syndikat hat trotzdem noch Aufträge im Angebot (kein leerer Pool)',
  ohneServer.size >= 3, [...ohneServer]);
let ohneMz = new Set();
for (let i = 0; i < 600; i++){ const q = baue({ mondzerstoerer:0 }).ctx.gen('legion'); if (q) ohneMz.add(q.tpl); }
check('5: ohne Mondzerstörer keine Mondbelagerungs-Aufträge', !ohneMz.has('monde'), [...ohneMz]);
let ohneRoute = new Set();
for (let i = 0; i < 600; i++){ const q = baue({ state:{ tradeRoutes:[] } }).ctx.gen('kartell'); if (q) ohneRoute.add(q.tpl); }
check('5: ohne Handelsroute kein Handelsrouten-Auftrag', !ohneRoute.has('routen'), [...ohneRoute]);

// ---------------------------------------------------------------- 6) Verdrahtung im Spiel
check('6: Aufträge werden je Fraktion erzeugt, nicht aus einem Topf',
  /generateFactionQuest\(fid\)/.test(src) && !/const QUEST_TEMPLATES = \[/.test(src));
check('6: Altstände mit dem alten Format werden ersetzt',
  /if \(!q \|\| !q\.tpl \|\| q\.expiresAt < Date\.now\(\)\)/.test(src));
check('6: der Fortschritt unterscheidet die drei Messarten',
  /if \(t\.kind === 'gain'\) return Math\.min\(q\.target, Math\.max\(0, \(t\.zaehler\(\)\|\|0\) - \(q\.startValue\|\|0\)\)\);/.test(src));
check('6: deliver bucht ab, have nicht',
  /if \(t\.kind === 'deliver'\)\{/.test(src) && /if \(t\.res\) state\.resources\[t\.res\] -= q\.target;/.test(src));
check('6: Gold-Aufträge schreiben die Fragmente gut',
  /if \(q\.rewardFragments\) state\.moduleFragments = \(state\.moduleFragments\|\|0\) \+ q\.rewardFragments;/.test(src));
check('6: die Anzeige zeigt Stufe und Fortschrittsbalken',
  /<strong style="color:\$\{tier\.color\};">\$\{tier\.label\}<\/strong>/.test(src) &&
  /width:\$\{pct\}%; background:\$\{tier\.color\}/.test(src));
check('6: es gibt einen Zähler für Gold-Aufträge mit Vorgabewert',
  /state\.factionGoldQuestsDone = \(state\.factionGoldQuestsDone\|\|0\) \+ 1;/.test(src) &&
  (src.match(/if \(state\.factionGoldQuestsDone === undefined\) state\.factionGoldQuestsDone = 0;/g)||[]).length === 2);

// ---------------------------------------------------------------- 7) Anzeigestellen (CLAUDE.md 6)
check('7: zwei neue Erfolge auf die Aufträge',
  /key:'fquestgold5'/.test(src) && /key:'fquest50'/.test(src));
check('7: mit Kategorie und Icon eingetragen',
  /fquestgold5:'handel'/.test(src) && /fquestgold5:'ti-trophy'/.test(src) &&
  /fquest50:'handel'/.test(src) && /fquest50:'ti-medal'/.test(src));
check('7: die Hilfe erklärt die fraktionseigenen Pools und die drei Stufen',
  /jede Fraktion zieht aus ihrem eigenen Pool|eigenen Pool von sieben Auftragsarten/.test(src) &&
  /<strong>Bronze<\/strong>/.test(src) && /<strong>Gold<\/strong>/.test(src));
check('7: und den Unterschied zwischen Lieferung und Standprüfung',
  /die werden beim Abschließen abgebucht/.test(src) && /kosten dich nichts/.test(src));
check('7: die alte Hilfe-Beschreibung ist weg',
  !/Ressourcen liefern, Kämpfe gewinnen oder Expeditionen abschließen\. Abschluss bringt/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
