// SP-3: Fortschritt und Galaxie sagen, WAS fehlt - und der Weg zur Auswahl ist keine Sackgasse mehr.
//
// DRITTE FOLGE von SP-1 (Forschung) und SP-2 (Werft). Der Befund ist zum vierten Mal derselbe:
// Der Klickpfad prueft laengst jeden Sperrgrund und hat fuer jeden eine fertige Meldung -
// buySkillNode, buySkillMastery und setShipSkin tun das seit jeher. Erreichbar war keine davon,
// weil der Knopf `disabled` trug und der Klick nie ankam.
//
// GEMESSEN am 04.09.2026 im Browser, alle Abschnitte aufgeklappt: 37 gesperrte Knoepfe im Reiter
// Fortschritt, 34 in Galaxie. Nicht alle sind ein Problem. Die Linie verlaeuft NICHT bei "Knopf
// ist grau", sondern bei "steht der Grund im Bild?":
//   - Wo Kosten und Vorrat sichtbar danebenstehen (Megabauten, Artefakt-Set, Abgrund-Werkstatt,
//     Kosmetik) bleibt der Riegel. Der Grund ist ablesbar, nur eben als Rechnung.
//   - Wo eine NICHT-monetaere Bedingung unvollstaendig benannt war, wird gehandelt.
// Behandelt sind damit drei Faelle:
//
//   A) DER FAEHIGKEITSBAUM (26 Knoepfe). Die Zeile nannte bei fehlender Vorstufe nur das Wort
//      "Vorstufe" - welche, stand nirgends, waehrend die Meisterschaftszeile direkt darunter den
//      Namen seit jeher fuehrt. Und "nicht genug Faehigkeitspunkte" stand an der Zeile gar nicht.
//
//   B) DER FLOTTEN-ANSTRICH (5 Knoepfe). Hier ist der Fall am schaerfsten: Der Grund stand
//      woertlich im Markup - aber im `title`, und ein title ist am Handy nicht abrufbar, weil es
//      dort kein Hover gibt. Die Auskunft existierte und war fuer die halbe Spielerschaft
//      strukturell unsichtbar.
//
//   C) DIE ANGRIFFSKNOEPFE (NPC, Piraten-Versteck, Abgrund, Spielerangriff). Hier war der Riegel
//      nicht nur stumm, sondern eine SACKGASSE: Er sperrte bei "keine Schiffe gewaehlt" genau den
//      Knopf, der das Menue oeffnet, in dem man waehlt.
//
// NACHTRAG AUS DER ADVERSARISCHEN DURCHSICHT (04.09.2026) - der schwerste Befund kam nicht aus
// dem Riegel, sondern aus dem TEXT, der ihn ersetzte: "Dafuer fehlen dir Kampfschiffe - bau in
// der Werft welche" ist FALSCH, sobald Jaeger dastehen. combatFleetCount zaehlt Jaeger und Bomber
// nur, soweit Hangarplaetze da sind; ohne Traegerschiff sind das null. Wer 60 Jaeger und keinen
// Traeger hat, wurde Jaeger nachbauen geschickt - und waere fuer immer in derselben Meldung
// haengen geblieben. Das Spiel nennt genau diese Verwechslung in seiner eigenen Hilfe die
// "haeufigste". Pruefung 13 haelt diesen Fall fest.
//
// GEGENPROBE (gemessen am Stand vor der Aenderung): Es MUESSEN fallen - 1, 2, 4 (Baum), 6, 7
// (Anstrich), 8, 9, 10, 11, 12 (Angriff), 13 (Hangar), 14 (Spielerangriff), 15 (Kartenmenue).
// Gruen bleiben MUESSEN die Anker 0 und 3 sowie die Gegenrichtung 16.
//
// ZWEI LEHREN DERSELBEN DURCHSICHT, hier von Anfang an angewandt:
//   1. Eine Pruefung der Form "kein Knopf traegt disabled" ist LEER, wenn es gar keine Knoepfe
//      gibt. Jede fuehrt deshalb ihre eigene Bezugsgroesse mit.
//   2. Zwei WORTGLEICHE Meldungen kann keine Log-Pruefung auseinanderhalten. Der erste Anlauf
//      dieses Tests meldete fuer das Piraten-Versteck Erfolg, obwohl dessen Meldung vollstaendig
//      entfernt worden war - er las die Zeile der vorigen Pruefung. Deshalb hat jetzt jeder
//      Angriffszweig einen EIGENEN Wortlaut, und gemessen wird ueber logMarke(), das den alten
//      Text als Wasserzeichen festhaelt, statt den Mitschnitt zu leeren.
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer, logMitschnitt, logMarke, ruhigeUhren } = require('./lib/umgebung');
const fs = require('fs');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

/* Riegel gegen die gespaltene Gegenprobe (Lehre aus SP-2): SPIELDATEI folgt KEPLER_SPIELDATEI,
   DATEI folgt KEPLER_TESTDATEI. Wer nur eine der beiden umleitet, laedt die eine Fassung und
   liest die Merkmale aus der anderen - der Test misst dann zwei verschiedene Staende. */
if (process.env.KEPLER_TESTDATEI && !process.env.KEPLER_SPIELDATEI){
  console.log('FAIL - KEPLER_TESTDATEI ohne KEPLER_SPIELDATEI: geladene und gelesene Fassung liefen auseinander');
  process.exit(1);
}

const QUELLE = fs.readFileSync(SPIELDATEI, 'utf8');

/* Der Abgrund haengt an einer Forschung. Ihren Schluessel aus der Spieldatei LESEN, nicht
   eintippen: Wird er dort umbenannt, faellt dieser Test mit einer Meldung, die den Grund nennt -
   statt still einen verschlossenen Abgrund zu messen und "kein Riegel" zu melden, weil es gar
   keinen Knopf gibt. Genau so ist der erste Anlauf hier hereingefallen. */
function abgrundForschung(){
  const m = QUELLE.match(/ABGRUND_REQ_RESEARCH\s*=\s*'([a-z0-9_]+)'/);
  return m ? m[1] : null;
}

/* Namen UND Voraussetzungen der Faehigkeitsknoten aus der Spieldatei lesen. Der erste Anlauf
   hatte die Zuordnung { eco2:'eco1', ... } eingetippt und gar nicht benutzt - die Pruefung war
   damit mit JEDEM Knotennamen zufrieden, auch dem falschen (in der Durchsicht bewiesen: eine
   Kopie, die den Knoten SELBST statt seiner Vorstufe nennt, blieb gruen). */
function skillKnoten(){
  const i = QUELLE.indexOf('const SKILL_TREE = [');
  if (i < 0) return null;                                   // Anker vor Benutzung pruefen
  const j = QUELLE.indexOf('\n  ];', i);
  if (j < 0) return null;
  const knoten = {};
  for (const m of QUELLE.slice(i, j).matchAll(/key:'([a-z0-9]+)'[^\n]*?name:'([^']+)'[^\n]*?requires:(null|'[a-z0-9]+')/g))
    knoten[m[1]] = { name: m[2], requires: m[3] === 'null' ? null : m[3].slice(1, -1) };
  return Object.keys(knoten).length ? knoten : null;
}

const ABGRUND_KEY = abgrundForschung();
/* ruhigeUhren() gehoert ins Fixture: Ohne sie mischen sich Planeten-Ereignisse in den
   Log-Mitschnitt. Fuer log.some(...) harmlos - aber im Fehlschlag zeigt der Beleg dann eine
   Fremdmeldung statt der Lage, und genau dafuer ist der Beleg da (Befund der Durchsicht). */
const stand = (extra) => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen:true, newbieWelcomeSeen:true,
  seenTabHints:{ basis:1, forschung:1, flotte:1, karte:1, galaxie:1, fortschritt:1 },
  resources:{energie:9e5,erz:9e5,kristalle:9e5,deuterium:9e5,antimaterie:900,forschungspunkte:900},
  buildings:{solar:20,mine:18,labor:10,lager:40,werft:14},
  // Abgrund freigeschaltet - sonst gibt es den Abtauchen-Knopf gar nicht und die Pruefung misst nichts.
  research: ABGRUND_KEY ? { [ABGRUND_KEY]: 1 } : {},
  fleet:{ missions:[] }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'Ich',avatarKey:null},
  xp:0, credits:5000, buffs:[], lastTick:Date.now(), colonyNames:{}
}, extra||{}));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId:'u', username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
  if (p.startsWith('storage/')) { const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ok:true}); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 }); return j({e:1}, 404); }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function seite(browser, spielstand){
  const page = await (await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true })).newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await logMitschnitt(page);
  await page.goto(DATEI); await page.waitForTimeout(2800);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }); });
  return { page, fehler };
}
const zumReiter = (page, tab) => page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="'+t+'"]'); if (b) b.click(); }, tab);
const wahlOffen = (page) => page.evaluate(() => !!document.querySelector('[data-fwahl-start]'));

/* Ein Klick, sauber gemessen: Marke setzen, klicken, NUR die seither erschienenen Zeilen lesen
   und dazu, ob sich die Flottenwahl geoeffnet hat. Beides zusammen ist die Aussage - eine
   Meldung ohne "das Menue blieb zu" belegt nicht, dass der Klick wirklich abgewiesen wurde. */
async function klickUndMiss(page, klick){
  const seither = await logMarke(page);
  await page.evaluate(klick);
  await page.waitForTimeout(800);
  return { neu: await seither(), offen: await wahlOffen(page) };
}

(async () => {
  const browser = await starteBrowser();
  const knoten = skillKnoten();
  check('0-vorab: Knoten samt Voraussetzungen aus der Spieldatei gelesen',
        !!knoten && Object.keys(knoten).length >= 8 && Object.values(knoten).some(k => k.requires),
        knoten ? Object.keys(knoten).length : 'SKILL_TREE nicht gefunden');
  check('0-vorab: Abgrund-Forschungsschluessel aus der Spieldatei gelesen', !!ABGRUND_KEY, ABGRUND_KEY);

  // ============================ Lage 1: Anfaenger, keine Kampfschiffe ============================
  const { page, fehler } = await seite(browser, stand({}));
  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---------------------------------- A: der Faehigkeitsbaum ----------------------------------
  await zumReiter(page, 'fortschritt');
  await page.waitForTimeout(1200);
  await page.evaluate(() => { document.querySelectorAll('#tab-fortschritt [data-sec-toggle]').forEach(h => {
    const s = h.closest('.prog-section'); if (s && !s.classList.contains('open')) h.click(); }); });
  await page.waitForTimeout(1600);

  const baum = await page.evaluate(() => {
    const alle = Array.from(document.querySelectorAll('#skillTreeBox [data-skillnode], #skillTreeBox [data-skillmastery]'));
    return { gesamt: alle.length, gesperrt: alle.filter(b => b.disabled).length };
  });
  check('1: Faehigkeitsbaum - kein Knopf mehr gesperrt (und es gibt welche)',
        baum.gesamt >= 20 && baum.gesperrt === 0, baum);

  const ersterKnoten = await page.evaluate(() => {
    const b = document.querySelector('#skillTreeBox [data-skillnode]');
    return b ? b.getAttribute('data-skillnode') : null;
  });
  const punkte = await klickUndMiss(page, () => {
    const b = document.querySelector('#skillTreeBox [data-skillnode]'); if (b) b.click();
  });
  check('2: Klick ohne Punkte nennt die fehlenden Faehigkeitspunkte',
        !!ersterKnoten && punkte.neu.some(z => /Nicht genug Fähigkeitspunkte/.test(z)),
        { ersterKnoten, neu: punkte.neu });

  const nochDa = await page.evaluate(k => !!document.querySelector('#skillTreeBox [data-skillnode="'+k+'"]'), ersterKnoten);
  check('3-anker: der abgewiesene Klick hat nichts freigeschaltet', nochDa === true, { ersterKnoten, nochDa });

  // Ein Knoten MIT Vorstufe: seine Zeile muss GENAU DIESE Vorstufe nennen - nicht irgendeinen
  // Namen und nicht sich selbst.
  const vorstufe = await page.evaluate(() => {
    for (const z of Array.from(document.querySelectorAll('#skillTreeBox .card-row'))){
      const b = z.querySelector('[data-skillnode]');
      const t = (z.querySelector('.bmeta')||{}).textContent || '';
      if (b && /benötigt/.test(t)) return { key: b.getAttribute('data-skillnode'), text: t.trim() };
    }
    return null;
  });
  const noetig = vorstufe && knoten && knoten[vorstufe.key] ? knoten[vorstufe.key].requires : null;
  const erwarteterName = noetig && knoten[noetig] ? knoten[noetig].name : null;
  check('4: die Zeile nennt GENAU die fehlende Vorstufe beim Namen',
        !!erwarteterName && vorstufe.text.includes(erwarteterName)
          && !/benötigt Vorstufe/.test(vorstufe.text),
        { vorstufe, erwarteterName });

  // ------------------------------------ B: der Flotten-Anstrich ------------------------------------
  // Selektor auf den geprueften Container begrenzt (Hausregel), nicht aufs ganze Dokument.
  const skins = await page.evaluate(() => {
    const alle = Array.from(document.querySelectorAll('#commanderProfileBox [data-ship-skin]'));
    const zu = alle.filter(b => /Gesperrt/.test(b.getAttribute('title')||''));
    return { gesamt: alle.length, gesperrt: alle.filter(b => b.disabled).length,
             lautTitel: zu.length, ersterZu: zu.length ? zu[0].getAttribute('data-ship-skin') : null };
  });
  check('5-anker: es gibt ueberhaupt gesperrte Anstriche zu messen', skins.gesamt >= 5 && skins.lautTitel >= 1, skins);
  check('6: Flotten-Anstrich - kein Knopf mehr gesperrt (und es gibt welche)',
        skins.gesamt >= 5 && skins.gesperrt === 0, skins);

  const anstrich = await klickUndMiss(page, () => {
    const b = document.querySelector('#commanderProfileBox [data-ship-skin][title*="Gesperrt"]'); if (b) b.click();
  });
  check('7: Klick auf einen gesperrten Anstrich nennt die Bedingung',
        anstrich.neu.some(z => /Flotten-Lackierung ist noch nicht freigeschaltet/.test(z)),
        { ersterZu: skins.ersterZu, neu: anstrich.neu });

  // ------------------------------ C: die Angriffsknoepfe ohne Flotte ------------------------------
  await zumReiter(page, 'galaxie');
  await page.waitForTimeout(1800);

  const npc = await page.evaluate(() => {
    const alle = Array.from(document.querySelectorAll('#npcList [data-attack]'));
    return { gesamt: alle.length, gesperrt: alle.filter(b => b.disabled).length,
             zeile: ((document.querySelector('#npcList .bmeta')||{}).textContent||'').trim() };
  });
  check('8: NPC-Angriff - kein Knopf mehr gesperrt (und es gibt welche)',
        npc.gesamt >= 10 && npc.gesperrt === 0, { gesamt: npc.gesamt, gesperrt: npc.gesperrt });
  check('9: ohne Kampfschiffe sagt die Zeile das auch - statt „keine Schiffe gewählt"',
        /noch keine Kampfschiffe gebaut/.test(npc.zeile) && !/keine Schiffe gewählt/.test(npc.zeile), npc.zeile);

  const npcKlick = await klickUndMiss(page, () => {
    const b = document.querySelector('#npcList [data-attack]'); if (b) b.click();
  });
  check('10: der NPC-Klick nennt den Grund, statt stumm ein leeres Menue zu oeffnen',
        npcKlick.neu.some(z => /Für einen Angriff fehlen dir Kampfschiffe/.test(z)) && npcKlick.offen === false, npcKlick);

  const lairGesperrt = await page.evaluate(() => {
    const b = document.querySelector('[data-attack-lair]'); return b ? b.disabled : null;
  });
  const lairKlick = await klickUndMiss(page, () => {
    const b = document.querySelector('[data-attack-lair]'); if (b) b.click();
  });
  check('11: Piraten-Versteck - Riegel weg, und der Klick nennt SEINEN Grund',
        lairGesperrt === false && lairKlick.neu.some(z => /Piraten-Versteck fehlen dir Kampfschiffe/.test(z)) && lairKlick.offen === false,
        { lairGesperrt, lairKlick });

  await page.evaluate(() => { const s = document.querySelector('[data-galaxy-subtab="abgrund"]'); if (s) s.click(); });
  await page.waitForTimeout(1500);
  const tauchGesperrt = await page.evaluate(() => {
    const b = document.querySelector('[data-abgrund-start]'); return b ? b.disabled : null;
  });
  const tauchKlick = await klickUndMiss(page, () => {
    const b = document.querySelector('[data-abgrund-start]'); if (b) b.click();
  });
  check('12: Abgrund - Riegel weg, und der Klick nennt SEINEN Grund statt leer zu oeffnen',
        tauchGesperrt === false && tauchKlick.neu.some(z => /Für einen Tauchgang fehlen dir Kampfschiffe/.test(z)) && tauchKlick.offen === false,
        { tauchGesperrt, tauchKlick });

  await page.context().close();

  // ============ Lage 2: DER HANGAR-FALL. Jaeger da, kein Traeger - combatFleetCount ist 0. ============
  // Der schwerste Befund der Durchsicht: Hier sagte die erste Fassung "bau in der Werft welche",
  // obwohl 60 Jaeger dastehen. Wer dem Rat folgt, baut weiter Jaeger und kommt nie heraus.
  const hangar = await seite(browser, stand({ fleet:{ jaeger:60, missions:[] }, galaxySubTab:'kampf' }));
  check('0-vorab: dritter Boot ohne Skriptfehler', hangar.fehler.length === 0, hangar.fehler.slice(0, 2));
  await zumReiter(hangar.page, 'galaxie');
  await hangar.page.waitForTimeout(1800);
  const hangarKlick = await klickUndMiss(hangar.page, () => {
    const b = document.querySelector('#npcList [data-attack]'); if (b) b.click();
  });
  const hangarZeile = await hangar.page.evaluate(() =>
    ((document.querySelector('#npcList .bmeta')||{}).textContent||'').trim());
  check('13: mit Jaegern ohne Traegerschiff nennt die Meldung den HANGAR, nicht die Werft',
        hangarKlick.neu.some(z => /Trägerschiff/.test(z) && /Hangarplätze/.test(z))
          && !hangarKlick.neu.some(z => /bau in der Werft/.test(z))
          && /Jäger ohne Trägerschiff/.test(hangarZeile),
        { neu: hangarKlick.neu, zeile: hangarZeile });
  await hangar.page.context().close();

  // ============ Lage 3: mit Flotte - der Riegel wurde nicht durch eine Dauersperre ersetzt ============
  const zwei = await seite(browser, stand({ fleet:{ jaeger:60, cruisers:30, missions:[] }, galaxySubTab:'kampf' }));
  check('0-vorab: vierter Boot ohne Skriptfehler', zwei.fehler.length === 0, zwei.fehler.slice(0, 2));
  await zumReiter(zwei.page, 'galaxie');
  await zwei.page.waitForTimeout(1800);
  await zwei.page.evaluate(() => { const b = document.querySelector('#npcList [data-attack]'); if (b) b.click(); });
  await zwei.page.waitForTimeout(900);
  check('16-gegenrichtung: mit Kampfschiffen oeffnet derselbe Knopf die Flottenwahl',
        (await wahlOffen(zwei.page)) === true);
  await zwei.page.context().close();
  await browser.close();

  // ====================== Quelltext: die beiden uebrigen Einstiegspunkte ======================
  /* Bewusst am Quelltext und nicht im Browser: Der Spielerangriff braucht ein markiertes Ziel
     aus der Rangliste und das Kartenmenue einen Klick auf der Sektorkarte - beides waere hier
     ein zweiter, fragiler Bedienweg. Geprueft wird trotzdem eine REGEL, keine Momentaufnahme:
     dass beide Stellen die gemeinsame Sperrgrund-Funktion lesen, statt eine eigene Fassung zu
     fuehren oder ein Versprechen abzugeben, das der Klick nicht einloest. */
  const pendingBlock = QUELLE.slice(QUELLE.indexOf('id="pendingAttackBtn"') - 1200,
                                    QUELLE.indexOf('id="pendingAttackBtn"') + 400);
  check('14: der Spielerangriff-Knopf traegt keinen Riegel und liest die gemeinsame Regel',
        QUELLE.indexOf('id="pendingAttackBtn"') > 0
          && /pvpAngriffSperrGrund\(\)/.test(pendingBlock)
          && !/id="pendingAttackBtn" \$\{[^}]*disabled/.test(pendingBlock)
          && !/Wähle oben mindestens ein Kampfschiff/.test(QUELLE),
        { hatRegel: /pvpAngriffSperrGrund\(\)/.test(pendingBlock),
          altText: /Wähle oben mindestens ein Kampfschiff/.test(QUELLE) });

  const karteBlock = QUELLE.slice(QUELLE.indexOf("fn: () => oeffneNpcAngriff(npcId)") - 700,
                                  QUELLE.indexOf("fn: () => oeffneNpcAngriff(npcId)") + 120);
  check('15: der Kartenmenue-Eintrag zeigt den Sperrgrund statt „Öffnet die Flottenwahl"',
        QUELLE.indexOf("fn: () => oeffneNpcAngriff(npcId)") > 0
          && /npcAngriffSperrGrund\(npcId\)/.test(karteBlock)
          && /disabled:\s*!!sperre/.test(karteBlock),
        { hatRegel: /npcAngriffSperrGrund\(npcId\)/.test(karteBlock) });

  ende();
})();
