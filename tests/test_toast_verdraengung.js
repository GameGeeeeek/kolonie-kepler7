// Der Toast-Ueberlauf verdraengt keine wichtigen Meldungen mehr (17.08.2026).
//
// DER VORFALL: test_wachauf_nachholen war einzeln gruen und im Suite-Lauf rot - "1: und das Spiel
// sagt, was passiert ist | (nicht gefunden)". Der Mechanismus stand in pushToast: Der Stapel haelt
// nur DREI Meldungen, die aelteste fliegt synchron raus. Beim Stunden-Nachholen feuert im selben
// Atemzug eine Ereignis-Salve (Planeten-Ereignis garantiert - Arbeitsregel 18 -, dazu Haendler/
// Raid/Tagesreset je nach Lauf), und ab vier Meldungen flog ausgerechnet die Erklaerzeile des
// Nachholens zuerst raus. Fuer den Spieler war sie damit unsichtbar: #log darueber ueberschreibt
// sich mit jeder Meldung selbst, ein Protokoll gibt es dort nicht. Kein Test-Artefakt, sondern
// ein echter Anzeige-Verlust - der Test hat ihn nur zufaellig gemessen.
//
// GEPRUEFT WIRD (der ECHTE pushToast-Block, aus der Datei geschnitten und AUSGEFUEHRT - samt dem
// echten escapeHtml, Arbeitsregel 36: nie eine Spielfunktion durch einen Platzhalter ersetzen):
//   1. Eine wichtige Meldung (type 'wichtig') ueberlebt eine Salve von vier banalen.
//   2. Gegenrichtung: Ohne Wichtig-Markierung fliegt weiterhin die aelteste zuerst, Deckel 3.
//   3. Randfall lauter wichtige: Der Rueckfall auf firstChild greift - der Stapel bleibt bei 3
//      und die Schleife terminiert (ohne den Rueckfall liefe `while` endlos).
//   4. Die drei Nachhol-/Rueckkehr-Meldungen tragen die Markierung wirklich (sonst schuetzt der
//      Mechanismus niemanden).
//
// GEGENPROBE (Arbeitsregel 1, beide Richtungen): Am alten Stand fliegt die wichtige Meldung raus
// (Pruefung 1 faellt) und keine der drei Zeilen traegt 'wichtig' (Pruefung 4 faellt).
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 0) Extraktion mit Anker-Pruefung (Arbeitsregel 6/34) ---------------------------------
function schneideFunktion(name){
  const von = JS.indexOf('function ' + name + '(');
  const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
  return (von >= 0 && bis > von) ? JS.slice(von, bis + 4) : null;
}
const pushToastCode = schneideFunktion('pushToast');
const escapeHtmlCode = schneideFunktion('escapeHtml');
check('0a: pushToast steht in der Spieldatei', !!pushToastCode, pushToastCode ? pushToastCode.length : -1);
check('0b: escapeHtml steht in der Spieldatei (die echte Abhaengigkeit, kein Platzhalter)',
  !!escapeHtmlCode, escapeHtmlCode ? escapeHtmlCode.length : -1);

// ---- Mini-DOM: nur was pushToast wirklich anfasst -----------------------------------------
function fakeElement(){
  const el = { className:'', innerHTML:'', parentNode:null };
  el.classList = {
    add(k){ if (!el.className.split(/\s+/).includes(k)) el.className = (el.className + ' ' + k).trim(); },
    remove(k){ el.className = el.className.split(/\s+/).filter(x => x !== k).join(' '); },
    contains(k){ return el.className.split(/\s+/).includes(k); }
  };
  return el;
}
function macheUmgebung(){
  const kinder = [];
  const container = {
    children: kinder,
    get firstChild(){ return kinder[0] || null; },
    appendChild(el){ kinder.push(el); el.parentNode = container; },
    removeChild(el){ const i = kinder.indexOf(el); if (i >= 0) kinder.splice(i, 1); el.parentNode = null; return el; }
  };
  const dokument = {
    hidden: false,
    getElementById: id => id === 'toastContainer' ? container : { innerHTML:'' },
    createElement: () => fakeElement()
  };
  return { container, dokument };
}
let bau = null, bauFehler = null;
try {
  // setTimeout wird geschluckt (kein Auto-Entfernen im Test), requestAnimationFrame ebenso.
  bau = new Function('document', 'state', 'requestAnimationFrame', 'setTimeout',
    escapeHtmlCode + '\n' + pushToastCode + '\nreturn pushToast;');
} catch (e){ bauFehler = e.message; }
check('0c: der Block laesst sich ausfuehren (Arbeitsregel 34)', !!bau, bauFehler);
if (!bau) return ende();
function frisch(){
  const u = macheUmgebung();
  const pushToast = bau(u.dokument, { notifOn:false }, ()=>{}, ()=>0);
  return { pushToast, kinder: u.container.children };
}
const texte = kinder => kinder.map(k => (k.innerHTML.match(/<span>(.*)<\/span>/)||[])[1] || '');

// ---- 1) Die wichtige Meldung ueberlebt die Salve ------------------------------------------
{
  const { pushToast, kinder } = frisch();
  pushToast('Das Spiel lag 480 Min. still', 'ti-clock', 'wichtig');
  for (let i = 1; i <= 4; i++) pushToast('Salve ' + i);
  check('1a: der Stapel haelt weiterhin hoechstens drei Meldungen', kinder.length === 3, kinder.length);
  check('1b: die wichtige Meldung steht noch - verdraengt wurden die banalen',
    texte(kinder).some(t => /480 Min/.test(t)), texte(kinder));
}

// ---- 2) Gegenrichtung: ohne Markierung fliegt die aelteste zuerst -------------------------
{
  const { pushToast, kinder } = frisch();
  for (let i = 1; i <= 5; i++) pushToast('Meldung ' + i);
  check('2a: Deckel 3 gilt auch ohne wichtige Meldungen', kinder.length === 3, kinder.length);
  check('2b: die aeltesten zwei sind raus, die juengsten drei stehen in Reihenfolge',
    JSON.stringify(texte(kinder)) === JSON.stringify(['Meldung 3','Meldung 4','Meldung 5']), texte(kinder));
}

// ---- 3) Randfall: lauter wichtige - der Rueckfall verhindert die Endlosschleife -----------
{
  const { pushToast, kinder } = frisch();
  for (let i = 1; i <= 5; i++) pushToast('Wichtig ' + i, null, 'wichtig');
  check('3: auch ein Stapel aus lauter wichtigen bleibt bei drei (Rueckfall auf die aelteste)',
    kinder.length === 3 && JSON.stringify(texte(kinder)) === JSON.stringify(['Wichtig 3','Wichtig 4','Wichtig 5']),
    { anzahl: kinder.length, texte: texte(kinder) });
}

// ---- 4) Die Nachhol-/Rueckkehr-Meldungen tragen die Markierung wirklich -------------------
{
  const stellen = [
    ['Ruhezustand-Zeile', /wurde nachgetragen\.', 'ti-clock', 'wichtig'\)/],
    ['Willkommen-zurueck-Zeile', /Min\. gutgeschrieben\.', 'ti-clock', 'wichtig'\)/],
    ['Rueckkehrer-Boost-Zeile', /'ti-sparkles', 'wichtig'\)/]
  ];
  for (const [name, muster] of stellen){
    check('4: ' + name + ' ist als wichtig markiert', muster.test(JS));
  }
}

ende();
