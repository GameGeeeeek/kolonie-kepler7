// Füllbalken der sechs Kernressourcen trägt die Ressourcenfarbe (Gleichmaß Etappe 1, 11.09.2026).
//
// AUSGANGSLAGE: resCardState() lieferte als Balkenfarbe „isFull ? '#e0a548' : d.color". RES_DEFS
// kennt aber kein Feld color, nur bg und fg. Der Balken bekam damit unter 100 % den Wert
// „background:undefined" - eine ungültige Deklaration, die der Browser verwirft. Und weil .t2-fill
// im Stylesheet keine Grundfarbe hat, war der Balken unter dem Deckel schlicht UNSICHTBAR; nur bei
// vollem Lager wurde er bernsteinfarben. Die Karte versprach damit einen Füllstand, den niemand
// sehen konnte. Seit v8.720.0 + Etappe 1 nimmt die Farbe d.fg.
//
// WAS DIESER TEST FÄNGT (Fehlklassen):
//   a) Die Farbquelle rutscht zurück auf ein Feld, das RES_DEFS nicht hat (d.color) - dann ist der
//      Balken wieder unsichtbar. Gemessen wird der GERECHNETE Hintergrund im Browser, nicht nur der
//      Quelltext, und verglichen mit dem fg-Wert, der in RES_DEFS steht (aus der Datei gelesen).
//   b) Der Teil-Update-Pfad (jeder Tick nach dem Erstaufbau) hört auf, die Farbe mitzuziehen. Ein
//      Test, der nur den Erstaufbau misst, wäre dann trivial grün - deshalb wird der Bestand NACH
//      dem Laden umgestellt (Erz voll, Kristalle halb) und erst nach einem Tick gemessen: Dieser
//      Farbwechsel kann nur aus dem Teil-Update-Pfad kommen.
//   c) Die Bernstein-Regel bei vollem Lager (gab es vorher schon) und die Vorwarnstufe t2-near
//      bleiben erhalten.
//
// SPIELSTAND: nur Lagerkomplexe, KEINE Produzenten - sonst verschieben sich die Bestände in den
// Sekunden bis zur Messung (Lehre aus test_tier2_hinweis). Erwartet wird nicht eine eingetippte
// Zahl, sondern das Verhältnis Bestand/Deckel, beides im Browser aus state und storageCap() gelesen.
//
// GEGENPROBEN (KEPLER_LAGERBALKEN_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umgelenkt):
//   =alt         unveränderte v8.720.0 (d.color) - Quelltext, Farbe unter dem Deckel, Vorwarnstufe
//                und die Erz-Korrektur im Teil-Update fallen; Bernstein bei voll bleibt grün.
//   =sabotageA   fillColor wieder auf d.color - wie alt, nur aus der aktuellen Datei gebaut.
//   =sabotageB   die Zeile „fillEl.style.background = st.fillColor;" im Teil-Update-Pfad entfernt -
//                nur die Korrektur der untergeschobenen Fremdfarbe (5b, 5c) erwischt das.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren } = require('./lib/umgebung');

const ergebnis = {};
let fail = false;
// Jede Prüfung trägt ihr Ergebnis unter dem Kürzel vor dem Doppelpunkt ein - auch die
// Vorbedingungen (0x) und der JS-Fehler-Zähler. Die Gegenprobe unten vergleicht genau diese Kürzel
// mit der gemessenen MUSS_FALLEN-Liste; ein Fehlschlag, der dort nicht steht, ist ÜBERZÄHLIG.
const check = (n, c, x) => { ergebnis[String(n).split(':')[0]] = !!c; console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = check;
const SAB = process.env.KEPLER_LAGERBALKEN_GEGENPROBE || '';
// GEMESSEN am 11.09.2026 (erst laufen lassen, dann eingetragen):
const MUSS_FALLEN = {
  // d.color: Quelltext, Erz-Farbe (Erstaufbau UND nach 2,5 s), Deuterium-Farbe, die Korrektur des
  // Erz-Balkens nach der Fremdfarbe (der alte Pfad schreibt „undefined", der Browser verwirft es,
  // die Fremdfarbe bleibt stehen) und die Sechser-Prüfung. Bernstein bei voll (3b, 5c) bleibt grün.
  alt:       ['1', '2a', '2b', '4b', '5a', '5b', '6'],
  sabotageA: ['1', '2a', '2b', '4b', '5a', '5b', '6'],
  // Ohne die Teil-Update-Zeile bleibt die Fremdfarbe an BEIDEN Balken stehen; der Erstaufbau
  // (2a-4b) ist davon unberührt - genau deshalb reicht 5a allein nicht als Wächter.
  sabotageB: ['5b', '5c']
};

// ---------------------------------------------------------------------------------------------
// 1) Quelltext: resCardState() nimmt d.fg, nicht d.color
// ---------------------------------------------------------------------------------------------
const src = fs.readFileSync(SPIELDATEI, 'utf8');
function funktionsRumpf(name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  const klammer = src.indexOf('{', start);
  if (klammer < 0) return null;
  let tiefe = 0;
  for (let i = klammer; i < src.length; i++){
    if (src[i] === '{') tiefe++;
    else if (src[i] === '}'){ tiefe--; if (tiefe === 0) return src.slice(start, i + 1); }
  }
  return null;
}
const rumpf = funktionsRumpf('resCardState');
check('0a: function resCardState(...) ist im Quelltext auffindbar', !!rumpf);
const fillZeile = rumpf ? (rumpf.split('\n').find(z => /fillColor\s*:/.test(z)) || '') : '';
merke('1: die fillColor-Zeile von resCardState nimmt d.fg und nirgends im Rumpf steht d.color',
  !!rumpf && /\bd\.fg\b/.test(fillZeile) && !/\bd\.color\b/.test(rumpf), fillZeile.trim());

// fg-Farben aus RES_DEFS lesen - nicht eintippen. Der Block wird per Anker ausgeschnitten, damit
// ein gleichnamiger key an anderer Stelle der Datei nicht dazwischenfunkt.
const defsVon = src.indexOf('  const RES_DEFS = [');
const defsBis = defsVon < 0 ? -1 : src.indexOf('\n  ];', defsVon);
check('0b: RES_DEFS ist per Anker ausschneidbar', defsVon >= 0 && defsBis > defsVon);
const defsBlock = defsVon >= 0 && defsBis > defsVon ? src.slice(defsVon, defsBis) : '';
function fgAus(key){
  const m = defsBlock.match(new RegExp("key:'" + key + "'[^}]*fg:'(#[0-9a-fA-F]{6})'"));
  return m ? m[1] : null;
}
// Hex -> „rgb(r, g, b)" in der Schreibweise, die getComputedStyle liefert.
const hexZuRgb = (hex) => hex ? 'rgb(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')' : null;
const FG = { erz: fgAus('erz'), kristalle: fgAus('kristalle'), deuterium: fgAus('deuterium') };
check('0c: fg-Farben für Erz, Kristalle und Deuterium stehen in RES_DEFS', !!(FG.erz && FG.kristalle && FG.deuterium), FG);
const BERNSTEIN = hexZuRgb('#e0a548');
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

// ---------------------------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------------------------
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'reports') return j({ reports: [] });
  if (p === 'pending-rewards/claim') return j({ reward: null });
  if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT') return j({ ok: true, version: 2 }); if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 }); return j({ e: 1 }, 404); }
  return j([]);
}; }

// Lagerdeckel OHNE Gebäude und Flotte: die 800 Basis aus storageCap(). Bewusst so klein, dass alle
// Bestände unter 1000 liegen - fmt() schreibt sie dann EXAKT in die Karte ("400 / 800"), und der
// Erwartungswert für die Balkenbreite lässt sich aus dem angezeigten Text ableiten. (Der Spielcode
// liegt in einer IIFE; state und storageCap() sind aus page.evaluate nicht erreichbar, deshalb
// ist die Karte selbst die Messquelle.) Die ANNAHME 800 wird in 0d gegen den angezeigten Deckel
// geprüft - stimmt sie nicht mehr, fällt die Vorbedingung mit klarer Meldung.
// lastLoginDate = heute: Sonst bucht der tägliche Login-Bonus beim Laden +120 Erz (gemessen:
// 400 wurden 520), und „etwa 50 %" wäre keins mehr.
const DECKEL_ANNAHME = 800;
const ANTEIL = { energie: 0.30, erz: 0.50, kristalle: 1.00, deuterium: 0.90, antimaterie: 0.10, forschungspunkte: 0.20 };
const spielstand = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true, lastLoginDate: new Date().toDateString(),
  resources: Object.fromEntries(Object.entries(ANTEIL).map(([k, a]) => [k, DECKEL_ANNAHME * a])),
  buildings: {}, research: {}, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A', avatarKey: null }, xp: 0, credits: 0,
  buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

// Liest je Kernkarte in #resbar: Klassen, gerechnete Balkenfarbe, Balkenbreite sowie Bestand und
// Deckel aus dem Kartentext „<Bestand> / <Deckel>" - der Erwartungswert kommt aus derselben Karte.
const messung = () => {
  const bar = document.getElementById('resbar');
  if (!bar) return null;
  const karten = {};
  bar.querySelectorAll('.rescard[data-res]').forEach(k => {
    const fill = k.querySelector('.t2-fill');
    const wert = ((k.querySelector('.value') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const m = wert.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
    karten[k.getAttribute('data-res')] = {
      full: k.classList.contains('t2-full'), near: k.classList.contains('t2-near'),
      hatBalken: !!fill,
      farbe: fill ? getComputedStyle(fill).backgroundColor : null,
      breite: fill ? parseFloat(fill.style.width) : null,
      wert, bestand: m ? parseFloat(m[1]) : null, deckel: m ? parseFloat(m[2]) : null
    };
  });
  return { karten };
};
// Erwartete Breite aus dem GEMESSENEN Kartentext: Bestand / Deckel · 100.
const sollBreite = (k) => (k && k.deckel > 0 && k.bestand !== null) ? Math.min(100, k.bestand / k.deckel * 100) : NaN;

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));

  let m1 = null;
  try { m1 = await page.evaluate(messung); } catch (e) { console.log('Messung 1 fehlgeschlagen: ' + e.message); }
  const k1 = (m1 && m1.karten) || {};
  check('0d: Vorbedingung - #resbar steht, der angezeigte Deckel ist die Annahme, Erz bei 40-60 %, Kristalle am Deckel, Deuterium in 85-99 %',
    !!m1 && ['erz', 'kristalle', 'deuterium'].every(r => k1[r] && k1[r].deckel === DECKEL_ANNAHME)
      && sollBreite(k1.erz) >= 40 && sollBreite(k1.erz) <= 60
      && k1.kristalle.bestand >= k1.kristalle.deckel
      && sollBreite(k1.deuterium) >= 85 && sollBreite(k1.deuterium) < 100,
    m1 && { erz: k1.erz && k1.erz.wert, kristalle: k1.kristalle && k1.kristalle.wert, deuterium: k1.deuterium && k1.deuterium.wert });

  // ============================== 2) Erz bei etwa 50 %: Balken sichtbar und in fg-Farbe
  merke('2a: der Erz-Balken hat einen gerechneten Hintergrund, der nicht transparent ist',
    !!k1.erz && k1.erz.hatBalken && !!k1.erz.farbe && k1.erz.farbe !== TRANSPARENT, k1.erz && k1.erz.farbe);
  merke('2b: und zwar genau die fg-Farbe von Erz aus RES_DEFS',
    !!k1.erz && k1.erz.farbe === hexZuRgb(FG.erz), { ist: k1.erz && k1.erz.farbe, soll: hexZuRgb(FG.erz) });
  merke('2c: die Balkenbreite entspricht Bestand/Deckel aus dem Kartentext (±2 Prozentpunkte)',
    !!k1.erz && Math.abs(k1.erz.breite - sollBreite(k1.erz)) <= 2, { ist: k1.erz && k1.erz.breite, soll: sollBreite(k1.erz) });

  // ============================== 3) Kristalle am Deckel: Bernstein und t2-full
  merke('3a: die Kristall-Karte trägt t2-full', !!k1.kristalle && k1.kristalle.full, k1.kristalle);
  merke('3b: und ihr Balken ist bernsteinfarben', !!k1.kristalle && k1.kristalle.farbe === BERNSTEIN, { ist: k1.kristalle && k1.kristalle.farbe, soll: BERNSTEIN });

  // ============================== 4) Deuterium in der Vorwarnstufe (≈90 %): t2-near, fg-Farbe
  merke('4a: die Deuterium-Karte trägt t2-near und NICHT t2-full', !!k1.deuterium && k1.deuterium.near && !k1.deuterium.full, k1.deuterium);
  merke('4b: ihr Balken bleibt in der fg-Farbe von Deuterium - Bernstein ist dem vollen Lager vorbehalten',
    !!k1.deuterium && k1.deuterium.farbe === hexZuRgb(FG.deuterium), { ist: k1.deuterium && k1.deuterium.farbe, soll: hexZuRgb(FG.deuterium) });

  // ============================== 5) Teil-Update-Pfad
  // Nach dem Erstaufbau läuft jeder Sekunden-Tick durch den Teil-Update-Zweig, der Breite UND Farbe
  // neu setzt. 5a: nach weiteren 2,5 s stehen die Farben noch - das allein beweist aber nur, dass
  // niemand sie WEGnimmt. 5b/5c: deshalb wird dem Balken eine FREMDFARBE untergeschoben (und eine
  // falsche Breite), und nach einem Tick muss die richtige wieder dastehen. Nur der Teil-Update-
  // Pfad kann das leisten, ein Neuaufbau der Kartenstruktur steht nicht an. (Den Bestand selbst
  // umzustellen ginge nur über state - das liegt in der IIFE und ist von außen nicht erreichbar.)
  await page.waitForTimeout(2500);
  let m2 = null;
  try { m2 = await page.evaluate(messung); } catch (e) { console.log('Messung 2 fehlgeschlagen: ' + e.message); }
  const k2 = (m2 && m2.karten) || {};
  merke('5a: nach 2,5 s im Teil-Update-Pfad hat Erz weiterhin die fg-Farbe und Kristalle Bernstein',
    !!k2.erz && !!k2.kristalle && k2.erz.farbe === hexZuRgb(FG.erz) && k2.kristalle.farbe === BERNSTEIN,
    { erz: k2.erz && k2.erz.farbe, kristalle: k2.kristalle && k2.kristalle.farbe });

  const FREMD = 'rgb(1, 2, 3)';
  let untergeschoben = null;
  try {
    untergeschoben = await page.evaluate((fremd) => {
      const out = {};
      ['erz', 'kristalle'].forEach(r => {
        const fill = document.querySelector('#resbar .rescard[data-res="' + r + '"] .t2-fill');
        if (!fill) { out[r] = null; return; }
        fill.style.background = fremd; fill.style.width = '1%';
        out[r] = getComputedStyle(fill).backgroundColor;
      });
      return out;
    }, FREMD);
  } catch (e) { console.log('Unterschieben fehlgeschlagen: ' + e.message); }
  check('0e: Vorbedingung - die Fremdfarbe steht wirklich am Balken, bevor der nächste Tick läuft',
    !!untergeschoben && untergeschoben.erz === FREMD && untergeschoben.kristalle === FREMD, untergeschoben);
  await page.waitForTimeout(1600);
  let m3 = null;
  try { m3 = await page.evaluate(messung); } catch (e) { console.log('Messung 3 fehlgeschlagen: ' + e.message); }
  const k3 = (m3 && m3.karten) || {};
  merke('5b: ein Tick später hat der Teil-Update-Pfad den Erz-Balken wieder auf die fg-Farbe gesetzt',
    !!k3.erz && k3.erz.farbe === hexZuRgb(FG.erz), { ist: k3.erz && k3.erz.farbe, soll: hexZuRgb(FG.erz) });
  merke('5c: und den vollen Kristall-Balken wieder auf Bernstein',
    !!k3.kristalle && k3.kristalle.farbe === BERNSTEIN, { ist: k3.kristalle && k3.kristalle.farbe, soll: BERNSTEIN });
  merke('5d: und die Breiten stehen wieder auf Bestand/Deckel (±2 Prozentpunkte)',
    !!k3.erz && !!k3.kristalle
      && Math.abs(k3.erz.breite - sollBreite(k3.erz)) <= 2
      && Math.abs(k3.kristalle.breite - sollBreite(k3.kristalle)) <= 2,
    { erz: k3.erz && k3.erz.breite, kristalle: k3.kristalle && k3.kristalle.breite });

  // ============================== 6) Alle sechs Kernkarten haben einen sichtbaren Balken
  const alle = Object.keys(k1);
  const ohne = alle.filter(r => !k1[r].hatBalken || !k1[r].farbe || k1[r].farbe === TRANSPARENT);
  merke('6: jede der sechs Kernkarten hat einen .t2-fill mit nicht-transparentem Hintergrund',
    alle.length === 6 && ohne.length === 0, { karten: alle.length, ohneFarbe: ohne });

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await ctx.close();
  await browser.close();

  // ============================== Gegenprobe
  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollständig: ' + fehlend.join(' ') + ' blieben grün');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe ÜBERZÄHLIG: ' + unerwartet.join(' ') + ' fiel zusätzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
