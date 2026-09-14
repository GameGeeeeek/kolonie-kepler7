// Die verdichtete Kopfzone: Rohstoffleiste und Kolonienzeile einzeilig (14.09.2026).
//
//   node tests/test_verdichtung.js
//
// WAS AM GRUNDSTAND (v8.729.0) GEMESSEN WURDE
// -------------------------------------------
// Spielstand mit 14 Kolonien, Fenster 1310x1000. Die Leiste steht in einer 738 px breiten Spalte.
//   A  Rohstoffleiste 154 px: sechs Karten in ZWEI Reihen zu je 73 px, obwohl die Zahl darin nur
//      eine Zeile hoch ist. Kolonienzeile 253 px in vier Reihen zu je 67 px.
//   B  Bei 1600 px war der WERT an fuenf von sechs Karten abgeschnitten (121 px Inhalt in einem
//      98 px breiten Feld) - ein bestehender Fehler, den niemand gemessen hatte.
//   C  Die naheliegende Abhilfe "nur die 1400-px-Schwelle senken" ist untauglich: sechs
//      dreizeilige Karten in 738 px sind je 116 px breit, dort wird ALLES abgeschnitten.
//
// FUENF FALLEN, GEGEN DIE DIESER WAECHTER AUSDRUECKLICH GEBAUT IST
// ----------------------------------------------------------------
//  1. EINE HOEHEN-PRUEFUNG GEGEN EINE EINGETIPPTE ZAHL VERALTET STILL. Gemessen wird deshalb die
//     REGEL, aus der die Hoehe folgt: sechs Karten in EINER Reihe, jede Karte so hoch wie eine
//     Textzeile - und kein sichtbarer Text abgeschnitten. Wer das Raster spaeter anders baut und
//     dabei dieselbe Zusage einhaelt, soll nicht rot werden.
//  1b. EIN FELD, DAS NICHT GEKUERZT WIRD, KANN TROTZDEM WEGGESCHNITTEN SEIN. Gemessen am
//     14.09.2026: Ohne max-width:none an der Koloniekarte behaelt der Name seine volle Breite
//     (scrollWidth == clientWidth, am FELD also nichts zu sehen) und die Karte schneidet ihn per
//     overflow:hidden ab - der Stand sabDeckel war deshalb gruen, obwohl der laengste Name halb
//     fehlte. 2a3/2a4 stellen dieselbe Frage noch einmal an der KARTE.
//  2. "NICHTS ABGESCHNITTEN" IST DIE HAELFTE DER ZUSAGE. Die andere Haelfte: Was von der Karte
//     verschwindet, muss im Titel WIEDERAUFTAUCHEN - und zwar mit denselben Zahlen. Deshalb
//     vergleicht 2b den Titel gegen das (ausgeblendete, aber weiter gepflegte) .rate-Element und
//     3b den Kolonie-Titel gegen die ausgeblendete Werte-Zeile. Ein Titel mit eigener
//     Formulierung faellt hier, auch wenn er ploausibel klingt.
//  3. EIN TITEL, DER NUR BEIM AUFBAU GESETZT WIRD, FRIERT AUF DEM ERSTEN STAND EIN. Die
//     Ressourcenleiste baut ihre Struktur genau EINMAL und schreibt danach nur noch Werte in die
//     bestehenden Knoten (siehe Kommentar bei resBarOk). Ein Titel im Aufbau-Zweig allein waere
//     also nach dem ersten Takt fuer immer falsch, und ein Test, der nur direkt nach dem Laden
//     misst, saehe das nie. 2c laesst deshalb den Wert wandern und misst den Titel DANACH.
//  4. EINE PRUEFUNG NUR AM PC KANN DIE HANDY-ZUSAGE NICHT HALTEN. Die Verdichtung gilt
//     ausdruecklich NUR ohne body.compact-head - ohne Zeigegeraet gaebe es keinen Titel zu lesen.
//     4a/4b messen deshalb am Handy, dass Rate und Werte-Zeile dort WEITER auf der Karte stehen.
//  5. EINE PRUEFUNG BEI NUR EINER BREITE UEBERSIEHT DIE BREITE, WO ES KLEMMT. Gemessen wird bei
//     1310 (Spalte 738 px, engster Fall) UND bei 1600 (Spalte 1088 px, wo der alte Stand
//     abschnitt).
//
// GEGENPROBEN: Kopie der Spieldatei bauen, Stelle sabotieren, Test per
//   KEPLER_SPIELDATEI=<kopie> node tests/test_verdichtung.js
// laufen lassen. Die folgende Liste ist GEMESSEN (14.09.2026), nicht geschaetzt - Exit 1 allein
// genuegt nicht, es muessen GENAU diese Pruefungen fallen und keine andere. Alle zehn Staende
// tragen dieselben 67 Pruefnamen wie der gruene Lauf (per diff verglichen, nicht gezaehlt).
//
//   Stand           sabotiert                                      es fallen
//   alt             der Stand v8.729.0 vor dieser Aenderung        1a 1b 1c 2a 2a2 2a4 2b 2b2 2b3
//                                                                  2c 2e 3a 3b 3c 3d 3e 3f 5d 6b 6c
//   sabTitelFest    Titel nur im Aufbau-, nicht im Takt-Zweig      2c
//   sabTitelEigen   Titel neu formuliert statt aus rateHtml        2b 2e
//   sabBreite       der Breiten-Riegel (min-width:1001px) weg      5b 5c 5d
//   sabWerte        Kampfwerte fehlen im Kolonie-Titel             3a 3b
//   sabVersteckt    display:none statt der .sr-only-Klemmung       2d 3c 3d
//   sabStarr        .value wieder flex:0 0 auto                    6b
//   sabEinflug      die Einflugzahl bleibt rechts oben             1e
//   sabCanvas       das Planeten-Bild wird nicht mitskaliert       1f
//   sabGross        Symbol und Polster bleiben gross               2a 2a3
//
// BEMERKENSWERT an sabStarr: Er faellt NUR ueber 6b, den Extremfall. Bei den Betraegen des
// Pruefstands (1e9) passt der Wert seit der kleineren Dekoration auch ohne Schrumpfen - der
// Fehler waere also erst im Endspiel sichtbar geworden. Genau deshalb gibt es Abschnitt 6.
//
// KEIN Stand fuer den Deckel der Koloniekarte: Es gibt keinen mehr. Ein max-width von 260 px griff
// gemessen an keiner einzigen Karte (breiteste 246 px, weil der Rollenname aus dem Bild ist und
// Namen bei 25 bzw. 24 Zeichen enden) - totes CSS, das eine Absicht vortaeuscht. Die Zusage
// haelt stattdessen 3e/3f.
const { starteBrowser, SPIEL_URL, versionAbfangen, pruefer } = require('./lib/umgebung');
const P = pruefer();

// SCHLIMMSTFALL, nicht Bestfall (Nachtrag 14.09.2026). Die erste Fassung dieses Pruefstands mass
// kurze Namen ohne Rollen und Betraege unter einer Milliarde - also genau den Fall, in dem die
// Verdichtung leicht gewinnt. Hier stehen deshalb: die LAENGSTEN Planetennamen aus PLANETS
// (25 Zeichen, gemessen), JEDE Kolonie mit einer Rolle (die den Text in .dash-colony-level
// verlaengert) und Bestaende ueber 1e9 - fmt() kennt kein B/T, dort steht dann "3212.90M", also
// acht Zeichen statt sieben.
const KOL = {}; const DISC = {}; const SPEZ = { home:'science' };
const NAMEN = ['vortex4','pulsar4','echo9','drachenmark1','drachenmark5','sigma4','vesna','rhea','draconis','thessa','nyxar','oberon','helion','nocta'];
const ROLLEN = ['science','fortress','shipyard','trade','logistics','mining'];
NAMEN.forEach((n,i) => { DISC[n]=true; SPEZ[n]=ROLLEN[i%ROLLEN.length];
  KOL[n]={ buildings:{solar:9,mine:8,habitat:4,turm:6,werft:3}, fleet:{ships:12,cruisers:4,missions:[]} }; });
const SPIELSTAND = JSON.stringify({
  tutorialSeen:true, seenTabs:{basis:1,verteidigung:1,forschung:1,flotte:1,expedition:1,karte:1,galaxie:1,allianz:1,offiziere:1,markt:1,punkte:1,fortschritt:1,sammlung:1},
  resources:{energie:3.2129e9,erz:3.2098e9,kristalle:50,deuterium:2.2683e9,antimaterie:9.284e8,forschungspunkte:5.242e8},
  // Die Gebaeudeschluessel sind aus BUILDING_DEFS ABGELESEN, nicht erfunden: die Kristalle kommen
  // aus der 'raffinerie', nicht aus einer 'kristallmine'. Mit erfundenen Schluesseln produziert der
  // Pruefstand gar nichts - und 2c waere dann aus dem falschen Grund gruen (nichts bewegt sich).
  buildings:{solar:40,mine:38,raffinerie:20,synth:18,fusionsreaktor:14,habitat:10,lager:30,werft:24,turm:20,schild:18,laser:20,plasma:16,raketen:15,gauss:14,festung:9},
  research:{rkampf:12,rsolar:12,rerz:11,rschild:9},
  fleet:{ships:400,cruisers:300,jaeger:9000,bomber:2600,schlachtschiff:1200,frachter:800,missions:[]},
  discovered:DISC, colonies:KOL, planetSpecialization:SPEZ, activeBasePlanet:'home', player:{id:'u',name:'AdmiralX',avatarKey:null},
  battleStats:{wins:90,losses:20}, battlePoints:1234567, xp:9e6, credits:5e6, buffs:[],
  lastTick:Date.now(), colonyNames:{}, colonyNotes:{}, modules:{}, shipModules:{}, equippedShipModules:{}, moduleFragments:0
});
function backend(store){ return async r => { const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'AdmiralX',isAdmin:false,homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){} return j({ok:true});}
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1}); return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p))
    return j(p.includes('pending')?{reward:null}:[]);
  return j({}); }; }
const OVERLAYS=['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'];

// Abgeschnitten heisst: der Inhalt ist breiter als das Feld, in dem er steht. Nur SICHTBARE
// Elemente zaehlen - ein per display:none ausgeblendetes Feld hat clientWidth 0 und waere sonst
// per Konstruktion immer "abgeschnitten".
const MESSEN = () => {
  // GEMALT, nicht bloss "nicht display:none" (Nachtrag 14.09.2026): Was aus dem Bild verschwindet,
  // wird nicht ausgeblendet, sondern nach .sr-only-Art auf 1x1 px geklemmt - damit es im
  // VORLESE-Baum bleibt. Ein Test, der nur display abfragt, haelte diese Felder faelschlich fuer
  // sichtbar und wuerde sie dann als "abgeschnitten" melden.
  const sichtbar = el => !!el && el.offsetWidth > 2 && el.offsetHeight > 2;
  // Im Baum, aber nicht im Bild - das ist die Zusage an Vorleseprogramme.
  const imBaum = el => !!el && getComputedStyle(el).display !== 'none' && (el.textContent||'').trim().length > 0;
  const abgeschnitten = el => el.scrollWidth > el.clientWidth + 1;
  const R = el => el.getBoundingClientRect();
  const bar = document.getElementById('resbar');
  const karten = bar ? [...bar.children] : [];
  const reihe = document.querySelector('.dash-colony-row');
  const kk = reihe ? [...reihe.querySelectorAll('.dash-colony-card')] : [];
  const zeilenVon = els => new Set(els.map(c=>Math.round(c.getBoundingClientRect().top))).size;
  const schnitt = [];
  karten.forEach(k => ['.label','.value','.rate'].forEach(sel => {
    const el = k.querySelector(sel);
    if (sichtbar(el) && abgeschnitten(el)) schnitt.push(k.getAttribute('data-res')+sel);
  }));
  const kolSchnitt = [];
  kk.forEach((k,i) => ['.dash-colony-name-text','.dash-colony-level','.dash-colony-stats'].forEach(sel => {
    const el = k.querySelector(sel);
    if (sichtbar(el) && abgeschnitten(el)) kolSchnitt.push(i+sel);
  }));
  // Zweite, unabhaengige Art von Ueberlauf - und die, an der die erste Fassung dieses Tests
  // BLIND war (gemessen 14.09.2026): Wird ein Feld selbst gekuerzt, meldet scrollWidth am Feld
  // den Ueberlauf. Behaelt das Feld dagegen seine volle Breite und die KARTE schneidet es per
  // overflow:hidden weg, ist am Feld nichts zu sehen - der Spieler sieht den halben Namen, der
  // Test sah nichts. Deshalb hier dieselbe Frage noch einmal an der Karte.
  const kartenUeberlauf = els => els.filter(k => k.scrollWidth > k.clientWidth + 1)
    .map(k => (k.getAttribute('data-res') || (k.querySelector('.dash-colony-name-text')||{textContent:'?'}).textContent.trim())
      + '(' + k.scrollWidth + '>' + k.clientWidth + ')');
  // B1-Klasse: Ein Feld kann auch zur ANFANGSSEITE aus seiner Karte ragen. scrollWidth sieht das
  // nie (Ueberlauf nach links zaehlt nicht hinein), und mit justify-content:flex-end ist genau das
  // die Richtung, in die ein zu breiter Wert wandert - unter das farbige Symbol, wo er sich als
  // plausible, aber falsche kleinere Zahl liest. Gemessen werden deshalb RAENDER, nicht Breiten.
  const randUeberlauf = (kartenListe, sel) => { const raus = [];
    kartenListe.forEach((k,i) => { const el = k.querySelector(sel); if (!sichtbar(el)) return;
      const kr = R(k), er = R(el), cs = getComputedStyle(k);
      const li = kr.left + parseFloat(cs.paddingLeft), re = kr.right - parseFloat(cs.paddingRight);
      if (er.left < li - 0.5) raus.push((k.getAttribute('data-res')||i)+' links '+Math.round(li-er.left));
      if (er.right > re + 0.5) raus.push((k.getAttribute('data-res')||i)+' rechts '+Math.round(er.right-re));
    }); return raus; };
  // Die Einflugzahl darf nicht auf dem Wert liegen - flashGains laeuft jede Sekunde.
  const einflugAufWert = karten.filter(k => { const v=k.querySelector('.value'), f=k.querySelector('.float-gain');
    if (!v || !f) return false; const a=R(v), b=R(f);
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  }).map(k => k.getAttribute('data-res'));
  // Das Planeten-Bild ist ein Canvas mit festen Attributen; der Kreis darum schneidet ab.
  const symbolBeschnitten = kk.filter(k => { const ic=k.querySelector('.dash-colony-icon'), c=ic&&ic.querySelector('canvas');
    if (!ic || !c) return false; const ir=R(ic), cr=R(c);
    return cr.width > ir.width + 0.5 || cr.height > ir.height + 0.5; }).length;
  const erste = karten[0] || null;
  const ersteKol = kk[0] || null;
  return {
    kompaktKopf: document.body.classList.contains('compact-head'),
    resbar: bar ? {
      anzahl: karten.length, zeilen: zeilenVon(karten),
      spalten: getComputedStyle(bar).gridTemplateColumns.split(' ').length,
      hoehe: Math.round(bar.getBoundingClientRect().height),
      kartenH: erste ? Math.round(erste.getBoundingClientRect().height) : null,
      schnitt, ueberlauf: kartenUeberlauf(karten),
      randRaus: randUeberlauf(karten, '.value'),
      rasterRaus: Math.max(0, bar.scrollWidth - bar.clientWidth),
      einflugAufWert,
      // Alle SECHS Karten, nicht nur die erste - die interessanten Zweige des Ratentexts
      // (Baustellen-Abzweig, "Lager voll", "fast voll") treffen selten dieselbe Karte.
      alle: karten.map(k => ({ res:k.getAttribute('data-res'), titel:k.getAttribute('title')||'',
        wert:(k.querySelector('.value')||{textContent:''}).textContent.trim(),
        rate:(k.querySelector('.rate')||{textContent:''}).textContent.trim(),
        name:(k.querySelector('.label')||{textContent:''}).textContent.trim(),
        rateImBaum: imBaum(k.querySelector('.rate')), nameImBaum: imBaum(k.querySelector('.label')) })),
      titel: erste ? (erste.getAttribute('title')||'') : '',
      rateText: erste ? (erste.querySelector('.rate')||{textContent:''}).textContent.trim() : '',
      wertText: erste ? (erste.querySelector('.value')||{textContent:''}).textContent.trim() : '',
      rateSichtbar: sichtbar(erste && erste.querySelector('.rate')),
      labelSichtbar: sichtbar(erste && erste.querySelector('.label')),
      labelText: erste ? (erste.querySelector('.label')||{textContent:''}).textContent.trim() : ''
    } : null,
    kolonien: reihe ? {
      anzahl: kk.length, zeilen: zeilenVon(kk),
      hoehe: Math.round(reihe.getBoundingClientRect().height),
      kartenH: ersteKol ? Math.round(ersteKol.getBoundingClientRect().height) : null,
      schnitt: kolSchnitt, ueberlauf: kartenUeberlauf(kk),
      randRaus: randUeberlauf(kk, '.dash-colony-level'),
      symbolBeschnitten,
      werteImBaum: ersteKol ? imBaum(ersteKol.querySelector('.dash-colony-stats')) : false,
      rolleImBaum: ersteKol ? imBaum(ersteKol.querySelector('.dash-colony-role-text')) : false,
      rolleGemalt: ersteKol ? sichtbar(ersteKol.querySelector('.dash-colony-role-text')) : false,
      abzeichenGemalt: ersteKol ? sichtbar(ersteKol.querySelector('.dash-role-badge')) : false,
      titel: ersteKol ? (ersteKol.getAttribute('title')||'') : '',
      werteText: ersteKol ? (ersteKol.querySelector('.dash-colony-stats')||{textContent:''}).textContent.replace(/\s+/g,' ').trim() : '',
      werteSichtbar: sichtbar(ersteKol && ersteKol.querySelector('.dash-colony-stats'))
    } : null
  };
};

// Der Vergleichsstand wird IM SELBEN LAUF erzeugt, nicht aus einer eingetippten Zahl: dieselbe
// Seite, dieselben Daten, nur die Verdichtung per angehaengter Regel zurueckgenommen. Eine
// eingetippte Hoehengrenze veraltet still, sobald sich der Pruefstand oder eine Schriftgroesse
// aendert - dieser Vergleich kann das nicht.
const HOEHEN = () => {
  const reihe = document.querySelector('.dash-colony-row');
  const bar = document.getElementById('resbar');
  const h = () => ({ kolonien: reihe ? Math.round(reihe.getBoundingClientRect().height) : null,
                     resbar: bar ? Math.round(bar.getBoundingClientRect().height) : null });
  const neu = h();
  const st = document.createElement('style');
  st.textContent = `
    #resbar { grid-template-columns:repeat(3,1fr) !important; }
    #resbar .rescard { padding:0.8rem 0.9rem !important; gap:10px !important; }
    #resbar .rescard .icon-badge { width:36px !important; height:36px !important; }
    #resbar .rescard .icon-badge svg { width:20px !important; height:20px !important; }
    #resbar .rescard-info { display:block !important; }
    .dash-colony-card { max-width:172px !important; padding:6px 10px 6px 6px !important; gap:8px !important; }
    .dash-colony-icon { width:28px !important; height:28px !important; }
    .dash-colony-icon canvas { width:auto !important; height:auto !important; }
    .dash-colony-info { display:block !important; }
    .dash-colony-name { font-size:11px !important; }
    .dash-colony-level { font-size:12.5px !important; }
    #resbar .rescard .label, #resbar .rescard .rate, #resbar .rescard .value span,
    .dash-colony-stats, .dash-colony-role-text {
      position:static !important; width:auto !important; height:auto !important;
      clip:auto !important; margin:0 !important; overflow:visible !important;
      white-space:normal !important; display:revert !important;
    }`;
  document.head.appendChild(st);
  const alt = h();
  st.remove();
  return { neu, alt };
};

// Alle Zahlen aus einem Text, in Reihenfolge. Der Vergleich laeuft ueber die ZAHLEN und nicht
// ueber den ganzen Satz: Der Titel darf mehr erzaehlen als die Karte, nur nichts anderes.
const zahlen = t => (String(t).match(/[0-9][0-9.,]*[kKMBT]?/g) || []);
// Kurzschreibweise des Hauses in eine Zahl zurueck ("1.1k" -> 1100). Nur fuer den
// Naeherungsvergleich in 2c; ueberall sonst wird zeichengleich verglichen.
const EINHEIT = { k:1e3, K:1e3, M:1e6, B:1e9, T:1e12 };
const alsZahl = t => { if (t === undefined || t === null) return null;
  const m = /^([0-9][0-9.,]*)([kKMBT]?)$/.exec(String(t)); if (!m) return null;
  const z = parseFloat(m[1].replace(/,/g, '')); if (!isFinite(z)) return null;
  return z * (EINHEIT[m[2]] || 1); };

(async () => {
  const browser = await starteBrowser();
  const laden = async (breite, hoehe, zusatz) => {
    const spielstand = zusatz ? JSON.stringify(Object.assign(JSON.parse(SPIELSTAND), zusatz)) : SPIELSTAND;
    const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe||1000 } });
    const page = await ctx.newPage();
    await versionAbfangen(page);
    await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }));
    await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(3000);
    await page.evaluate(ids => ids.forEach(i => { const o=document.getElementById(i); if(o) o.style.display='none'; }), OVERLAYS);
    await page.waitForTimeout(800);
    return { ctx, page };
  };

  // ---- 1/2/3: der PC-Fall, bei beiden gemessenen Breiten
  for (const breite of [1310, 1600]) {
    const { ctx, page } = await laden(breite);
    const m = await page.evaluate(MESSEN);
    const b = '@' + breite;

    P.check('0a'+b+' der Kompaktkopf ist hier AUS (sonst misst der Test die Handy-Fassung)', m.kompaktKopf === false, m.kompaktKopf);
    P.check('0b'+b+' die Leiste traegt alle sechs Rohstoffe', !!m.resbar && m.resbar.anzahl === 6, m.resbar && m.resbar.anzahl);
    // Die Zahl wird aus dem Pruefstand ABGELEITET, nicht eingetippt: die Zeile zeigt die Kolonien
    // UND die Heimatbasis. Eine getippte 14 waere beim naechsten Eintrag im Pruefstand still falsch.
    P.check('0c'+b+' die Kolonienzeile traegt alle Kolonien samt Heimatbasis', !!m.kolonien && m.kolonien.anzahl === NAMEN.length + 1,
      { gezeigt: m.kolonien && m.kolonien.anzahl, erwartet: NAMEN.length + 1 });

    // 1: die Regel, aus der die Hoehe folgt
    P.check('1a'+b+' die sechs Rohstoffkarten stehen in EINER Reihe', m.resbar.zeilen === 1, m.resbar.zeilen);
    P.check('1b'+b+' eine Rohstoffkarte ist hoechstens so hoch wie zwei Textzeilen (<=50 px)', m.resbar.kartenH <= 50, m.resbar.kartenH);
    P.check('1c'+b+' eine Koloniekarte ist hoechstens so hoch wie eine Textzeile samt Polster (<=40 px)', m.kolonien.kartenH <= 40, m.kolonien.kartenH);

    // 2: nichts Sichtbares abgeschnitten, und was fehlt, steht im Titel
    P.check('2a'+b+' in der Rohstoffleiste ist kein sichtbarer Text abgeschnitten', m.resbar.schnitt.length === 0, m.resbar.schnitt);
    P.check('2a2'+b+' in der Kolonienzeile ist kein sichtbarer Text abgeschnitten', m.kolonien.schnitt.length === 0, m.kolonien.schnitt);
    P.check('2a3'+b+' keine Rohstoffkarte schneidet ihren eigenen Inhalt weg', m.resbar.ueberlauf.length === 0, m.resbar.ueberlauf);
    P.check('2a4'+b+' keine Koloniekarte schneidet ihren eigenen Inhalt weg', m.kolonien.ueberlauf.length === 0, m.kolonien.ueberlauf);
    P.check('2a5'+b+' kein Rohstoffwert ragt aus seiner Karte - auch nicht nach LINKS', m.resbar.randRaus.length === 0, m.resbar.randRaus);
    P.check('2a6'+b+' keine Kolonie-Stufe ragt aus ihrer Karte', m.kolonien.randRaus.length === 0, m.kolonien.randRaus);
    P.check('1d'+b+' die sechs Karten sprengen ihre Spalte nicht', m.resbar.rasterRaus === 0, m.resbar.rasterRaus);
    P.check('1e'+b+' die Einflugzahl liegt auf keiner Karte ueber dem Wert', m.resbar.einflugAufWert.length === 0, m.resbar.einflugAufWert);
    P.check('1f'+b+' kein Planeten-Symbol wird von seinem Kreis beschnitten', m.kolonien.symbolBeschnitten === 0, m.kolonien.symbolBeschnitten);
    const tz = zahlen(m.resbar.titel), rz = zahlen(m.resbar.rateText), wz = zahlen(m.resbar.wertText);
    P.check('2b'+b+' der Rohstoff-Titel traegt DIESELBE Rate wie das (verborgene) Ratenfeld',
      rz.length > 0 && rz.every(z => tz.includes(z)), { titel:m.resbar.titel, rate:m.resbar.rateText });
    P.check('2b2'+b+' der Rohstoff-Titel traegt DENSELBEN Wert wie die Karte',
      wz.length > 0 && wz.every(z => tz.includes(z)), { titel:m.resbar.titel, wert:m.resbar.wertText });
    P.check('2b3'+b+' der Rohstoff-Titel nennt den Namen, der nicht mehr auf der Karte steht',
      m.resbar.labelText.length > 0 && m.resbar.titel.includes(m.resbar.labelText), { titel:m.resbar.titel, name:m.resbar.labelText });

    // 2c: der Titel darf nicht auf dem Aufbaustand einfrieren. Gemessen wird an KRISTALLE - der
    // einzige Rohstoff, den dieser Spielstand absichtlich weit unter dem Lagerdeckel haelt, damit
    // die Produktion den Wert im Messfenster ueberhaupt bewegt. Bei einem vollen Lager stuende der
    // Wert still, und die Pruefung waere aus dem falschen Grund gruen.
    const kartenStand = () => page.evaluate(() => { const k=document.querySelector('#resbar .rescard[data-res="kristalle"]');
      return { titel:k.getAttribute('title')||'', wert:(k.querySelector('.value')||{textContent:''}).textContent.trim() }; });
    const vorher = await kartenStand();
    await page.waitForTimeout(3000);
    const nachher = await kartenStand();
    P.check('2c0'+b+' der Messgegenstand bewegt sich ueberhaupt (sonst prueft 2c nichts)',
      nachher.wert !== vorher.wert, { vorher:vorher.wert, nachher:nachher.wert });
    // Titel und sichtbarer Wert sind hier ABSICHTLICH nicht zeichengleich: Die grosse Zahl zaehlt
    // weich hoch (animateResValue), der Titel nennt den echten Stand. Ein Gleichheitsvergleich
    // waere deshalb ein Test auf den Zufall des Messzeitpunkts. Geprueft wird stattdessen, dass
    // der Titel sich bewegt UND dabei NAH an der Karte bleibt (5 %).
    const nah = (a, b2) => { const x=alsZahl(a), y=alsZahl(b2);
      return x!==null && y!==null && Math.abs(x-y) <= Math.max(1, Math.abs(y)*0.05); };
    P.check('2c'+b+' der Titel zieht beim Takt mit (er friert nicht auf dem Aufbaustand ein)',
      nachher.titel !== vorher.titel && nah(zahlen(nachher.titel)[0], zahlen(nachher.wert)[0]),
      { vorher, nachher });

    // 3e: DIE EIGENTLICHE ZUSAGE. Nicht "die Karte ist flach", sondern "die ZEILE ist niedriger
    // als vorher" - das ist der Satz, mit dem diese Aenderung angetreten ist, und der einzige, der
    // auch dann noch faellt, wenn eine kuenftige Aenderung die Karten breiter macht und die Zeile
    // dadurch mehr Reihen bekommt.
    const hh = await page.evaluate(HOEHEN);
    P.check('3e'+b+' die verdichtete Kolonienzeile ist niedriger als dieselbe Zeile in der alten Fassung',
      hh.neu.kolonien < hh.alt.kolonien, hh);
    P.check('3f'+b+' die verdichtete Rohstoffleiste ist niedriger als dieselbe Leiste in der alten Fassung',
      hh.neu.resbar < hh.alt.resbar, hh);

    // 3: die Kolonienkarte
    // 2d/3d: Was aus dem BILD verschwindet, bleibt im VORLESE-Baum. Mit display:none waere es auch
    // dort weg, und eine .rescard ist ein div ohne tabindex und ohne role - der Titel allein ist
    // fuer Vorleseprogramme die schwaechste aller Quellen und mit der Tastatur gar nicht erreichbar.
    P.check('2d'+b+' Name und Rate sind aus dem Bild, aber NICHT aus dem Vorlese-Baum',
      m.resbar.alle.every(k => k.rateImBaum && k.nameImBaum),
      m.resbar.alle.map(k => k.res+':'+k.nameImBaum+'/'+k.rateImBaum));
    // 2e: alle SECHS Karten, nicht nur die erste - jede muss ihren eigenen Ratentext im Titel tragen.
    P.check('2e'+b+' jede der sechs Karten traegt ihren eigenen Namen und ihre eigene Rate im Titel',
      m.resbar.alle.every(k => k.name.length > 0 && k.titel.includes(k.name) &&
        zahlen(k.rate).every(z => zahlen(k.titel).includes(z))),
      m.resbar.alle.map(k => ({ res:k.res, titel:k.titel, rate:k.rate })));
    const kt = zahlen(m.kolonien.titel), kw = zahlen(m.kolonien.werteText);
    P.check('3a'+b+' der Kolonie-Titel nennt Angriffskraft, Verteidigung und Schiffe',
      /Angriffskraft/.test(m.kolonien.titel) && /Verteidigungspunkte/.test(m.kolonien.titel) && /Schiffe/.test(m.kolonien.titel), m.kolonien.titel);
    P.check('3b'+b+' der Kolonie-Titel traegt DIESELBEN drei Werte wie die (verborgene) Werte-Zeile',
      kw.length >= 3 && kw.every(z => kt.includes(z)), { titel:m.kolonien.titel, werte:m.kolonien.werteText });
    P.check('3c'+b+' die Kampfwerte sind aus dem Bild, aber NICHT aus dem Vorlese-Baum',
      m.kolonien.werteImBaum === true && m.kolonien.werteSichtbar === false,
      { imBaum:m.kolonien.werteImBaum, gemalt:m.kolonien.werteSichtbar });
    // Die Rolle verschwindet aus der Stufenzeile (sie macht die Karte sonst so breit, dass die
    // Zeile HOEHER wird als vorher) - aber sie steht weiter sichtbar am Abzeichen des Symbols und
    // im Vorlese-Baum. Ersatzlos waere sie nur, wenn beides fehlte.
    P.check('3d'+b+' der Rollenname ist aus der Stufenzeile, steht aber im Baum UND als Abzeichen',
      m.kolonien.rolleImBaum === true && m.kolonien.rolleGemalt === false && m.kolonien.abzeichenGemalt === true,
      { imBaum:m.kolonien.rolleImBaum, gemalt:m.kolonien.rolleGemalt, abzeichen:m.kolonien.abzeichenGemalt });

    await ctx.close();
  }

  // ---- 4: am Handy bleibt alles, wie es war
  {
    const { ctx, page } = await laden(390, 844);
    const m = await page.evaluate(MESSEN);
    P.check('4a@390 der Kompaktkopf ist am Handy AN', m.kompaktKopf === true, m.kompaktKopf);
    P.check('4b@390 die Kolonien-Werte stehen am Handy WEITER auf der Karte', m.kolonien.werteSichtbar === true, m.kolonien.werteText);
    P.check('4c@390 die Rate steht am Handy WEITER auf der Rohstoffkarte', m.resbar.rateSichtbar === true, m.resbar.rateText);
    await ctx.close();
  }

  // ---- 6: Der Extremfall - und seit der Chip-Fassung eine STAERKERE Zusage.
  // Ab 1e12 steht dort "3212900.00M" (fmt kennt kein B/T). Solange die Leiste ein Raster aus sechs
  // gleich breiten Spalten war, passte das in keine Karte, und die Zusage lautete nur: sichtbar
  // gekuerzt statt nach links unter das Symbol gewandert. Seit die Chips mit ihrer Zahl WACHSEN,
  // gilt mehr - gemessen am 14.09.2026 bei 1310 px: Der Chip wird 129 statt 106 px breit, die
  // Leiste bleibt 30 px hoch und einreihig, und NICHTS wird gekuerzt. Die Pruefung haelt deshalb
  // jetzt das Staerkere fest; faellt sie zurueck auf feste Spalten, faellt 6b.
  {
    const riesig = JSON.parse(SPIELSTAND);
    Object.keys(riesig.resources).forEach(k => { if (k !== 'kristalle') riesig.resources[k] *= 1000; });
    const { ctx, page } = await laden(1310, 1000, { resources: riesig.resources });
    const m = await page.evaluate(MESSEN);
    const e = m.resbar.alle.find(k => k.res === 'energie');
    P.check('6a@1310 der riesige Betrag ist wirklich riesig (sonst prueft 6b/6c nichts)',
      /^\d{5,}/.test(e.wert.replace(/[.,]/g,'')), e.wert);
    P.check('6b@1310 er steht VOLLSTAENDIG da - der Chip waechst mit, statt die Zahl zu kuerzen',
      m.resbar.randRaus.length === 0 && m.resbar.schnitt.length === 0 && m.resbar.rasterRaus === 0,
      { randRaus:m.resbar.randRaus, gekuerzt:m.resbar.schnitt, rasterRaus:m.resbar.rasterRaus });
    P.check('6c@1310 der volle Betrag steht trotzdem im Titel',
      zahlen(e.wert).every(z => zahlen(e.titel).includes(z)), { titel:e.titel, wert:e.wert });
    await ctx.close();
  }

  // ---- 5: Der Riegel ist die BREITE, nicht nur die Klasse.
  // compact-head ist ein DREIzustand: state.compactHead schlaegt die Automatik dauerhaft, und der
  // Knopf dafuer steht auf JEDEM Geraet in der Kopfzeile. Wer am Handy einmal "Kopfzeile
  // ausfuehrlich" waehlt, darf die Verdichtung nicht bekommen - dort passen sechs Spalten nicht.
  {
    const { ctx, page } = await laden(390, 844, { compactHead:false });
    const m = await page.evaluate(MESSEN);
    P.check('5a@390 der Kompaktkopf ist hier per Wahl AUS (sonst prueft 5b nichts)', m.kompaktKopf === false, m.kompaktKopf);
    P.check('5b@390 die Verdichtung greift dort NICHT - keine sechs Spalten in 390 px',
      m.resbar.spalten !== 6 && m.resbar.kartenH > 50, { spalten:m.resbar.spalten, kartenH:m.resbar.kartenH });
    P.check('5c@390 die Kampfwerte stehen dort weiter SICHTBAR auf der Karte', m.kolonien.werteSichtbar === true, m.kolonien.werteText);
    await ctx.close();
  }
  // Die Grenze selbst: 1000 gehoert noch dem alten Stand, 1001 der Verdichtung
  // (COMPACT_HEAD_MAX_WIDTH + 1).
  // GEMESSEN WIRD DIE KARTENHOEHE, NICHT DIE SPALTENZAHL (Nachtrag 14.09.2026): Seit die Leiste
  // die Form der Werkstoff-Chips traegt, ist sie kein Raster mehr, und `gridTemplateColumns`
  // meldet dort gar keine Spalten. Eine Pruefung auf "sechs Spalten" haette also die FORM
  // festgeschrieben statt die Zusage - und waere an einer richtigen Aenderung gefallen. Die
  // Zusage ist: unterhalb der Grenze die alte, hohe Karte (gemessen 73 px), oberhalb die flache
  // (gemessen 30 px). Die Schwelle 50 liegt zwischen beiden, nicht auf einer von ihnen.
  for (const [breite, verdichtet] of [[1000,false],[1001,true]]) {
    const { ctx, page } = await laden(breite, 900, { compactHead:false });
    const m = await page.evaluate(MESSEN);
    P.check('5d@'+breite+' '+(verdichtet?'verdichtet':'alter Stand')+' - flache Karte: '+verdichtet,
      (m.resbar.kartenH <= 50) === verdichtet, { kartenH:m.resbar.kartenH, zeilen:m.resbar.zeilen });
    await ctx.close();
  }

  await P.ende(async () => { await browser.close(); });
})().catch(async e => { console.error(e); console.log('\nFAIL'); process.exit(1); });
