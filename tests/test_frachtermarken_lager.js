// Werftmarken-Laderaum wirkt auch auf das LAGER (v8.431.0, Spieler-Report Sascha mit Foto).
//
// DER BEFUND: Der sechste Zivil-Markenzweig ("+4% Laderaum je Marke", eingeführt 02.08.2026)
// wirkte nur auf den Missions-Frachtraum (fleetCargoCapacity), nicht auf den Lager-Beitrag der
// Frachter in storageCap() - die Werftmarken-Karte versprach "+36% Laderaum" auf Mk X, das
// sichtbare Lager blieb stehen. Es ist die exakte Wiederholung des Cargo-MODUL-Fehlers vom
// 21.07.2026 (damals: Modul wirkte nur auf Missions-Frachtraum) - dieselbe Größe, zwei
// Verbrauchsstellen, eine vergessen.
//
// GEPRÜFT WIRD DIE REGEL (Arbeitsregel 3): storageCap und fleetCargoCapacity müssen für den
// Markenzweig DIESELBEN per-Klasse-Terme benutzen - und im Browser wird der Lagerdeckel an der
// sichtbaren Ressourcen-Karte GEMESSEN, mit einer Erwartung, die aus den Konstanten der
// Spieldatei gerechnet ist (Arbeitsregel 2: nichts eintippen).
//
// GEGENPROBE (Arbeitsregel 1, beim Einführen ausgeführt): am alten Stand ist der Deckel mit und
// ohne Marken identisch - Prüfung 3c fällt durch; ebenso die Verdrahtungsprüfungen 1a/1b.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function funktionsRumpf(name) {
  const von = JS.indexOf('function ' + name + '(');
  if (von < 0) return '';
  const bis = JS.indexOf('\n  function ', von + 20);
  return bis > von ? JS.slice(von, bis) : '';
}

// ---- 1) Verdrahtung: beide Verbrauchsstellen, beide Klassen, dieselben Terme
const sc = funktionsRumpf('storageCap');
const fcc = funktionsRumpf('fleetCargoCapacity');
check('1a: storageCap kennt den Markenzweig beider Frachterklassen',
  sc.includes("shipMarkBonus('frachter', 'cargo')") && sc.includes("shipMarkBonus('frachtergross', 'cargo')"));
check('1b: beide Beitragstellen (Basis + Handelswelt) nutzen die per-Klasse-Multiplikatoren',
  (sc.match(/frachterLagerMult/g) || []).length >= 2 && (sc.match(/grossLagerMult/g) || []).length >= 2,
  { frachter: (sc.match(/frachterLagerMult/g) || []).length, gross: (sc.match(/grossLagerMult/g) || []).length });
// Seit v8.497.0 summiert fleetCargoCapacity ueber CARGO_SHIP_KEYS, der Marken-Term steht also
// einmal mit dem Schleifenschluessel da statt zweimal mit festen Klassennamen. Die geprüfte REGEL
// ist unverändert: Lager und Frachtraum benutzen denselben Term JE KLASSE, keinen pauschalen.
// Beide Schreibweisen erfüllen sie - die Schleifenform sogar strenger, weil sie keine Klasse
// vergessen KANN. Das eigentliche Verhalten misst ohnehin 3c im Browser.
check('1c: fleetCargoCapacity nutzt denselben Marken-Term je Klasse (eine Größe, zwei Stellen)',
  (fcc.includes("shipMarkBonus(k, 'cargo')") && fcc.includes('CARGO_SHIP_KEYS'))
  || (fcc.includes("shipMarkBonus('frachter', 'cargo')") && fcc.includes("shipMarkBonus('frachtergross', 'cargo')")),
  fcc.replace(/\s+/g, ' ').slice(0, 220));

// ---- 1d) Anzeige (v8.432.0, Wunsch Sascha): die Frachter-Karten zeigen die AKTUELLEN Werte,
// gerechnet mit DENSELBEN Termen (Cargo-Modul klassenweit, Marke je Klasse) - keine dritte Formel.
{
  const fKarte = (JS.match(/else if \(def\.key==='frachter'\)\{[\s\S]{0,900}?\n      \}/) || [''])[0];
  const gKarte = (JS.match(/else if \(def\.key==='frachtergross'\)\{[\s\S]{0,900}?\n      \}/) || [''])[0];
  check('1d: beide Karten zeigen "Frachtraum aktuell" mit den echten Multiplikatoren',
    fKarte.includes('Frachtraum aktuell') && fKarte.includes("shipMarkBonus('frachter','cargo')") &&
    gKarte.includes('Frachtraum aktuell') && gKarte.includes("shipMarkBonus('frachtergross','cargo')") &&
    fKarte.includes("shipModuleBonusFor('frachter','cargo')") && gKarte.includes("shipModuleBonusFor('frachter','cargo')"));
}

// ---- 2) Erwartung aus der Datei rechnen: Zivil-Familie, cargo je Stufe, Mk-Maximum
const cargoStep = Number((JS.match(/zivil:\s*\{[^}]*cargo:([\d.]+)/) || [])[1]);
const mkMax = Number((JS.match(/const SHIP_MARK_MAX = (\d+)/) || [])[1]);
check('2a: Konstanten aus der Datei gelesen', cargoStep > 0 && mkMax > 1, { cargoStep, mkMax });

// ---- 3) Im Browser messen: sichtbarer Lagerdeckel mit und ohne Marken
// Spielstand: NUR Großfrachter tragen bei (10x1000), keine Lager-Gebäude/-Forschung/-Boni.
// Erwartete Differenz = 10 * 1000 * (mkMax-1) * cargoStep, abgelesen an der Ressourcen-Karte.
const SAVE = (marks) => JSON.stringify({ tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 100, erz: 100, kristalle: 100, deuterium: 100, antimaterie: 0, forschungspunkte: 0 },
  buildings: { solar: 1 }, research: {},
  fleet: { frachtergross: 10, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'A', avatarKey: null },
  shipMarks: marks, skillTree: {},
  xp: 0, credits: 0, buffs: [], lastTick: Date.now(), colonyNames: {} });

function backend(store) { return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: false, tier: null } });
  if (p === 'reports') return j({ reports: [] });
  if (p === 'storage-list') return j({ keys: [] });
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData()).value; } catch (e) {} return j({ ok: true, version: 2 }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  return j([]);
}; }

// fmt schreibt '10.8k' / '14.4k' - zurückrechnen statt Strings vergleichen.
function parseFmt(t) {
  if (!t) return NaN;
  if (t.endsWith('M')) return parseFloat(t) * 1e6;
  if (t.endsWith('k')) return parseFloat(t) * 1e3;
  return parseFloat(t);
}

async function lagerDeckel(browser, marks) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE(marks) }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3800);
  const deckelText = await page.evaluate(() => {
    const card = document.querySelector('#resbar .rescard[data-res="erz"] .value span');
    return card ? card.textContent.replace('/', '').trim() : null;
  });
  await ctx.close();
  return { deckel: parseFmt(deckelText), text: deckelText, errs };
}

(async () => {
  const browser = await starteBrowser();
  const ohne = await lagerDeckel(browser, {});
  const mit = await lagerDeckel(browser, { frachtergross: mkMax });
  check('3a: Lagerdeckel ohne Marken abgelesen', Number.isFinite(ohne.deckel) && ohne.deckel > 0, ohne.text);
  check('3b: Lagerdeckel mit Mk-' + mkMax + '-Großfrachtern abgelesen', Number.isFinite(mit.deckel) && mit.deckel > 0, mit.text);
  // Erwartete Differenz aus den Konstanten der Datei; fmt rundet auf 100er (x.yk), also Toleranz 100.
  const erwartet = 10 * 1000 * (mkMax - 1) * cargoStep;
  check('3c: die Marken erhöhen den sichtbaren Deckel um genau den Laderaum-Zweig',
    Math.abs((mit.deckel - ohne.deckel) - erwartet) <= 100,
    { ohne: ohne.deckel, mit: mit.deckel, differenz: mit.deckel - ohne.deckel, erwartet });
  check('3d: keine JS-Fehler', ohne.errs.length === 0 && mit.errs.length === 0,
    ohne.errs.concat(mit.errs).slice(0, 3));
  await ende(async () => { await browser.close(); });
})();
