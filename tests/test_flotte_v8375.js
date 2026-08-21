// Drei Luecken im Flottensystem, geschlossen am 02.08.2026 (v8.375.0).
//
// Wie bei den Vorgaengern wird bei jedem der drei ausdruecklich auch die BEHAUPTETE LUECKE
// mitgeprueft - ein Test, der nur "die neue Zahl existiert" prueft, wuerde nicht auffallen lassen,
// wenn die Luecke gar keine war.
//
// DIE DREI ENTSCHEIDUNGEN, DIE HIER FESTGEHALTEN WERDEN
//
//   1. Der Laderaum-Zweig wirkt PRO KLASSE, nicht pauschal - wer nur Grossfrachter aufgeruestet hat,
//      soll auch nur dort mehr laden. Und er wird nur dort beworben, wo er etwas bewirkt.
//   2. Die Konterrollen bestimmen ZUGLEICH die Werftmarken-Familie. Ein Rollenwechsel verschiebt
//      also auch die Markenzuwaechse - und muss auf BEIDEN Seiten passieren.
//   3. Die mitwandernde Kampferfahrung rechnet nur mit KAMPFSCHIFFEN. Ohne diese Einschraenkung
//      liesse sich der Rang einer Welt mit reinen Frachterfluegen leerraeumen.
const { starteBrowser, SPIELDATEI, SPIEL_URL, SERVER_JS } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const BE_PFAD = SERVER_JS;
const be = fs.existsSync(BE_PFAD) ? fs.readFileSync(BE_PFAD, 'utf8') : '';
check('Backend-Repo liegt daneben (ohne es ist die Konterrollen-Spiegelung UNGEPRUEFT)', !!be, BE_PFAD);

function schnitt(text, von, bis, ohneEnde){
  const a = text.indexOf(von);
  if (a < 0) return '';
  const b = text.indexOf(bis, a + von.length);
  return b < 0 ? '' : text.slice(a, ohneEnde ? b : b + bis.length);
}
function rollen(text, muster){
  const blk = text.slice(text.indexOf('COUNTER_ROLE_OF = {'), text.indexOf('};', text.indexOf('COUNTER_ROLE_OF = {')));
  const paare = [...blk.matchAll(muster)];
  const z = {};
  for (const m of paare) z[m[2]] = (z[m[2]] || 0) + 1;
  return { z, paare: paare.map(m => [m[1], m[2]]), summe: paare.length };
}

// ================================================================== 1) LADERAUM-ZWEIG
{
  const fam = schnitt(src, 'const SHIP_MARK_PER_STEP_FAMILIE = {', '\n  };');
  check('1: die Zivilfamilie hat einen Laderaum-Zweig', /zivil:[^\n]*cargo:0\.040/.test(fam), fam.match(/zivil:[^\n]*/));
  // Gegenprobe: NUR die Zivilfamilie. Ein Kampfschiff mit Laderaum-Zweig waere eine stille
  // Ausweitung, die niemand angekuendigt hat.
  check('1: und nur sie', (fam.match(/cargo:/g) || []).length === 1, fam.match(/cargo:/g));
  // Die Luecke selbst: die Ladekapazitaet kannte den Markenbonus nicht.
  const cap = schnitt(src, 'function fleetCargoCapacity(fleet){', '\n  }');
  // Seit v8.497.0 (dritter Frachttyp) summiert die Funktion ueber CARGO_SHIP_KEYS statt zwei
  // Klassen aufzuzaehlen - der Marken-Term steht deshalb einmal mit dem Schluessel der Schleife da
  // und gilt damit fuer JEDE Klasse. Die gepruefte Eigenschaft ist unveraendert "die Marke wirkt
  // PRO KLASSE" (Arbeitsregel 3: die Regel pruefen, nicht die Schreibweise); die Rechnung darunter
  // belegt sie ohnehin am Ergebnis.
  check('1: die Ladekapazitaet liest die Marke - und zwar je Klasse',
    /shipMarkBonus\(k, 'cargo'\)/.test(cap) && /CARGO_SHIP_KEYS/.test(cap), cap.replace(/\s+/g, ' ').slice(0, 200));
  check('1: der Modul-Bonus bleibt daneben bestehen', /shipModuleBonusFor\('frachter', 'cargo'\)/.test(cap));
  // Und rechnen: die Formel wird ausgefuehrt, nicht nur gelesen.
  const ctx = {};
  new Function('ctx', 'shipModuleBonusFor', 'shipMarkBonus', 'CARGO_SHIP_KEYS', 'CARGO_PER_SHIP',
    cap + ';ctx.f=fleetCargoCapacity;')
    (ctx, () => 0, (k) => k === 'frachter' ? 0.36 : 0, ['frachter','frachtergross'], { frachter:300, frachtergross:1000 });
  const nurKlein = ctx.f({ frachter: 10 });
  const nurGross = ctx.f({ frachtergross: 10 });
  check('1: Mk X (+36%) hebt den kleinen Frachter von 3.000 auf 4.080', nurKlein === 4080, nurKlein);
  check('1: der unaufgeruestete Grossfrachter bleibt unveraendert', nurGross === 10000, nurGross);
  // Anzeige: nur dort bewerben, wo er wirkt.
  const txt = schnitt(src, 'function shipMarkEffectText(shipKey, mk){', '\n  }');
  check('1: der Zweig wird nur bei Klassen mit Ladung beworben', /CARGO_SHIP_KEYS\.includes\(shipKey\)/.test(txt));
  // Die Liste wird seit v8.497.0 aus der Frachttabelle abgeleitet - EINE Quelle statt zweier
  // Aufzaehlungen, die auseinanderlaufen koennen. Geprueft wird genau das, nicht ihr Inhalt.
  check('1: und die Liste dafuer ist dieselbe, die die Kapazitaet summiert',
    /const CARGO_SHIP_KEYS = Object\.keys\(CARGO_PER_SHIP\);/.test(src));
}

// ================================================================== 2) KONTERROLLEN
{
  const fe = rollen(src, /(\w+):'(abfang|bomber|kapital)'/g);
  // 05.08.2026: Hier standen bis heute die LITERALE 21 und 7/6/8 - die Zahlen vom Tag des Umbaus.
  // Mit der Allianzflotte (drei neue Klassen) wurden daraus 24 und 8/7/9, und der Test schlug an,
  // obwohl die Verteilung sogar besser geworden war. Das ist derselbe Fehlertyp wie bei
  // test_bedarfsliste.js: geprueft wurde die MOMENTAUFNAHME statt der REGEL. Ein Test, der bei
  // jedem neuen Schiff von Hand nachgezogen werden muss, schuetzt beim naechsten Mal nur mit Glueck.
  //
  // Die Regel, um die es wirklich geht, steht im Kommentar der Tabelle selbst: Keine Rolle darf die
  // spaeten Klassen an sich ziehen, sonst faellt Schere-Stein-Papier im Endspiel auf "Stein gegen
  // Stein" zusammen. Messbar ist das als (a) Deckel bei der Haelfte und (b) enger Abstand zwischen
  // groesster und kleinster Rolle. Historie zum Vergleich: 5/5/11 war der Missstand (Abstand 6),
  // 7/6/8 die Reparatur (Abstand 2), 8/7/9 der heutige Stand (Abstand 2).
  check('2: es gibt ueberhaupt Angriffsklassen mit Rolle (sonst misst der Rest nichts)', fe.summe >= 21, fe.summe);
  const groesste = Math.max(fe.z.abfang, fe.z.bomber, fe.z.kapital);
  const kleinste = Math.min(fe.z.abfang, fe.z.bomber, fe.z.kapital);
  check('2: keine Rolle haelt mehr als die Haelfte aller Angriffsklassen', groesste <= Math.ceil(fe.summe/2), { groesste, summe: fe.summe });
  check('2: und der Abstand zwischen groesster und kleinster Rolle bleibt eng (hoechstens 3)',
    groesste - kleinste <= 3, Object.assign({ abstand: groesste - kleinste }, fe.z));
  check('2: jede der drei Rollen ist ueberhaupt besetzt',
    fe.z.abfang > 0 && fe.z.bomber > 0 && fe.z.kapital > 0, fe.z);
  for (const [k, r] of [['carrier','abfang'], ['riftwaechter','abfang'], ['enterschiff','bomber']]){
    check('2: ' + k + ' ist jetzt ' + r, (fe.paare.find(p => p[0] === k) || [])[1] === r,
      (fe.paare.find(p => p[0] === k) || [])[1]);
  }
  if (be){
    const b = rollen(be, /(\w+): '(abfang|bomber|kapital)'/g);
    check('2: das Backend kennt genauso viele Klassen', b.summe === fe.summe, { fe: fe.summe, be: b.summe });
    const abweichung = fe.paare.filter(([k, r]) => (b.paare.find(p => p[0] === k) || [])[1] !== r);
    check('2: JEDE Klasse hat auf beiden Seiten dieselbe Rolle', abweichung.length === 0, abweichung);
  }
  // Der Nebeneffekt, der leicht uebersehen wird: die Rolle bestimmt auch die Markenfamilie.
  check('2: die Werftmarken-Familie liest weiterhin die Konterrolle',
    /const rolle = COUNTER_ROLE_OF\[shipKey\];/.test(schnitt(src, 'function shipMarkFamily(shipKey){', '\n  }')));
}

// ================================================================== 3) ERFAHRUNG ZIEHT MIT UM
{
  // Die Ausnahme wird seit v8.497.0 nicht mehr aufgezaehlt, sondern aus CARGO_SHIP_KEYS gelesen -
  // sonst haette der dritte Frachter hier still als Kampfschiff gezaehlt. Geprueft wird weiterhin
  // die Eigenschaft "aus den Angriffsklassen ABGELEITET, Transporter ausgenommen".
  check('3: es gibt eine Kampfschiff-Liste, aus den Angriffsklassen abgeleitet',
    /const KAMPF_SHIP_KEYS = ATTACK_SHIP_KEYS\.filter\(k => !CARGO_SHIP_KEYS\.includes\(k\)\);/.test(src));
  const ab = schnitt(src, 'const vetMit = (() => {', '})();');
  check('3: der Abzug beim Abflug existiert', ab.length > 200);
  check('3: er rechnet nur mit Kampfschiffen', /KAMPF_SHIP_KEYS\.includes\(shipKey\)/.test(ab));
  check('3: der Anteil ist bei 100% gedeckelt', /Math\.min\(1, amount \/ gesamt\)/.test(ab));
  check('3: die Erfahrung reist an der Mission mit', /vetXp: vetMit \}\);/.test(src));
  check('3: sie wird bei der Ankunft gutgeschrieben', /if \(m\.vetXp > 0\) addVeteranXp\(m\.targetId, m\.vetXp\);/.test(src));
  check('3: und bei einer Umkehr an den Ausgangsort zurueckgegeben',
    /if \(m\.vetXp > 0\) addVeteranXp\(planetKey, m\.vetXp\);/.test(src));
  // Die Rechnung ausfuehren: halbe Flotte -> halbe Erfahrung, Frachter -> nichts.
  const anteil = (shipKey, amount, flotte, xp) => {
    const ctx = {};
    new Function('ctx', 'state', 'fromPlanet', 'shipKey', 'amount', 'fromFleet', 'KAMPF_SHIP_KEYS', 'addVeteranXp',
      schnitt(src, 'const vetMit = (() => {', '})();') + 'ctx.v=vetMit;')
      (ctx, { veteranXp: { A: xp } }, 'A', shipKey, amount, flotte,
       ['jaeger','cruisers','destroyers','bomber','schlachtschiff','carrier'], () => {});
    return ctx.v;
  };
  check('3: die halbe Kampfflotte nimmt die halbe Erfahrung mit',
    anteil('jaeger', 50, { jaeger: 100 }, 1000) === 500, anteil('jaeger', 50, { jaeger: 100 }, 1000));
  check('3: die ganze Flotte nimmt alles mit',
    anteil('jaeger', 100, { jaeger: 100 }, 1000) === 1000);
  check('3: ein Frachterflug nimmt NICHTS mit - sonst waere der Rang leerraeumbar',
    anteil('frachter', 100, { jaeger: 100, frachter: 100 }, 1000) === 0);
  check('3: ohne Erfahrung am Ausgangsort passiert nichts',
    anteil('jaeger', 50, { jaeger: 100 }, 0) === 0);
  check('3: eine leere Flotte stuerzt nicht ab', anteil('jaeger', 5, {}, 1000) === 0);
}

// ================================================================== HILFE
{
  const von = src.indexOf('const HELP_SECTIONS');
  const bis = src.indexOf('let helpOpenSections', von);
  const hilfe = (von > 0 && bis > von) ? src.slice(von, bis) : '';
  check('H: HELP_SECTIONS-Block ausgeschnitten', hilfe.length > 50000, hilfe.length);
  for (const [was, wort] of [['den Laderaum-Zweig','Laderaum'], ['die Rollenwechsel','Riftwächter'],
                             ['die mitwandernde Erfahrung','zieht die Erfahrung mit um']]){
    check('H: die Hilfe erklaert ' + was, hilfe.includes(wort));
  }
}

// ================================================================== BROWSER
(async () => {
  const store = { 'kepler7-save-v3': JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ flotte:1 },
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:22, mine:20, labor:14, werft:15, lager:14 }, research:{ rsolar:8 },
    fleet:{ jaeger:200, frachter:40, carrier:5, missions:[] }, colonies:{}, activeBasePlanet:'home',
    shipMarks:{ frachter:10 },
    player:{ id:'u', name:'K', allianceTag:'', avatarKey:null }, xp:120000, buffs:[], lastTick:Date.now() }) };
  const backend = async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'K', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
  const b = await starteBrowser();
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend);
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
    const t = document.querySelector('.tab-btn[data-tab="flotte"]'); if (t) t.click();
  });
  await page.waitForTimeout(1200);
  const sicht = await page.evaluate(() => {
    const kopie = document.body.cloneNode(true);
    kopie.querySelectorAll('script, style, template').forEach(e => e.remove());
    return kopie.textContent || '';
  });
  // Der Frachter steht im Spielstand auf Mk X - seine Wirkungszeile muss den Laderaum nennen.
  check('B: die Werft nennt beim Frachter den Laderaum-Zuwachs', /% Laderaum/.test(sicht), sicht.length);
  check('B: keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
