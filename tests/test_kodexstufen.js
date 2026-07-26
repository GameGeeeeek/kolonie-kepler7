// Kodex-Stufen v8.298.12 (Inhaltspaket 2/5). Der Expeditions-Kodex sammelte bis dahin
// AUSSCHLIESSLICH - entdeckte Sonderfunde, gefundene Materialien, abgeschlossene Ketten - und
// belohnte nichts davon. Jetzt hat er sechs einmalig einloesbare Stufen nach dem Vorbild des
// Galaktischen Kompendiums.
//
// Geprueft wird rein rechnerisch (kein Browser):
//   1) jede Stufe hat Icon (Whitelist), vollstaendige Beschreibung und eine erreichbare Schwelle
//   2) die Schwellen liegen im Bereich des tatsaechlich vorhandenen Inhalts - eine Stufe, die man
//      nie erreichen kann, waere schlimmer als keine
//   3) die dauerhaften Boni landen in der GEDECKELTEN additiven Gruppe des Expeditionsertrags und
//      nicht in einer eigenen Multiplikation (CLAUDE.md)
//   4) der Einloese-Marker ueberlebt Prestige UND Aufstieg (sonst Re-Farm nach jedem Reset)
//   5) die Belohnungslogik laeuft wirklich: einloesen, kein zweites Mal, Bonus wirkt
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));

// ---------------------------------------------------------------- Stufen ausfuehrbar machen
// Der CODEX_TIERS-Block wird aus der Spieldatei geschnitten und mit Attrappen ausgefuehrt, damit
// Test und Spiel nicht auseinanderlaufen koennen (gleiches Vorgehen wie test_expeditionsverluste).
const von = src.indexOf('const CODEX_TIERS = [');
const bis = src.indexOf('function claimCodexTier', von);
check('Kodex-Block in der Spieldatei gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

const SPECIALS_TOTAL = ((src.match(/const EXPEDITION_SPECIAL_EVENTS = \[[\s\S]*?\n  \];/) || [''])[0].match(/\{ key:'/g) || []).length;
const RARE_FINDBAR = [...((src.match(/const RARE_ITEMS = \[[\s\S]*?\n  \];/) || [''])[0]).matchAll(/chance:([\d.]+)/g)]
  .map(m => parseFloat(m[1])).filter(c => c !== 0).length;
check('Bestandszahlen aus der Spieldatei gelesen', SPECIALS_TOTAL > 40 && RARE_FINDBAR >= 4,
  { SPECIALS_TOTAL, RARE_FINDBAR });

function baueUmgebung(codex, claimed){
  const ctx = {};
  const state = { codexClaimed: claimed || {} };
  new Function('ctx', 'state', 'ensureExpeditionCodex', 'EXPEDITION_SPECIAL_EVENTS', 'RARE_ITEMS', block +
    ';ctx.TIERS=CODEX_TIERS;ctx.need=codexTierNeed;ctx.done=codexTierDone;ctx.claimed=codexTierClaimed;ctx.bonus=codexExpeditionBonus;'
  )(ctx, state, () => codex, new Array(SPECIALS_TOTAL).fill(0).map((_, i) => ({ key: 's' + i })),
    new Array(RARE_FINDBAR).fill(0).map((_, i) => ({ key: 'r' + i, chance: 0.01 })));
  return { ctx, state };
}

const leer = { specials:{}, rares:{}, chainCompleted:0, signalsFollowed:0 };
const { ctx } = baueUmgebung(leer, {});
const TIERS = ctx.TIERS;
check('1: sieben Kodex-Stufen definiert', TIERS.length === 7, TIERS.length);
check('1: jede Stufe hat ein Icon aus der Whitelist',
  TIERS.every(t => whitelist.has(t.icon)), TIERS.filter(t => !whitelist.has(t.icon)).map(t => t.key + '=' + t.icon));
check('1: jede Stufe hat eine vollständige Beschreibung mit Belohnungsangabe',
  TIERS.every(t => t.desc && t.desc.length >= 60 && /Belohnung/.test(t.desc)),
  TIERS.filter(t => !t.desc || t.desc.length < 60).map(t => t.key));
check('1: keine doppelten Stufen-Schlüssel',
  new Set(TIERS.map(t => t.key)).size === TIERS.length);

// ---------------------------------------------------------------- 2) Schwellen erreichbar
const zuHoch = TIERS.filter(t => {
  const n = ctx.need(t);
  if (!Number.isFinite(n) || n <= 0) return true;
  if (t.key.startsWith('specials')) return n > SPECIALS_TOTAL;
  if (t.key === 'raresAll') return n > RARE_FINDBAR;
  return false;
});
check('2: jede Schwelle ist mit dem vorhandenen Inhalt erreichbar', zuHoch.length === 0,
  zuHoch.map(t => t.key + ' braucht ' + ctx.need(t)));
check('2: die Vollständigkeits-Stufen zählen gegen den echten Bestand, nicht gegen eine feste Zahl',
  ctx.need(TIERS.find(t => t.key === 'specialsAll')) === SPECIALS_TOTAL &&
  ctx.need(TIERS.find(t => t.key === 'raresAll')) === RARE_FINDBAR);

// ---------------------------------------------------------------- 3) Bonus in der richtigen Gruppe
check('3: der Kodex-Bonus fließt in die additive Bonus-Gruppe des Expeditionsertrags',
  /officerBonus\('aufklaerer'\) \+ codexExpeditionBonus\(\)\)/.test(src));
const summe = TIERS.reduce((a, t) => a + (t.reward.expBonus || 0), 0);
check('3: der dauerhafte Gesamtbonus bleibt maßvoll (<= 15%)', summe > 0 && summe <= 0.15,
  { gesamt: +(summe * 100).toFixed(0) + '%' });

// ---------------------------------------------------------------- 4) Reset-Sicherheit
const resets = (src.match(/const keepCodex = state\.codexClaimed/g) || []).length;
check('4: der Einlöse-Marker wird bei Prestige UND Aufstieg gerettet', resets === 2, { stellen: resets });
check('4: und beim Neuaufbau des Zustands wieder eingesetzt',
  (src.match(/codexClaimed: keepCodex\|\|\{\}/g) || []).length === 2);
check('4: mit Vorgabewert für Altstände', /state\.codexClaimed = \{\}/.test(src));

// ---------------------------------------------------------------- 5) Verhalten
const voll = { specials:{}, rares:{}, chainCompleted:5, signalsFollowed:20 };
for (let i = 0; i < SPECIALS_TOTAL; i++) voll.specials['s' + i] = 1;
for (let i = 0; i < RARE_FINDBAR; i++) voll.rares['r' + i] = 1;
const u2 = baueUmgebung(voll, {});
check('5: mit vollständigem Kodex sind alle Stufen erreicht',
  u2.ctx.TIERS.every(t => u2.ctx.done(t)), u2.ctx.TIERS.filter(t => !u2.ctx.done(t)).map(t => t.key));
check('5: ohne Fortschritt ist keine Stufe erreicht',
  baueUmgebung(leer, {}).ctx.TIERS.every(t => !baueUmgebung(leer, {}).ctx.done(t)));
check('5: nicht eingelöste Stufen geben keinen Bonus', u2.ctx.bonus() === 0);
const allesGeholt = {}; TIERS.forEach(t => { allesGeholt[t.key] = true; });
const u3 = baueUmgebung(voll, allesGeholt);
check('5: eingelöste Stufen ergeben zusammen den erwarteten Bonus',
  Math.abs(u3.ctx.bonus() - summe) < 1e-9, { bonus: u3.ctx.bonus(), erwartet: summe });
// Teilweise eingelöst: nur die geholten zählen.
const u4 = baueUmgebung(voll, { specials30: true });
check('5: ein Teil-Einlösen zählt auch nur zum Teil',
  Math.abs(u4.ctx.bonus() - 0.03) < 1e-9, { bonus: u4.ctx.bonus() });
check('5: claimCodexTier verweigert das zweite Einlösen',
  /if \(state\.codexClaimed\[key\]\) return;/.test(src));
check('5: und verweigert nicht erreichte Stufen',
  /if \(!codexTierDone\(t\)\)\{ log\('Diese Kodex-Stufe ist noch nicht erreicht/.test(src));

// ---------------------------------------------------------------- 6) Hilfe mitgezogen
check('6: die Hilfe erklärt die Kodex-Stufen',
  /sieben <strong>Stufen<\/strong>/.test(src) && /dauerhaften Beutebonus/.test(src));
// Die Hilfe nennt die Summe der Beuteboni als Zahl - genau die Sorte zweite Anzeigestelle, die beim
// Hinzufuegen einer Stufe stehen bleibt (CLAUDE.md Regel 6). Gegen den echten Wert pruefen.
check('6: und nennt die richtige Gesamtsumme der Beuteboni',
  new RegExp('zusammen bis zu \\+' + Math.round(summe*100) + '%').test(src),
  { erwartet: Math.round(summe*100)+'%' });

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
