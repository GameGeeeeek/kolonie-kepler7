// SP-3: Fortschritt und Galaxie sagen, WAS fehlt - und der Weg zur Auswahl ist keine Sackgasse mehr.
//
// DRITTE FOLGE von SP-1 (Forschung) und SP-2 (Werft). Der Befund ist zum vierten Mal derselbe:
// Der Klickpfad prueft laengst jeden Sperrgrund und hat fuer jeden eine fertige Meldung -
// buySkillNode, buySkillMastery und setShipSkin tun das seit jeher. Erreichbar war keine davon,
// weil der Knopf `disabled` trug und der Klick nie ankam.
//
// GEMESSEN am 04.09.2026 im Browser, alle Abschnitte aufgeklappt: 37 gesperrte Knoepfe im Reiter
// Fortschritt, 34 in Galaxie. Nicht alle sind ein Problem - wo der Grund ohnehin neben dem Knopf
// steht (Diplomatie: "erst ab Rang 3", Prestige: "Punktzahl X / Y noetig", Dominanz: "Noch 830"),
// bleibt der Riegel unangetastet. Behandelt sind die drei Faelle, in denen der Grund NICHT im
// Bild stand:
//
//   A) DER FAEHIGKEITSBAUM (26 Knoepfe). Die Zeile nannte bei fehlender Vorstufe nur das Wort
//      "Vorstufe" - welche, stand nirgends. Und der haeufigste Grund ueberhaupt, "nicht genug
//      Faehigkeitspunkte", stand an der Zeile GAR nicht; nur ganz oben die verfuegbare Punktzahl,
//      die der Spieler selbst gegen die Kosten am Knopf rechnen musste.
//
//   B) DER FLOTTEN-ANSTRICH (5 Knoepfe). Hier ist der Fall am schaerfsten: Der Grund stand
//      woertlich im Markup - aber im `title`, und ein title ist am Handy nicht abrufbar, weil es
//      dort kein Hover gibt. Die Auskunft existierte und war fuer die halbe Spielerschaft
//      strukturell unsichtbar.
//
//   C) DIE ANGRIFFSKNOEPFE (NPC, Piraten-Versteck, Abgrund). Hier war der Riegel nicht nur stumm,
//      sondern eine SACKGASSE: Er sperrte bei "keine Schiffe gewaehlt" genau den Knopf, der das
//      Menue oeffnet, in dem man waehlt. Wer alles auf 0 gestellt hatte, kam an die Auswahl nicht
//      mehr heran, die ihn wieder herausgeholt haette. Gemessen wurde ausserdem, dass der Riegel
//      in der Praxis NUR Spieler ohne Kampfschiffe traf (mit 60 Jaegern war kein einziger der 23
//      NPC-Knoepfe gesperrt) - und denen sagte die Zeile "keine Schiffe gewaehlt", was in dieser
//      Lage schlicht falsch ist: Es gibt keine zu waehlen.
//
// GEGENPROBE (gemessen am Stand vor der Aenderung): Es MUESSEN fallen - 1, 2, 4 (Baum), 6, 7
// (Anstrich), 8, 9, 10 (Angriff), 11 (Versteck), 12 (Abgrund). Gruen bleiben MUESSEN die Anker 0
// und 3 sowie die Gegenrichtung 13.
//
// LEHRE AUS DER DURCHSICHT VOM 04.09.2026, hier von Anfang an angewandt: Eine Pruefung der Form
// "kein Knopf traegt disabled" ist LEER, wenn es gar keine Knoepfe gibt - sie bliebe auch dann
// gruen, wenn der ganze Bereich verschwaende. Jede solche Pruefung fuehrt deshalb hier ihre
// eigene Bezugsgroesse mit und faellt, wenn nichts gemessen wurde.
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const fs = require('fs');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

/* Riegel gegen die gespaltene Gegenprobe (Lehre aus SP-2): SPIELDATEI folgt KEPLER_SPIELDATEI,
   DATEI folgt KEPLER_TESTDATEI. Wer nur eine der beiden umleitet, laedt die eine Fassung und
   liest die Merkmale aus der anderen - der Test misst dann zwei verschiedene Staende und meldet
   Unsinn, ohne dass irgendetwas rot wird. */
if (process.env.KEPLER_TESTDATEI && !process.env.KEPLER_SPIELDATEI){
  console.log('FAIL - KEPLER_TESTDATEI ohne KEPLER_SPIELDATEI: geladene und gelesene Fassung liefen auseinander');
  process.exit(1);
}

// Zwei Lagen, ein Unterschied: Der Anfaenger hat keine Kampfschiffe, der Veteran 60 Jaeger.
// Beide ohne Faehigkeitspunkte (xp niedrig) - so ist der Baum in beiden Laeufen gesperrt.
const ABGRUND_KEY = abgrundForschung();
const stand = (extra) => JSON.stringify(Object.assign({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:9e5,deuterium:9e5,antimaterie:900,forschungspunkte:900},
  buildings:{solar:20,mine:18,labor:10,lager:40,werft:14},
  // Abgrund freigeschaltet - sonst gibt es den Abtauchen-Knopf gar nicht und Pruefung 12 misst nichts.
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

/* Die Namen der Faehigkeitsknoten aus der Spieldatei lesen statt eintippen - so bleibt die
   Pruefung eine REGEL ("die Zeile nennt die Vorstufe beim Namen") und keine Momentaufnahme
   ("die Zeile sagt 'Effiziente Extraktion'"). Ein umbenannter Knoten zieht sie mit. */
/* Der Abgrund haengt an einer Forschung. Ihren Schluessel aus der Spieldatei lesen statt
   eintippen: Wird er dort umbenannt, faellt dieser Test mit einer Meldung, die den Grund nennt -
   statt still einen verschlossenen Abgrund zu messen und "kein Riegel" zu melden, weil es gar
   keinen Knopf gibt. Genau so ist der erste Anlauf hier hereingefallen. */
function abgrundForschung(){
  const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
  const m = quelle.match(/ABGRUND_REQ_RESEARCH\s*=\s*'([a-z0-9_]+)'/);
  return m ? m[1] : null;
}
function knotenNamen(){
  const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
  const i = quelle.indexOf('const SKILL_TREE = [');
  if (i < 0) return null;                                   // Anker vor Benutzung pruefen
  const j = quelle.indexOf('\n  ];', i);
  if (j < 0) return null;
  const namen = {};
  for (const m of quelle.slice(i, j).matchAll(/key:'([a-z0-9]+)'[^\n]*?name:'([^']+)'/g)) namen[m[1]] = m[2];
  return Object.keys(namen).length ? namen : null;
}

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

(async () => {
  const browser = await starteBrowser();
  const namen = knotenNamen();
  check('0-vorab: Knotennamen aus der Spieldatei gelesen', !!namen && Object.keys(namen).length >= 8,
        namen ? Object.keys(namen).length : 'SKILL_TREE nicht gefunden');
  check('0-vorab: Abgrund-Forschungsschluessel aus der Spieldatei gelesen', !!ABGRUND_KEY, ABGRUND_KEY);

  // ============================ Lage 1: Anfaenger, keine Kampfschiffe ============================
  const { page, fehler } = await seite(browser, stand({ fleet:{ missions:[] } }));
  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---------------------------------- A: der Faehigkeitsbaum ----------------------------------
  await zumReiter(page, 'fortschritt');
  await page.waitForTimeout(1200);
  await page.evaluate(() => { document.querySelectorAll('#tab-fortschritt [data-sec-toggle]').forEach(h => {
    const s = h.closest('.prog-section'); if (s && !s.classList.contains('open')) h.click(); }); });
  await page.waitForTimeout(1600);

  const baum = await page.evaluate(() => {
    const alle = Array.from(document.querySelectorAll('#skillTreeBox [data-skillnode], #skillTreeBox [data-skillmastery]'));
    return { gesamt: alle.length, gesperrt: alle.filter(b => b.disabled).length,
             punkte: (document.querySelector('#skillTreeBox .bmeta')||{}).textContent || '' };
  });
  // Bezugsgroesse MIT gepruefen - ohne sie waere "0 gesperrt" auch bei 0 Knoepfen wahr.
  check('1: Faehigkeitsbaum - kein Knopf mehr gesperrt (und es gibt welche)',
        baum.gesamt >= 20 && baum.gesperrt === 0, baum);

  await page.evaluate(() => { if (window.__logMitschnitt) window.__logMitschnitt.length = 0; });
  const ersterKnoten = await page.evaluate(() => {
    const b = document.querySelector('#skillTreeBox [data-skillnode]');
    if (!b) return null;
    const key = b.getAttribute('data-skillnode'); b.click(); return key;
  });
  await page.waitForTimeout(700);
  let log = await logZeilen(page);
  check('2: Klick ohne Punkte nennt die fehlenden Faehigkeitspunkte',
        !!ersterKnoten && log.some(z => /Nicht genug Fähigkeitspunkte/.test(z)), { ersterKnoten, zuletzt: log.slice(-3) });

  // Anker gegen die stille Wirkung: Der Klick darf den Knoten NICHT freigeschaltet haben.
  const nochDa = await page.evaluate(k => !!document.querySelector('#skillTreeBox [data-skillnode="'+k+'"]'), ersterKnoten);
  check('3-anker: der abgewiesene Klick hat nichts freigeschaltet', nochDa === true, { ersterKnoten, nochDa });

  // Ein Knoten MIT Vorstufe: seine Zeile muss die Vorstufe beim NAMEN nennen, nicht nur "Vorstufe".
  const vorstufe = await page.evaluate(() => {
    const zeilen = Array.from(document.querySelectorAll('#skillTreeBox .card-row'));
    for (const z of zeilen){
      const b = z.querySelector('[data-skillnode]');
      const t = (z.querySelector('.bmeta')||{}).textContent || '';
      if (b && /benötigt/.test(t)) return { key: b.getAttribute('data-skillnode'), text: t.trim() };
    }
    return null;
  });
  const erwarteterName = vorstufe && namen ? namen[({ eco2:'eco1', war2:'war1', log2:'log1' })[vorstufe.key] || ''] : null;
  check('4: die Zeile nennt die fehlende Vorstufe beim Namen, nicht nur „Vorstufe"',
        !!vorstufe && !/benötigt Vorstufe/.test(vorstufe.text)
          && Object.values(namen||{}).some(n => vorstufe.text.includes(n)),
        { vorstufe, erwarteterName });

  // ------------------------------------ B: der Flotten-Anstrich ------------------------------------
  const skins = await page.evaluate(() => {
    const alle = Array.from(document.querySelectorAll('[data-ship-skin]'));
    const zu = alle.filter(b => /Gesperrt/.test(b.getAttribute('title')||''));
    return { gesamt: alle.length, gesperrt: alle.filter(b => b.disabled).length,
             lautTitel: zu.length, ersterZu: zu.length ? zu[0].getAttribute('data-ship-skin') : null };
  });
  check('5-anker: es gibt ueberhaupt gesperrte Anstriche zu messen', skins.gesamt >= 5 && skins.lautTitel >= 1, skins);
  check('6: Flotten-Anstrich - kein Knopf mehr gesperrt', skins.gesperrt === 0, skins);

  await page.evaluate(() => { if (window.__logMitschnitt) window.__logMitschnitt.length = 0; });
  await page.evaluate(k => { const b = document.querySelector('[data-ship-skin="'+k+'"]'); if (b) b.click(); }, skins.ersterZu);
  await page.waitForTimeout(700);
  log = await logZeilen(page);
  check('7: Klick auf einen gesperrten Anstrich nennt die Bedingung',
        log.some(z => /Flotten-Lackierung ist noch nicht freigeschaltet/.test(z)), { ersterZu: skins.ersterZu, zuletzt: log.slice(-3) });

  // ------------------------------ C: die Angriffsknoepfe ohne Flotte ------------------------------
  await zumReiter(page, 'galaxie');
  await page.waitForTimeout(1800);

  const npc = await page.evaluate(() => {
    const alle = Array.from(document.querySelectorAll('#npcList [data-attack]'));
    return { gesamt: alle.length, gesperrt: alle.filter(b => b.disabled).length,
             erste: alle.length ? alle[0].getAttribute('data-attack') : null,
             zeile: ((document.querySelector('#npcList .bmeta')||{}).textContent||'').trim() };
  });
  check('8: NPC-Angriff - kein Knopf mehr gesperrt (und es gibt welche)',
        npc.gesamt >= 10 && npc.gesperrt === 0, { gesamt: npc.gesamt, gesperrt: npc.gesperrt });
  check('9: ohne Kampfschiffe sagt die Zeile das auch - statt „keine Schiffe gewählt"',
        /noch keine Kampfschiffe gebaut/.test(npc.zeile) && !/keine Schiffe gewählt/.test(npc.zeile), npc.zeile);

  await page.evaluate(() => { if (window.__logMitschnitt) window.__logMitschnitt.length = 0; });
  await page.evaluate(k => { const b = document.querySelector('#npcList [data-attack="'+k+'"]'); if (b) b.click(); }, npc.erste);
  await page.waitForTimeout(800);
  log = await logZeilen(page);
  const wahlOffen = await page.evaluate(() => !!document.querySelector('[data-fwahl-start]'));
  check('10: der Klick nennt den Grund, statt stumm ein leeres Menue zu oeffnen',
        log.some(z => /fehlen dir Kampfschiffe/.test(z)) && wahlOffen === false,
        { wahlOffen, zuletzt: log.slice(-3) });

  await page.evaluate(() => { if (window.__logMitschnitt) window.__logMitschnitt.length = 0; });
  const lair = await page.evaluate(() => {
    const b = document.querySelector('[data-attack-lair]');
    if (!b) return null;
    const gesperrt = b.disabled; b.click(); return { gesperrt };
  });
  await page.waitForTimeout(700);
  log = await logZeilen(page);
  check('11: Piraten-Versteck - Riegel weg, Klick nennt den Grund',
        !!lair && lair.gesperrt === false && log.some(z => /fehlen dir Kampfschiffe/.test(z)),
        { lair, zuletzt: log.slice(-3) });

  const abgrund = await page.evaluate(() => {
    const s = document.querySelector('[data-galaxy-subtab="abgrund"]'); if (s) s.click();
    return true;
  });
  await page.waitForTimeout(1500);
  const tauch = await page.evaluate(() => {
    const b = document.querySelector('[data-abgrund-start]');
    return b ? { da: true, gesperrt: b.disabled } : { da: false };
  });
  check('12: Abgrund - der Abtauchen-Knopf traegt keinen Riegel mehr', tauch.da === true && tauch.gesperrt === false, { abgrund, tauch });

  await page.context().close();

  // ================== Lage 2: mit Flotte - der Riegel wurde nicht durch eine Dauersperre ersetzt ==================
  const zwei = await seite(browser, stand({ fleet:{ jaeger:60, cruisers:30, missions:[] }, galaxySubTab:'kampf' }));
  check('0-vorab: zweiter Boot ohne Skriptfehler', zwei.fehler.length === 0, zwei.fehler.slice(0, 2));
  await zumReiter(zwei.page, 'galaxie');
  await zwei.page.waitForTimeout(1800);
  await zwei.page.evaluate(() => { const b = document.querySelector('#npcList [data-attack]'); if (b) b.click(); });
  await zwei.page.waitForTimeout(900);
  const offen = await zwei.page.evaluate(() => !!document.querySelector('[data-fwahl-start]'));
  check('13-gegenrichtung: mit Kampfschiffen oeffnet derselbe Knopf die Flottenwahl', offen === true, { offen });

  await browser.close();
  ende();
})();
