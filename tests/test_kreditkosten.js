// Kredit-Kosten im Kostensystem v8.298.27 (Spieler-Report 26.07.2026).
//
// Vorfall: Das Botschaftsviertel (v8.298.24) war das erste Gebaeude mit einem Kredit-Anteil in
// baseCost. Es liess sich NIE bauen, und die Kostenzeile zeigte "280 credits" auf englisch zwischen
// "6.3k Erz" und "4.5k Kristalle".
//
// Ursache: Kredite liegen in state.credits, NICHT in state.resources. canAfford() las
// state.resources['credits'] -> undefined -> 0 >= 280 -> immer false. pay() haette
// state.resources.credits = undefined - 280 = NaN geschrieben; ein NaN in state.resources ist genau
// das, was der Backend-Sanity-Check ablehnt, und eine dauerhaft abgelehnte Speicherung friert den
// ganzen Spielstand ein (Vorfall 21.07.2026, siehe CLAUDE.md). Nur weil canAfford vorher blockte,
// ist das nie passiert - der Fehler war eine Zeile davon entfernt, schlimmer zu werden.
//
// Bemerkenswert: der Zeitschaetzer (affordHint) kannte den Kredit-Sonderfall schon. Kredit-Kosten
// waren also VORGESEHEN, nur canAfford/pay/resDefFor wurden nie mitverdrahtet.
//
// Geprueft wird:
//   1) canAfford liest Kredite aus state.credits
//   2) pay bucht Kredite von state.credits ab - und schreibt KEIN NaN in state.resources
//   3) gainResources schreibt Kredit-Gutschriften nach state.credits, ohne Lager-Deckel
//   4) die Kostenzeile schreibt "Kredite" mit Icon, nicht "credits"
//   5) die Fehlmengen-Markierung liest denselben Bestand wie canAfford
//   6) das Botschaftsviertel ist mit genug Krediten wirklich bezahlbar - und ohne nicht
//   7) kein DEFS-Kostenposten benutzt einen Schluessel, den das Kostensystem nicht kennt
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Block ausführbar machen
const von = src.indexOf('  function costAmountAvailable(r){');
const bis = src.indexOf('\n  }\n', src.indexOf('  function pay(cost){', von)) + 4;
check('Kosten-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const kostenBlock = src.slice(von, bis);

function baue(opts){
  const o = opts || {};
  const ctx = {};
  const state = {
    credits: o.credits === undefined ? 0 : o.credits,
    resources: Object.assign({ erz:0, kristalle:0, deuterium:0 }, o.res || {})
  };
  new Function('ctx', 'state', kostenBlock + ';ctx.verfuegbar=costAmountAvailable;ctx.canAfford=canAfford;ctx.pay=pay;')(ctx, state);
  return { ctx, state };
}

// ---------------------------------------------------------------- 1: canAfford liest state.credits
{
  const t = baue({ credits: 500, res: { erz: 100 } });
  check('1: costAmountAvailable liefert Kredite aus state.credits', t.ctx.verfuegbar('credits') === 500, t.ctx.verfuegbar('credits'));
  check('1: costAmountAvailable liefert Ressourcen weiterhin aus state.resources', t.ctx.verfuegbar('erz') === 100);
  check('1: eine reine Kredit-Forderung ist mit genug Krediten bezahlbar', t.ctx.canAfford({ credits: 400 }) === true);
  check('1: und mit zu wenigen nicht', t.ctx.canAfford({ credits: 600 }) === false);
  check('1: gemischte Kosten werden korrekt geprüft',
    t.ctx.canAfford({ erz: 100, credits: 400 }) === true && t.ctx.canAfford({ erz: 101, credits: 400 }) === false);
}
// Der eigentliche Fehler: OHNE den Zweig wäre das hier false gewesen, obwohl 500 Kredite da sind.
{
  const t = baue({ credits: 500 });
  check('1: der gemeldete Fehler ist behoben – 400 Kredite sind mit 500 bezahlbar',
    t.ctx.canAfford({ credits: 400 }) === true);
  check('1: state.resources.credits bleibt dabei unangetastet',
    t.state.resources.credits === undefined, t.state.resources.credits);
}

// ---------------------------------------------------------------- 2: pay bucht richtig ab
{
  const t = baue({ credits: 500, res: { erz: 1000 } });
  t.ctx.pay({ erz: 300, credits: 400 });
  check('2: Kredite werden von state.credits abgebucht', t.state.credits === 100, t.state.credits);
  check('2: Ressourcen weiterhin von state.resources', t.state.resources.erz === 700, t.state.resources.erz);
  // Das Entscheidende: KEIN NaN in state.resources. Ein NaN dort laesst das Backend den GESAMTEN
  // Spielstand mit HTTP 400 ablehnen - und dann speichert das Spiel gar nicht mehr.
  check('2: pay schreibt kein NaN in state.resources',
    !Object.values(t.state.resources).some(v => Number.isNaN(v)) && t.state.resources.credits === undefined,
    t.state.resources);
  check('2: und auch state.credits ist keine NaN', !Number.isNaN(t.state.credits));
}

// ---------------------------------------------------------------- 3: gainResources
{
  const g = src.slice(src.indexOf('  function gainResources(gains){'), src.indexOf('\n  }\n', src.indexOf('  function gainResources(gains){')) + 4);
  check('3: gainResources kennt den Kredit-Sonderfall', /if \(r === 'credits'\)\{ state\.credits = \(state\.credits\|\|0\) \+ amt; continue; \}/.test(g));
  const state = { credits: 50, resources: {} };
  new Function('state', 'storageCap', 'TIER2_DEFS', 'tier2StorageCap', g + ';gainResources({ credits: 200, erz: 5000 });')(
    state, () => 1000, [], () => 0);
  check('3: Kredit-Gutschriften landen in state.credits', state.credits === 250, state.credits);
  check('3: Kredite kennen keinen Lager-Deckel (250 > storageCap 1000 wäre sonst geklemmt)', state.credits === 250);
  check('3: Ressourcen klemmen weiterhin am Lager-Deckel', state.resources.erz === 1000, state.resources.erz);
  check('3: gainResources schreibt kein resources.credits', state.resources.credits === undefined);
}

// ---------------------------------------------------------------- 4: Anzeige „Kredite" statt „credits"
{
  const rd = src.slice(src.indexOf('  function resDefFor(key){'), src.indexOf('\n  }\n', src.indexOf('  function resDefFor(key){')) + 4);
  const resDefFor = new Function('RES_DEFS', 'TIER2_DEFS', rd + ';return resDefFor;')([], []);
  check('4: resDefFor kennt Kredite', resDefFor('credits').label === 'Kredite', resDefFor('credits').label);
  check('4: unbekannte Schlüssel fallen weiterhin auf den Schlüssel zurück', resDefFor('quatsch').label === 'quatsch');
  const mi = src.slice(src.indexOf('  function miniResIcon(key){'), src.indexOf('\n  }\n', src.indexOf('  function miniResIcon(key){')) + 4);
  const miniResIcon = new Function('RES_ICONS', mi + ';return miniResIcon;')({});
  check('4: Kredite haben in der Kostenzeile ein Icon', /ti-diamond/.test(miniResIcon('credits')), miniResIcon('credits'));
  // Gegenprobe am echten Aufruf: costHtml baut Icon + Menge + Label zusammen.
  const ch = src.slice(src.indexOf('  function costHtml(cost){'), src.indexOf('\n  }\n', src.indexOf('  function costHtml(cost){')) + 4);
  const costHtml = new Function('resDefFor', 'miniResIcon', 'fmt', 'costAmountAvailable', ch + ';return costHtml;')(
    resDefFor, miniResIcon, n => String(n), () => 0);
  const html = costHtml({ credits: 280 });
  check('4: die Kostenzeile schreibt „280 Kredite"', html.includes('280 Kredite'), html);
  check('4: und nicht mehr „280 credits"', !html.includes('280 credits'));
  check('4: mit Kredit-Icon davor', /ti-diamond/.test(html));
}

// ---------------------------------------------------------------- 5: Fehlmengen-Markierung
check('5: costHtml markiert Fehlmengen über costAmountAvailable',
  /class="costitem\$\{costAmountAvailable\(r\)<a\?' short':''\}"/.test(src));
check('5: der Zeitschätzer liest denselben Bestand', /const have = costAmountAvailable\(r\);/.test(src));
// Ohne das haette die Kostenzeile Kredite IMMER als fehlend rot markiert, auch bei voller Kasse.
{
  const rd = src.slice(src.indexOf('  function resDefFor(key){'), src.indexOf('\n  }\n', src.indexOf('  function resDefFor(key){')) + 4);
  const resDefFor = new Function('RES_DEFS', 'TIER2_DEFS', rd + ';return resDefFor;')([], []);
  const ch = src.slice(src.indexOf('  function costHtml(cost){'), src.indexOf('\n  }\n', src.indexOf('  function costHtml(cost){')) + 4);
  const bauCostHtml = have => new Function('resDefFor', 'miniResIcon', 'fmt', 'costAmountAvailable', ch + ';return costHtml;')(
    resDefFor, () => '', n => String(n), () => have);
  check('5: bei voller Kasse ist die Kredit-Kostenzeile nicht als fehlend markiert',
    !bauCostHtml(500)({ credits: 280 }).includes('short'));
  check('5: bei leerer Kasse schon', bauCostHtml(10)({ credits: 280 }).includes('short'));
}

// ---------------------------------------------------------------- 6: Botschaftsviertel bezahlbar
{
  const def = src.slice(src.indexOf("key:'botschaft'"), src.indexOf("key:'botschaft'") + 900);
  const m = def.match(/baseCost:\{([^}]*)\}/);
  check('6: das Botschaftsviertel hat Kredit-Kosten', !!m && /credits:\s*\d+/.test(m[1]), m && m[1]);
  const basis = new Function('return {'+m[1]+'};')();
  const t = baue({ credits: basis.credits, res: { erz: basis.erz, kristalle: basis.kristalle, deuterium: basis.deuterium } });
  check('6: mit genau den Grundkosten ist Stufe 1 bezahlbar', t.ctx.canAfford(basis) === true, basis);
  const knapp = baue({ credits: basis.credits - 1, res: { erz: basis.erz, kristalle: basis.kristalle, deuterium: basis.deuterium } });
  check('6: mit einem Kredit zu wenig nicht', knapp.ctx.canAfford(basis) === false);
}

// ---------------------------------------------------------------- 7: keine unbekannten Kostenschlüssel
// Der Wächter gegen die Wiederholung: jeder Schlüssel in einem baseCost muss eine Ressource, eine
// Tier-2-Ressource oder 'credits' sein - sonst liest costAmountAvailable stillschweigend 0 und der
// Posten wird unbezahlbar, genau wie beim Botschaftsviertel.
{
  const resKeys = new Function(src.slice(src.indexOf('  const RES_DEFS = ['), src.indexOf('\n  ];', src.indexOf('  const RES_DEFS = [')) + 5) + ';return RES_DEFS.map(r=>r.key);')();
  const t2Block = src.slice(src.indexOf('  const TIER2_DEFS = ['), src.indexOf('\n  ];', src.indexOf('  const TIER2_DEFS = [')) + 5);
  const t2Keys = [...t2Block.matchAll(/key:'([a-z0-9]+)'/g)].map(m => m[1]);
  // 'bergung' (v8.342.0) ist keine RES_DEFS-Ressource, sondern liegt in state.abgrund.bergung -
  // die Bergungswerft ist das erste Gebaeude, das damit bezahlt wird. Es gehoert genau dann in
  // diese Liste, wenn canAfford/pay/costAmountAvailable den Schluessel wirklich kennen; sonst
  // waere die Werft unbezahlbar. Die drei Stellen werden hier ausdruecklich nachgeprueft, damit
  // der Eintrag nicht zur blossen Ausnahme verkommt.
  // canAfford steht bewusst NICHT in dieser Schleife: Es nennt gar keinen Schluessel, sondern
  // fragt fuer jeden einzeln costAmountAvailable - es kann bergung also nicht "vergessen".
  // Geprueft werden die beiden Stellen, die Schluessel wirklich einzeln behandeln.
  for (const fn of ['pay','costAmountAvailable']){
    const i = src.indexOf('function '+fn+'(');
    check('7: '+fn.padEnd(20)+' kennt den Schluessel bergung', i > 0 && /'bergung'/.test(src.slice(i, i+900)));
  }
  check('7: canAfford fragt jeden Schluessel ueber costAmountAvailable ab',
    /function canAfford\(cost\)\{ return Object\.entries\(cost\)\.every\(\(\[r,amt\]\) => costAmountAvailable\(r\) >= amt\); \}/.test(src));
  // protomaterie (16.08.2026) steht bewusst weder in RES_DEFS (nicht produzierbar) noch in
// TIER2_DEFS (keine Fabrik, keine Rate) - ist aber seit der Tier-3-Kette ein gueltiger
// Kostenschluessel in baseCost. Ohne diesen Eintrag meldet die Pruefung sie als Tippfehler.
const erlaubt = new Set([...resKeys, ...t2Keys, 'credits', 'bergung', 'protomaterie']);
  check('7: die Liste der erlaubten Kostenschlüssel ist plausibel gefüllt', erlaubt.size >= 8, [...erlaubt]);
  let verstoesse = [];
  for (const m of src.matchAll(/baseCost:\{([^}]*)\}/g)){
    for (const k of [...m[1].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)].map(x => x[1])){
      if (!erlaubt.has(k)) verstoesse.push(k);
    }
  }
  check('7: kein baseCost benutzt einen unbekannten Kostenschlüssel', verstoesse.length === 0, [...new Set(verstoesse)]);
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
