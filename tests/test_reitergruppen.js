// Die vier Reiter-Gruppen als benannte Flächen (Gleichmaß Etappe 3a, 11.09.2026).
//
// WAS HIER ABGESICHERT WIRD
// -------------------------
// Die 13 Reiter der Hauptleiste liegen seit Etappe 3a in vier `div.tab-gruppe`
// (data-tab-gruppe=kolonie/erkundung/gemeinschaft/meta), jede mit einem vorangestellten
// `span.tab-gruppe-titel`. Die drei früheren `div.tab-group-divider` sind ersatzlos entfallen.
//
// VIER FALLEN, DIE DIESER UMBAU AUFMACHT - UND DIE DIESER TEST EINZELN FESTHÄLT:
//
//   1. DIE KLICK-HANDLER HÄNGEN GENAU EINMAL. Sie werden beim Laden über
//      `document.querySelectorAll('.tab-btn')` verdrahtet; eine Delegation gibt es nicht. Wer die
//      Knöpfe zur Laufzeit neu erzeugt (statt sie im statischen Markup umzuhängen), bekommt eine
//      Leiste, die AUSSIEHT wie vorher und auf keinen Klick mehr reagiert. Das fällt nur auf,
//      wenn wirklich jeder der 13 Knöpfe gedrückt wird - Prüfung 4.
//
//   2. EINE GRUPPENFLÄCHE IST EINE GESCHLOSSENE KACHEL. Die Leiste darf dann nur noch ZWISCHEN
//      den Gruppen umbrechen, nicht mehr zwischen beliebigen Knöpfen. Unterhalb von 1561 px kostet
//      das ganze Zeilen (gemessen: 156 px statt 94 px bei 1400 px Fenster). Deshalb löst der
//      Block `@media (max-width: 1560px)` die Flächen wieder auf (display:contents). Prüfung 5
//      hält die Schwelle fest, Prüfung 6 ihre Wirkung - die Leistenhöhe.
//
//   3. DAS HANDY-RASTER HÄNGT AN DIREKTEN KINDERN. `.tabs` ist bei ≤700 px ein
//      `repeat(6,1fr)`-Raster, und `.tabs .tab-btn[data-tab="sammlung"] { grid-column:1/-1 }`
//      wirkt nur, wenn der Knopf ein DIREKTES Rasterkind ist. Mit einer Gruppenfläche dazwischen
//      wären die Rasterkinder die vier Gruppen - Prüfung 9 misst genau das.
//
//   4. `.tab-badge` SITZT ABSOLUT IN DER ECKE DES KNOPFES. Ein `overflow:hidden` oder ein eigener
//      Stapelkontext an der Gruppe beschneidet oder überdeckt die Punkte, ohne dass sonst etwas
//      auffiele - Prüfung 7a (Geometrie) und 7b (die Eigenschaften, die gar nicht erst gesetzt
//      sein dürfen).
//
// ERWARTUNGSWERTE SIND GEMESSEN, NICHT EINGETIPPT:
//   * Die vier Domänenfarben liest der Test per String-Anker aus dem `--tab-dom`-Block der
//     Spieldatei; der `--grp-dom`-Block wird dagegen geprüft, nicht daneben gestellt.
//   * Welcher Knopf in welche Gruppe gehört, kommt aus den `data-tab-domain`-Attributen derselben
//     Datei - eine eingetippte Liste wäre bei jedem neuen Reiter falsch.
//   * Die Leistenhöhen des Ausgangsstands misst der Test IM SELBEN LAUF auf einer zweiten Seite.
//
// DER VERGLEICHSSTAND: im REGELFALL baut der Test ihn sich aus der AKTUELLEN Spieldatei -
// dieselbe Datei plus eine angehängte Regel, die die Gruppenflächen bei JEDER Breite auflöst. Das
// ist layouttechnisch derselbe Zustand wie „gar keine Flächen" (`display:contents` erzeugt keine
// Box), und die Höhenprüfung 6 behält ihre Aussage damit auch dann, wenn der historische Stand
// längst weg ist. Die Kopie des Ausgangsstands (v8.722.0) kommt nur noch dazu, wenn sie über
// KEPLER_REITERGRUPPEN_ALT ausdrücklich benannt wird; einen Vorgabepfad gibt es seit dem
// 11.09.2026 nicht mehr (er war ein absoluter Sitzungspfad und griff auf keinem anderen Rechner).
// Welcher Stand benutzt wurde, sagt V7 - und V7 wertet OBERHALB der Schwelle aus, weil sich nur
// dort die drei möglichen Lagen unterscheiden (siehe dort). Abgeräumt wird die abgeleitete Kopie
// am Ende des Laufs, auch im Abbruchfall (aufraeumenVergleich).
//
// GEGENPROBEN (KEPLER_REITERGRUPPEN_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         v8.722.0 unverändert - dort fällt der ganze Kern
//   =sabotageA   „.tabs .tab-gruppe { display:contents; }" aus dem 1560-px-Block entfernt
//   =sabotageB   zwei data-tab-gruppe-Blöcke im Markup vertauscht (erkundung vor kolonie)
//   =sabotageC   „.tabs .tab-gruppe-titel { display:none; }" aus dem 1560-px-Block entfernt
//   =sabotageD   ein Titeltext geändert („Gemeinschaft" -> „Sozial")
//   =sabotageE   ein --grp-dom-Wert auf eine falsche Farbe gesetzt
//   =sabotageF   .tab-gruppe bekommt overflow:hidden
//   =sabotageG   ein Knopf in die falsche Gruppe verschoben (Flotte zu Erkundung)
//   =sabotageH   der linke Farbrand der Gruppe entfernt (border-left)
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst laufen lassen, dann eingetragen), nicht geraten.
// Eine Sabotage, die grün bleibt, ist ein Befund über die Prüfung - nicht über die Sabotage.
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_REITERGRUPPEN_GEGENPROBE || '';
// GEMESSEN am 11.09.2026 (erst mit leeren Listen laufen lassen, dann eingetragen, dann alle
// Staende erneut gefahren, bis jeder Exit 0 lieferte). Was seit der Durchsicht dazukam:
//   * 2f faellt jetzt bei `alt` (dort gibt es die Flaeche gar nicht), bei sabotageE (falsche
//     --grp-dom-Farbe faerbt auch den linken Rand falsch) und als EINZIGE Pruefung bei sabotageH.
//   * 3b faellt bei sabotageB weiterhin - jetzt aber ueber die ausgeschriebene BESTAND-Reihe und
//     nicht mehr ueber einen Vergleich der Datei mit sich selbst.
const MUSS_FALLEN = {
  alt:       ['V3','V4','1a','1b','1c','1d','2a','2b','2c','2d','2f','2e','3a','5a','5b','7b'],
  sabotageA: ['5b','6a','8','9b'],
  sabotageB: ['1c','3b'],
  sabotageC: ['5b','6a'],
  sabotageD: ['2b'],
  sabotageE: ['2c','2d','2f'],
  sabotageF: ['7b'],
  sabotageG: ['3a'],
  sabotageH: ['2f']
};

// Die Breiten, an denen gemessen wird. 1600 liegt über der Schwelle, 1560 genau darauf
// (max-width schließt den Wert ein), der Rest darunter; 390 ist das Handy-Raster.
// 1561 ist die SCHMALSTE Breite MIT Kacheln, und dort ist die Reserve laut dem CSS-Kommentar der
// Spieldatei nur 26 px (bei 1600 px sind es 66 px). Genau dort kippt die Kachelbauart zuerst -
// deshalb wird dort gemessen und nicht nur bei 1600/1900 px (gemessen 11.09.2026: 102 px und zwei
// Knopfzeilen bei 1561/1600/1620/1900 px, Vergleichsstand überall 94 px).
const BREITEN = [1900, 1600, 1561, 1560, 1400, 1200, 1000, 390];
const UEBER_DER_SCHWELLE = 1600;
const UNTER_DER_SCHWELLE = [1560, 1400, 1200, 1000, 390];
const HOEHE_GLEICH = [1400, 1200, 1000, 390];   // hier darf die Leiste keinen Millimeter wachsen
const HOEHE_TOLERANZ = [1900, 1600, 1561];      // hier sind die Flächen sichtbar: höchstens +8 px
const ABZEICHEN_BREITEN = [1900, 1600, 1400, 390];

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

// Der Spielstand stammt aus tests/test_reiterleiste.js (dieselbe Leiste, dieselbe Ausgangslage) und
// ist bewusst reich: Ein armer Stand zeigt KEINEN Reiterpunkt, und Prüfung 7 wäre dann über einer
// leeren Menge trivial grün. V8 misst deshalb ausdrücklich nach, dass Punkte da sind.
// Der Spread von ruhigeUhren() steht VORNE, damit alles dahinter gewinnt (lib/umgebung.js).
const SPEICHER = JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                 galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
  resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
  buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12 },
  research:{ rsolar:8, rerz:8, rkampf:7 }, fleet:{ jaeger:420, missions:[] },
  colonies:{}, activeBasePlanet:'home', shipMarks:{},
  player:{ id:'u', name:'A', allianceTag:'', avatarKey:null }, battleStats:{ wins:5, losses:1 },
  xp:64000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} });

// ---- Quelltext-Messungen ------------------------------------------------------------------------
const QUELLE = fs.readFileSync(SPIELDATEI, 'utf8');

// Liest einen Farbblock der Form `.<klasse>[<attribut>="<name>"] { --<variable>:#rrggbb; }`.
// Bewusst mit `[^{}]*` gearbeitet: So kann der Ausdruck keine geschweifte Klammer überspringen und
// greift nicht versehentlich in die Nachbarregel (etwa `.tab-btn.active[data-tab-domain=...]`,
// die dieselbe Farbe als border-color trägt, aber keine Variable setzt).
function farbblock(quelle, klasse, attribut, variable){
  const re = new RegExp('\\.' + klasse + '\\[' + attribut + '="([a-z]+)"\\][^{}]*\\{[^{}]*--' + variable + '\\s*:\\s*(#[0-9a-fA-F]{3,8})', 'g');
  const o = {};
  let m; while ((m = re.exec(quelle)) !== null) o[m[1]] = m[2].toLowerCase();
  return o;
}
const DOM_FARBEN = farbblock(QUELLE, 'tab-btn', 'data-tab-domain', 'tab-dom');
const GRP_FARBEN = farbblock(QUELLE, 'tab-gruppe', 'data-tab-gruppe', 'grp-dom');

function hexZuRgb(hex){
  if (!hex) return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return 'rgb(' + parseInt(h.slice(0,2),16) + ', ' + parseInt(h.slice(2,4),16) + ', ' + parseInt(h.slice(4,6),16) + ')';
}

// Welcher Knopf gehört laut Datei in welche Domäne - und in welcher Reihenfolge stehen sie?
const KNOEPFE_AUS_DATEI = [...QUELLE.matchAll(/<button[^>]*class="tab-btn[^"]*"[^>]*data-tab="([a-z0-9]+)"[^>]*data-tab-domain="([a-z]+)"/g)]
  .map(m => ({ tab:m[1], domaene:m[2] }));
// Zusammenhängende Domänenblöcke in Dateireihenfolge - das ist die Erwartung an die Gruppen.
const BLOECKE = [];
for (const k of KNOEPFE_AUS_DATEI){
  const letzter = BLOECKE[BLOECKE.length - 1];
  if (letzter && letzter.domaene === k.domaene) letzter.tabs.push(k.tab);
  else BLOECKE.push({ domaene:k.domaene, tabs:[k.tab] });
}

// Die Titeltexte sind der einzige Wert, der nirgends sonst im Code steht: Sie sind die Zusage des
// Änderungssatzes selbst („Kolonie · Erkundung · Gemeinschaft · Spieler", so auch im Hilfeeintrag).
// Deshalb hier ausgeschrieben - und in der Gegenprobe D nachgewiesen, dass die Prüfung greift.
const TITEL = { kolonie:'Kolonie', erkundung:'Erkundung', gemeinschaft:'Gemeinschaft', meta:'Spieler' };

// Die Reihenfolge der vier Gruppen ist Muskelerinnerung und deshalb bewusst AUSGESCHRIEBEN, nicht
// aus der Datei abgeleitet: Eine Erwartung, die aus derselben Datei kommt wie die Messung, kann ein
// Vertauschen gar nicht bemerken - gemessen an der Gegenprobe B, die genau das tut und an einer
// dateiabgeleiteten Erwartung vorbeilief. Vorbild ist die BESTAND-Liste in tests/test_nav.js.
// Geprueft wird beides: die Reihenfolge der Gruppen IM DOM und die der data-tab-domain-Bloecke in
// der Datei - auseinanderlaufen duerfen sie nicht.
const GRUPPEN_REIHE = ['kolonie', 'erkundung', 'gemeinschaft', 'meta'];

// Die Reihenfolge der BESTANDS-Reiter ist ebenfalls Muskelerinnerung - und seit der Vorgabepfad
// weg ist, ist der Ersatzstand der Normalfall; ein Vergleich der Datei mit sich selbst kann ein
// Umsortieren gar nicht bemerken. Deshalb hier dieselbe ausgeschriebene Liste wie in
// tests/test_nav.js, mit derselben Bauart: PRAEFIX statt Gleichheit (ein ANGEHAENGTER vierzehnter
// Reiter verletzt die Muskelerinnerung nicht, ein umsortierter sehr wohl) plus die Gegenrichtung,
// dass keiner verschwindet. Der historische Stand kommt in 3b nur noch als Zusatzbeleg dazu.
const BESTAND = 'basis,verteidigung,forschung,flotte,expedition,karte,galaxie,allianz,offiziere,markt,punkte,fortschritt'.split(',');

// Steht eine Fundstelle innerhalb eines Kommentars? Gemessen über die letzte Kommentar-Öffnung vor
// der Stelle: liegt sie hinter dem letzten Kommentar-Ende, ist die Fundstelle drin.
function inKommentar(quelle, pos){
  for (const [auf, zu] of [['/*', '*/'], ['<!--', '-->']]){
    const a = quelle.lastIndexOf(auf, pos);
    if (a < 0) continue;
    const z = quelle.lastIndexOf(zu, pos);
    if (a > z) return true;
  }
  return false;
}
function fundstellenAusserhalbKommentar(quelle, text){
  const treffer = [];
  let i = quelle.indexOf(text);
  while (i >= 0){
    if (!inKommentar(quelle, i)) treffer.push(quelle.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' '));
    i = quelle.indexOf(text, i + 1);
  }
  return treffer;
}

// ---- Der Vergleichsstand ------------------------------------------------------------------------
// KEIN VORGABEPFAD. Hier stand bis zum 11.09.2026 ein absoluter Sitzungspfad auf eine Kopie von
// v8.722.0 - auf jedem anderen Rechner griff damit immer der Ersatzweg, und die Datei trug einen
// Pfad, den lib/umgebung.js ausdrücklich abgeschafft hat. Der historische Stand kommt jetzt nur
// noch über KEPLER_REITERGRUPPEN_ALT; der NORMALFALL ist damit der Ersatzstand.
// Weil der Ersatzstand der Normalfall ist, darf keine Prüfung ihre Aussage allein aus ihm ziehen:
// Prüfung 3b steht deshalb auf einer ausgeschriebenen Knopfreihe (BESTAND, Vorbild
// tests/test_nav.js) und nimmt den historischen Stand nur noch als ZUSATZbeleg dazu, wenn er da ist.
function vergleichsstand(){
  const benannt = process.env.KEPLER_REITERGRUPPEN_ALT || '';
  try { if (benannt && fs.statSync(benannt).size > 0) return { pfad:benannt, art:'Ausgangsstand', historisch:true, ordner:null }; } catch (e) {}
  // Ersatz: dieselbe Spieldatei, aber die Gruppenflächen bei jeder Breite aufgelöst. Das ist
  // derselbe Layout-Zustand, den die Schwelle unterhalb von 1561 px herstellt.
  // Der Ordner wird am Ende des Laufs wieder abgeräumt (aufraeumenVergleich), auch wenn der Lauf
  // abbricht: ohne das blieben je Lauf 6,7 MB liegen - gemessen fünf Läufe, 33 MB.
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-reitergruppen-'));
  const ziel = path.join(ordner, 'vergleich.html');
  fs.writeFileSync(ziel, QUELLE + '\n<style>.tabs .tab-gruppe{display:contents !important;}' +
    '.tabs .tab-gruppe-titel{display:none !important;}</style>\n');
  return { pfad:ziel, art:'aus der Spieldatei abgeleitet (ohne Gruppenflächen)', historisch:false, ordner };
}
let VERGLEICH = null;
function aufraeumenVergleich(){
  if (VERGLEICH && VERGLEICH.ordner){
    try { fs.rmSync(VERGLEICH.ordner, { recursive:true, force:true }); } catch (e) {}
    VERGLEICH.ordner = null;
  }
}

// ---- Was auf einer Seite je Breite gemessen wird -------------------------------------------------
const MESSEN = () => {
  const leiste = document.querySelector('.tabs');
  if (!leiste) return null;
  const lr = leiste.getBoundingClientRect();
  const ls = getComputedStyle(leiste);
  const direkt = [...leiste.children].filter(el => el.classList.contains('tab-gruppe'));
  const alleGruppen = [...leiste.querySelectorAll('.tab-gruppe')];
  const knoepfe = [...leiste.querySelectorAll('.tab-btn')];
  const sichtbar = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const kurz = el => el ? (el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '').slice(0, 24)) : null;
  return {
    hoehe: Math.round(lr.height),
    breite: Math.round(lr.width),
    anzeige: ls.display,
    spalten: ls.gridTemplateColumns,
    gruppenDirekt: direkt.length,
    gruppenGesamt: alleGruppen.length,
    gruppenSchluessel: direkt.map(g => g.getAttribute('data-tab-gruppe')),
    gruppenAnzeige: alleGruppen.map(g => getComputedStyle(g).display),
    // Zwei Fragen in EINER Messung:
    // (a) Beschneidet die Gruppe ihren Inhalt, oder hebt sie sich per overflow/z-index/transform/
    //     filter/isolation/opacity/mix-blend-mode heraus? Beides wuerde die .tab-badge-Punkte
    //     kosten, ohne dass ihre Rechtecke sich verschieben - deshalb die gerechneten
    //     Eigenschaften und nicht nur die Geometrie (Pruefung 7b).
    // (b) Ist die Flaeche ueberhaupt eine Flaeche? Hintergrund, linker Farbrand und Eckenschnitt
    //     sind die drei Zusagen des Aenderungssatzes, und bis zum 11.09.2026 las sie KEINE
    //     Pruefung: man haette alle drei entfernen koennen, und der Test waere gruen geblieben
    //     (Pruefung 2f).
    gruppenKasten: alleGruppen.map(g => { const c = getComputedStyle(g);
      return { gruppe:g.getAttribute('data-tab-gruppe'), overflow:c.overflow, zIndex:c.zIndex,
               transform:c.transform, filter:c.filter, isolation:c.isolation,
               opacity:c.opacity, mischung:c.mixBlendMode,
               hintergrund:c.backgroundColor, randLinksBreite:c.borderLeftWidth,
               randLinksFarbe:c.borderLeftColor, eckenschnitt:c.clipPath }; }),
    gruppenInhalt: direkt.map(g => ({ gruppe:g.getAttribute('data-tab-gruppe'),
                                      tabs:[...g.querySelectorAll('.tab-btn')].map(b => b.getAttribute('data-tab')) })),
    knoepfeAusserhalb: knoepfe.filter(b => !b.closest('.tab-gruppe')).map(b => b.getAttribute('data-tab')),
    knopfReihe: knoepfe.map(b => b.getAttribute('data-tab')),
    // Die ZEILENZAHL ist schriftunabhaengiger als eine Pixelhoehe: sie faellt, sobald ein
    // vierzehnter Reiter oder eine laengere Beschriftung die Reserve aufbraucht, und sie bleibt
    // auch dann aussagekraeftig, wenn eine andere Schrift jede Zeile um ein paar Pixel aendert.
    zeilen: [...new Set(knoepfe.map(b => Math.round(b.getBoundingClientRect().top)))].length,
    titel: alleGruppen.map(g => {
      const ts = [...g.querySelectorAll('.tab-gruppe-titel')];
      return { gruppe:g.getAttribute('data-tab-gruppe'), anzahl:ts.length,
               sichtbar: ts.filter(sichtbar).length,
               text: ts.map(t => (t.textContent || '').trim()).join('|'),
               farbe: ts[0] ? getComputedStyle(ts[0]).color : null,
               aria: ts[0] ? ts[0].getAttribute('aria-hidden') : null,
               tabIndex: ts[0] ? ts[0].tabIndex : null };
    }),
    // Die Fokusreihenfolge INNERHALB der Leiste - dort dürfen nur die 13 Knöpfe stehen.
    fokuskette: [...leiste.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(el => el.matches('[tabindex="-1"]') ? false : el.tabIndex >= 0)
      .map(el => el.tagName.toLowerCase() + ':' + (el.getAttribute('data-tab') || String(el.getAttribute('class') || '').slice(0, 20))),
    trennerImDom: document.querySelectorAll('.tab-group-divider').length,
    abzeichen: knoepfe.reduce((liste, b) => {
      const br = b.getBoundingClientRect();
      [...b.querySelectorAll('.tab-badge')].filter(sichtbar).forEach(x => {
        const xr = x.getBoundingClientRect();
        liste.push({ tab:b.getAttribute('data-tab'),
                     drin: xr.left >= br.left - 1 && xr.right <= br.right + 1 && xr.top >= br.top - 1 && xr.bottom <= br.bottom + 1,
                     punkt:[Math.round(xr.left), Math.round(xr.top), Math.round(xr.right), Math.round(xr.bottom)],
                     knopf:[Math.round(br.left), Math.round(br.top), Math.round(br.right), Math.round(br.bottom)] });
      });
      return liste;
    }, []),
    treffer: knoepfe.map(b => {
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { tab:b.getAttribute('data-tab'), ok: !!el && (el === b || b.contains(el)), traf: kurz(el) };
    }),
    sammlungBreite: (() => { const s = leiste.querySelector('.tab-btn[data-tab="sammlung"]'); return s ? Math.round(s.getBoundingClientRect().width) : null; })(),
    scrollBreite: document.documentElement.scrollWidth,
    fensterBreite: window.innerWidth
  };
};

// Wartet, bis die Leiste zweimal hintereinander an derselben Stelle steht (Vorbild:
// tests/test_reiterleiste.js). Feste Wartezeiten haben an genau dieser Leiste schon zweimal
// Fehlalarme unter Last erzeugt.
async function warteBisRuhe(page){
  const rechteck = () => page.evaluate(() => {
    const t = document.querySelector('.tabs');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)].join(',');
  });
  let vorher = null, gleich = 0;
  for (let i = 0; i < 40 && gleich < 2; i++){
    const jetzt = await rechteck();
    gleich = (jetzt && jetzt === vorher) ? gleich + 1 : 0;
    vorher = jetzt;
    if (gleich < 2) await page.waitForTimeout(120);
  }
  return gleich >= 2;
}

(async () => {
  const browser = await starteBrowser();
  VERGLEICH = vergleichsstand();

  async function seite(browser, url, store){
    const ctx = await browser.newContext({ viewport:{ width:UEBER_DER_SCHWELLE, height:1000 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
    await versionAbfangen(page);
    await page.route('**/api/**', backend(store));
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
    await page.goto(url);
    await page.waitForTimeout(2600);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
    await page.waitForTimeout(700);
    await warteBisRuhe(page);
    return { ctx, page, errs };
  }

  // Eine Breite einstellen und erst messen, wenn die Leiste steht.
  async function beiBreite(page, w){
    await page.setViewportSize({ width:w, height:1000 });
    await page.waitForTimeout(260);
    await warteBisRuhe(page);
    return page.evaluate(MESSEN);
  }

  const messung = {};        // neuer Stand, je Breite
  const vergleich = {};      // Vergleichsstand, je Breite

  // ---- Vergleichsstand zuerst (zweite Seite im SELBEN Lauf) -------------------------------------
  {
    const store = { 'kepler7-save-v3': SPEICHER };
    const { ctx, page, errs } = await seite(browser, 'file://' + VERGLEICH.pfad, store);
    for (const w of BREITEN) vergleich[w] = await beiBreite(page, w);
    // AUSGEWERTET WIRD OBERHALB DER SCHWELLE, und das ist der ganze Witz dieser Prüfung.
    // Bis zum 11.09.2026 stand hier vergleich[1400] und verlangte 4x 'contents'. Bei 1400 px sind
    // die Gruppen aber auch im NEUEN Stand aufgelöst - die Bedingung war fuer DREI verschiedene
    // Lagen wahr, darunter der Unfall, dass jemand die aktuelle Spieldatei als Vergleichsstand
    // benennt. Dann messen 6a, 6b und 3b die Datei gegen sich selbst und sagen nichts mehr.
    // Oberhalb der Schwelle trennen sich die drei Lagen sauber:
    //   Ausgangsstand v8.722.0   gar keine .tab-gruppe          -> Länge 0
    //   Ersatzstand              aufgelöst per angehängter Regel -> 4x 'contents'
    //   versehentlich die Spieldatei selbst                      -> 4x 'flex', faellt hier
    // Dazu der direkte Pfadvergleich: derselbe path.resolve wie die Spieldatei faellt ebenfalls.
    const v = vergleich[UEBER_DER_SCHWELLE];
    const selbeDatei = path.resolve(VERGLEICH.pfad) === path.resolve(SPIELDATEI);
    const ohneKacheln = !!v && (v.gruppenAnzeige.length === 0 ||
      (v.gruppenAnzeige.length === 4 && v.gruppenAnzeige.every(d => d === 'contents')));
    merke('V7: Vergleichsstand geladen, Leiste oberhalb der Schwelle ohne eigene Gruppenflächen (' + VERGLEICH.art + ')',
      !!v && v.knopfReihe.length === KNOEPFE_AUS_DATEI.length && ohneKacheln && !selbeDatei,
      { pfad:VERGLEICH.pfad, art:VERGLEICH.art, selbeDateiWieSpieldatei:selbeDatei,
        knoepfe: v ? v.knopfReihe.length : null, anzeigeBei1600: v ? v.gruppenAnzeige : null });
    merke('J0: keine JS-Fehler am Vergleichsstand', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  // ---- Neuer Stand: eine Seite, acht Breiten -----------------------------------------------------
  {
    const store = { 'kepler7-save-v3': SPEICHER };
    const { ctx, page, errs } = await seite(browser, SPIEL_URL, store);
    for (const w of BREITEN) messung[w] = await beiBreite(page, w);
    const m = messung[UEBER_DER_SCHWELLE];

    // ---- Vorbedingungen ------------------------------------------------------------------------
    merke('V1: Vorbedingung - die Leiste .tabs ist da', !!m, m ? m.breite : null);
    merke('V2: Vorbedingung - genau 13 button.tab-btn in der Leiste',
      !!m && m.knopfReihe.length === 13, m ? m.knopfReihe : null);
    merke('V3: Vorbedingung - kein Element .tab-group-divider mehr im Dokument',
      !!m && m.trennerImDom === 0, m ? m.trennerImDom : null);
    const reste = fundstellenAusserhalbKommentar(QUELLE, 'tab-group-divider');
    merke('V4: Vorbedingung - „tab-group-divider" steht in der Spieldatei nur noch in Kommentaren',
      reste.length === 0, reste.slice(0, 3));
    merke('V5: Vorbedingung - vier Domänenfarben aus dem --tab-dom-Block gelesen',
      Object.keys(DOM_FARBEN).length === 4 && Object.values(DOM_FARBEN).every(f => /^#[0-9a-f]{6}$/.test(f)), DOM_FARBEN);
    merke('V6: Vorbedingung - 13 Knöpfe mit data-tab-domain aus der Datei gelesen, vier Blöcke',
      KNOEPFE_AUS_DATEI.length === 13 && BLOECKE.length === 4,
      { knoepfe: KNOEPFE_AUS_DATEI.length, bloecke: BLOECKE.map(b => b.domaene + ':' + b.tabs.join('+')) });
    // JE BREITE, nicht in Summe. Bis zum 11.09.2026 wurden die vier Breiten zusammengezählt und
    // nur `> 0` verlangt: Fiele die Zahl bei EINER Breite auf null, bliebe 7a fuer genau diese
    // Breite ueber einer leeren Menge trivial gruen, und die Summe haette es zugedeckt.
    // (Pruefung 8 haengt NICHT an den Abzeichen, sondern an `treffer` mit 13 festen Eintraegen je
    // Breite - sie ist von dieser Luecke nie betroffen gewesen.)
    const abzProBreite = ABZEICHEN_BREITEN.map(w => w + 'px:' + (messung[w] ? messung[w].abzeichen.length : '?'));
    merke('V8: Vorbedingung - bei JEDER Prüfbreite gibt es sichtbare .tab-badge zu prüfen',
      ABZEICHEN_BREITEN.every(w => messung[w] && messung[w].abzeichen.length > 0), abzProBreite.join(' '));

    // ---- 1: Struktur bei 1600 px ---------------------------------------------------------------
    merke('1a: genau vier div.tab-gruppe in der Leiste', !!m && m.gruppenGesamt === 4, m ? m.gruppenGesamt : null);
    merke('1b: alle vier sind DIREKTE Kinder von .tabs',
      !!m && m.gruppenDirekt === 4 && m.gruppenDirekt === m.gruppenGesamt,
      m ? { direkt:m.gruppenDirekt, gesamt:m.gruppenGesamt } : null);
    merke('1c: data-tab-gruppe in der Reihenfolge kolonie/erkundung/gemeinschaft/meta - im DOM UND in der Datei',
      !!m && m.gruppenSchluessel.join(',') === GRUPPEN_REIHE.join(',') &&
      BLOECKE.map(b => b.domaene).join(',') === GRUPPEN_REIHE.join(','),
      { dom: m ? m.gruppenSchluessel : null, datei: BLOECKE.map(b => b.domaene), erwartet: GRUPPEN_REIHE });
    merke('1d: kein button.tab-btn liegt außerhalb einer Gruppe',
      !!m && m.knoepfeAusserhalb.length === 0, m ? m.knoepfeAusserhalb : null);

    // ---- 2: Die Titel --------------------------------------------------------------------------
    merke('2a: je Gruppe genau ein sichtbarer span.tab-gruppe-titel',
      !!m && m.titel.length === 4 && m.titel.every(t => t.anzahl === 1 && t.sichtbar === 1),
      m ? m.titel.map(t => t.gruppe + ':' + t.anzahl + '/' + t.sichtbar) : null);
    merke('2b: die Titel lauten Kolonie/Erkundung/Gemeinschaft/Spieler',
      !!m && m.titel.length === 4 && m.titel.every(t => t.text === TITEL[t.gruppe]),
      m ? m.titel.map(t => t.gruppe + '=' + t.text) : null);
    const farbFehler = !m ? ['keine Messung'] : m.titel
      .filter(t => t.farbe !== hexZuRgb(DOM_FARBEN[t.gruppe]))
      .map(t => t.gruppe + ': ' + t.farbe + ' statt ' + hexZuRgb(DOM_FARBEN[t.gruppe]));
    merke('2c: die Titelfarbe ist die Domänenfarbe aus dem --tab-dom-Block',
      !!m && m.titel.length === 4 && farbFehler.length === 0, farbFehler);
    merke('2d: die --grp-dom-Werte der Datei sind zeichengleich zu den --tab-dom-Werten',
      Object.keys(DOM_FARBEN).length === 4 && Object.keys(GRP_FARBEN).length === 4 &&
      Object.keys(DOM_FARBEN).every(d => GRP_FARBEN[d] === DOM_FARBEN[d]), { DOM_FARBEN, GRP_FARBEN });
    // 2f: DIE FLAECHE SELBST. Von der ganzen benannten Flaeche war bis zum 11.09.2026 nur messbar,
    // dass oberhalb der Schwelle ein Titel sichtbar ist - Hintergrund, linker Farbrand und
    // Eckenschnitt, die drei Zusagen des Aenderungssatzes, las keine einzige Pruefung. Man haette
    // alle drei entfernen koennen, und der Test waere gruen geblieben.
    // Die Randfarbe wird gegen dieselbe hexZuRgb-Rechnung geprueft wie in 2c, also gegen den
    // --tab-dom-Block der Datei - nicht gegen einen eingetippten Farbwert.
    const flaecheFehler = !m ? ['keine Messung'] : m.gruppenKasten.flatMap(k => {
      const f = [];
      if (!(parseFloat(k.randLinksBreite) >= 2)) f.push(k.gruppe + ': linker Rand ' + k.randLinksBreite + ' statt >= 2px');
      if (k.randLinksFarbe !== hexZuRgb(DOM_FARBEN[k.gruppe])) f.push(k.gruppe + ': Randfarbe ' + k.randLinksFarbe + ' statt ' + hexZuRgb(DOM_FARBEN[k.gruppe]));
      if (/^(transparent|rgba\(0, 0, 0, 0\))$/.test(String(k.hintergrund))) f.push(k.gruppe + ': Hintergrund durchsichtig (' + k.hintergrund + ')');
      if (!k.eckenschnitt || k.eckenschnitt === 'none') f.push(k.gruppe + ': kein Eckenschnitt (clip-path ' + k.eckenschnitt + ')');
      return f;
    });
    merke('2f: jede Gruppe ist eine Fläche - eigener Hintergrund, linker Farbrand in der Domänenfarbe (>=2 px), Eckenschnitt',
      !!m && m.gruppenKasten.length === 4 && flaecheFehler.length === 0, flaecheFehler);

    merke('2e: der Titel ist aria-hidden, nicht fokussierbar, und die Fokusreihenfolge der Leiste sind genau die 13 Knöpfe',
      !!m && m.titel.length === 4 && m.titel.every(t => t.aria === 'true' && t.tabIndex < 0) && m.fokuskette.length === 13 &&
      m.fokuskette.every(f => f.startsWith('button:')),
      m ? { titel:m.titel.map(t => t.gruppe + ':' + t.aria + '/' + t.tabIndex), fokus:m.fokuskette } : null);

    // ---- 3: Zugehörigkeit und Reihenfolge ------------------------------------------------------
    const sollInhalt = BLOECKE.map(b => b.domaene + '=' + b.tabs.join('+')).join(' | ');
    const istInhalt = !m ? '(keine Messung)' : m.gruppenInhalt.map(g => g.gruppe + '=' + g.tabs.join('+')).join(' | ');
    merke('3a: je Gruppe genau die Knöpfe ihres data-tab-domain-Blocks', istInhalt === sollInhalt,
      { gemessen:istInhalt, erwartet:sollInhalt });
    // 3b steht auf der AUSGESCHRIEBENEN Knopfreihe (BESTAND, oben), nicht mehr allein auf dem
    // Vergleichsstand: seit der Vorgabepfad weg ist, ist der Ersatzstand der Normalfall, und der
    // stammt aus derselben Datei - er kann ein Umsortieren gar nicht bemerken. Der historische
    // Stand bleibt ZUSATZbeleg, wenn er ueber KEPLER_REITERGRUPPEN_ALT benannt wurde.
    const reiheFehler = [];
    if (!m) reiheFehler.push('keine Messung');
    else {
      BESTAND.forEach((t, i) => { if (m.knopfReihe[i] !== t) reiheFehler.push('Platz ' + i + ': ' + m.knopfReihe[i] + ' statt ' + t); });
      BESTAND.filter(t => m.knopfReihe.indexOf(t) < 0).forEach(t => reiheFehler.push('verschwunden: ' + t));
      const vg = vergleich[UEBER_DER_SCHWELLE];
      if (VERGLEICH.historisch && vg && m.knopfReihe.join(',') !== vg.knopfReihe.join(','))
        reiheFehler.push('weicht vom historischen Stand ab: ' + vg.knopfReihe.join(','));
    }
    merke('3b: die Reiterreihe beginnt mit den zwölf Bestands-Reitern in unveränderter Reihenfolge',
      reiheFehler.length === 0,
      { fehler:reiheFehler, gemessen: m ? m.knopfReihe.join(',') : null, erwartetesPraefix:BESTAND.join(','),
        historischerStand: VERGLEICH.historisch });

    // ---- 5: Die Schwelle -----------------------------------------------------------------------
    merke('5a: über der Schwelle (1600 px) sind die Flächen echte Kacheln und alle vier Titel sichtbar',
      !!m && m.gruppenAnzeige.length === 4 && m.gruppenAnzeige.every(d => d !== 'contents') &&
      m.titel.filter(t => t.sichtbar === 1).length === 4,
      m ? { anzeige:m.gruppenAnzeige, titelSichtbar:m.titel.map(t => t.sichtbar) } : null);
    const schwelleFehler = UNTER_DER_SCHWELLE.filter(w => {
      const x = messung[w];
      return !x || x.gruppenAnzeige.length !== 4 || !x.gruppenAnzeige.every(d => d === 'contents') ||
             x.titel.some(t => t.sichtbar !== 0);
    }).map(w => w + 'px:' + (messung[w] ? messung[w].gruppenAnzeige.join('/') + ' Titel ' + messung[w].titel.map(t => t.sichtbar).join('') : 'keine Messung'));
    merke('5b: unter der Schwelle (1560/1400/1200/1000/390) ist display=contents und kein Titel sichtbar',
      schwelleFehler.length === 0, schwelleFehler);

    // ---- 6: Die Höhe ---------------------------------------------------------------------------
    const hoheGleichFehler = HOEHE_GLEICH.filter(w => !messung[w] || !vergleich[w] || messung[w].hoehe !== vergleich[w].hoehe)
      .map(w => w + 'px: neu ' + (messung[w] ? messung[w].hoehe : '?') + ' statt ' + (vergleich[w] ? vergleich[w].hoehe : '?'));
    merke('6a: bei 1400/1200/1000/390 px ist die Leiste exakt so hoch wie am Vergleichsstand',
      hoheGleichFehler.length === 0,
      { fehler:hoheGleichFehler, gemessen: HOEHE_GLEICH.map(w => w + ':' + (messung[w] ? messung[w].hoehe : '?') + '/' + (vergleich[w] ? vergleich[w].hoehe : '?')) });
    const hoheTolFehler = HOEHE_TOLERANZ.filter(w => !messung[w] || !vergleich[w] || messung[w].hoehe - vergleich[w].hoehe > 8 || messung[w].hoehe < vergleich[w].hoehe)
      .map(w => w + 'px: neu ' + (messung[w] ? messung[w].hoehe : '?') + ' gegen ' + (vergleich[w] ? vergleich[w].hoehe : '?'));
    merke('6b: bei 1900/1600/1561 px wächst die Leiste um höchstens 8 px',
      hoheTolFehler.length === 0,
      { fehler:hoheTolFehler, gemessen: HOEHE_TOLERANZ.map(w => w + ':' + (messung[w] ? messung[w].hoehe : '?') + '/' + (vergleich[w] ? vergleich[w].hoehe : '?')) });
    // 6c misst die ZEILENZAHL statt der Pixelhoehe, und zwar ueber die verschiedenen gerundeten
    // top-Werte der Knoepfe. Das ist schriftunabhaengiger als eine Hoehe in Pixeln: eine andere
    // Schrift aendert jede Zeile um ein paar Pixel, aber nicht die Frage, wie viele Zeilen die
    // Leiste braucht. 1561 px ist dabei der eigentliche Pruefstein - die schmalste Breite MIT
    // Kacheln, laut CSS-Kommentar der Spieldatei nur 26 px Reserve. Ein vierzehnter Reiter oder
    // eine laengere Beschriftung braucht die auf, und dann faellt genau hier zuerst etwas.
    const zeilenFehler = HOEHE_TOLERANZ.filter(w => !messung[w] || messung[w].zeilen > 2)
      .map(w => w + 'px: ' + (messung[w] ? messung[w].zeilen + ' Knopfzeilen' : 'keine Messung'));
    merke('6c: oberhalb der Schwelle (1561/1600/1900 px) steht die Leiste in höchstens zwei Knopfzeilen',
      zeilenFehler.length === 0,
      { fehler:zeilenFehler, gemessen: HOEHE_TOLERANZ.map(w => w + ':' + (messung[w] ? messung[w].zeilen : '?')) });

    // ---- 7: Die Abzeichen ----------------------------------------------------------------------
    const abzFehler = ABZEICHEN_BREITEN.flatMap(w => (messung[w] ? messung[w].abzeichen : [])
      .filter(a => !a.drin).map(a => w + 'px ' + a.tab + ': Punkt ' + a.punkt.join(',') + ' Knopf ' + a.knopf.join(',')));
    merke('7a: jedes sichtbare .tab-badge liegt ganz im Rechteck seines Knopfes (1900/1600/1400/390)',
      abzFehler.length === 0, abzFehler.slice(0, 6));
    // 7a allein genuegt NICHT, und das ist gemessen: Ein overflow:hidden an der Gruppe verschiebt
    // kein einziges Rechteck (der Punkt sitzt 2 px innerhalb des Knopfes, die Gruppe hat 8 px
    // Innenabstand) - die Sabotage F blieb damit vollstaendig gruen. Beschnitten wuerde erst der
    // Schein des Punktes, und den misst kein getBoundingClientRect. Deshalb hier die Zusage selbst.
    //
    // DER NAME DIESER PRUEFUNG WAR BIS ZUM 11.09.2026 ZU GROSS. Er hiess "... und bildet keinen
    // eigenen Stapelkontext", gemessen wird aber genau die Liste unten. Die Gruppe BILDET sehr wohl
    // einen eigenen Stapelkontext: `.tab-gruppe` steht bewusst in der clip-path-Sammelregel, und
    // ein gerechneter clip-path ungleich `none` erzeugt laut Spezifikation einen. Das ist hier in
    // Ordnung, weil der Eckenschnitt die obere LINKE und die untere RECHTE Ecke nimmt (Stufe
    // --cut-sm), der .tab-badge-Punkt aber oben RECHTS im Knopf sitzt - beschnitten wird also
    // nichts, und ein Stapelkontext an der Gruppe hebt die Punkte gemeinsam mit ihren Knoepfen,
    // nicht gegen sie. Pruefung 2f verlangt den Eckenschnitt sogar ausdruecklich.
    // Wer diese Zeilen als Freibrief liest, irrt trotzdem: Was hier gemessen wird, ist genau die
    // Liste - overflow, z-index, transform, filter, isolation, Deckkraft, Mischmodus.
    const kastenFehler = !m ? ['keine Messung'] : m.gruppenKasten.filter(k =>
      k.overflow !== 'visible' || k.zIndex !== 'auto' || k.transform !== 'none' ||
      k.filter !== 'none' || k.isolation !== 'auto' || k.opacity !== '1' || k.mischung !== 'normal')
      .map(k => k.gruppe + ': ' + JSON.stringify(k));
    merke('7b: keine Gruppe setzt overflow, z-index, transform, filter, isolation, Deckkraft oder Mischmodus',
      !!m && m.gruppenKasten.length === 4 && kastenFehler.length === 0, kastenFehler);

    // ---- 8: Treffbarkeit -----------------------------------------------------------------------
    const trefferFehler = ABZEICHEN_BREITEN.flatMap(w => (messung[w] ? messung[w].treffer : [])
      .filter(t => !t.ok).map(t => w + 'px ' + t.tab + ' -> ' + t.traf));
    merke('8: die Mitte jedes der 13 Knöpfe trifft den Knopf selbst (1900/1600/1400/390)',
      trefferFehler.length === 0, trefferFehler.slice(0, 6));

    // ---- 9: Das Handy-Raster -------------------------------------------------------------------
    const h = messung[390];
    const spalten = h ? String(h.spalten).trim().split(/\s+/) : [];
    merke('9a: bei 390 px ist .tabs ein Raster mit sechs Spalten',
      !!h && h.anzeige === 'grid' && spalten.length === 6, h ? { anzeige:h.anzeige, spalten:h.spalten } : null);
    merke('9b: bei 390 px ist „Sammlung" so breit wie der Inhaltsbereich der Leiste (±2 px)',
      !!h && h.sammlungBreite !== null && Math.abs(h.sammlungBreite - h.breite) <= 2,
      h ? { sammlung:h.sammlungBreite, leiste:h.breite } : null);

    // ---- 10: Kein Querscrollen, keine Fehler ---------------------------------------------------
    merke('10: bei 390 px scrollt das Dokument nicht in die Breite',
      !!h && h.scrollBreite <= h.fensterBreite, h ? { scroll:h.scrollBreite, fenster:h.fensterBreite } : null);
    merke('J1: keine JS-Fehler beim Messen der acht Breiten', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  // ---- 4: DIE ENTSCHEIDENDE PRÜFUNG - jeder Knopf reagiert noch --------------------------------
  // Eigene Seite, weil das Durchklicken Panels lädt und damit das Layout der Messung oben verändert.
  {
    const store = { 'kepler7-save-v3': SPEICHER };
    const { ctx, page, errs } = await seite(browser, SPIEL_URL, store);
    for (const w of [UEBER_DER_SCHWELLE, 390]){
      await page.setViewportSize({ width:w, height:1000 });
      await page.waitForTimeout(260);
      await warteBisRuhe(page);
      const tabs = await page.evaluate(() => [...document.querySelectorAll('.tabs .tab-btn')].map(b => b.getAttribute('data-tab')));
      const schlecht = [];
      for (const t of tabs){
        const r = await page.evaluate(async (tab) => {
          const b = document.querySelector('.tabs .tab-btn[data-tab="' + tab + '"]');
          if (!b) return { tab, fehler:'Knopf fehlt' };
          b.click();
          await new Promise(x => setTimeout(x, 300));
          const nach = document.querySelector('.tabs .tab-btn[data-tab="' + tab + '"]');
          const p = document.getElementById('tab-' + tab);
          return { tab, aktiv: !!nach && nach.classList.contains('active'),
                   panel: !!p, panelAktiv: !!p && p.classList.contains('active'),
                   sichtbar: !!p && getComputedStyle(p).display !== 'none' };
        }, t);
        if (!(r.aktiv && r.panelAktiv && r.sichtbar)) schlecht.push(r);
      }
      merke((w === 390 ? '4b' : '4a') + ': bei ' + w + ' px schaltet jeder der ' + tabs.length + ' Knöpfe sein Panel aktiv',
        tabs.length === 13 && schlecht.length === 0, schlecht.slice(0, 4));
    }
    merke('J2: keine JS-Fehler beim Durchklicken aller Reiter', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await browser.close();
  aufraeumenVergleich();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  // Auch im catch-Zweig abraeumen - sonst bleibt genau dann eine 6,7-MB-Kopie liegen, wenn der
  // Lauf abbricht, und das ist der Fall, der sich im Betrieb wiederholt.
  aufraeumenVergleich();
  console.log('FAIL - Testlauf abgebrochen: ' + e.message);
  process.exit(1);
});
