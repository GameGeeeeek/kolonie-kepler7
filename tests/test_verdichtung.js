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
// GEGENPROBEN (KEPLER_VERDICHTUNG_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   alt            der Stand v8.729.0 vor dieser Aenderung
//   sabTitelFest   Titel nur im Aufbau-Zweig, nicht im Takt-Zweig
//   sabTitelEigen  Titel mit eigener Formulierung statt aus rateHtml abgeleitet
//   sabHandy       der body:not(.compact-head)-Riegel entfernt (Verdichtung auch am Handy)
//   sabDeckel      max-width:none an der Kolonienkarte zurueckgenommen
//   sabWerte       die drei Kampfwerte fehlen im Kolonie-Titel
const { starteBrowser, SPIEL_URL, versionAbfangen, pruefer } = require('./lib/umgebung');
const P = pruefer();

const KOL = {}; const DISC = {};
const NAMEN = ['vesna','rhea','aion','kaska','draconis','thessa','nyxar','oberon','zeta','echo9','helion','nocta','pyra'];
for (const n of NAMEN){ DISC[n]=true; KOL[n]={ buildings:{solar:9,mine:8,habitat:4,turm:6,werft:3}, fleet:{ships:12,cruisers:4,missions:[]} }; }
const SPIELSTAND = JSON.stringify({
  tutorialSeen:true, seenTabs:{basis:1,verteidigung:1,forschung:1,flotte:1,expedition:1,karte:1,galaxie:1,allianz:1,offiziere:1,markt:1,punkte:1,fortschritt:1,sammlung:1},
  resources:{energie:3.2129e8,erz:3.2098e8,kristalle:50,deuterium:2.2683e8,antimaterie:9.284e7,forschungspunkte:5.242e7},
  // Die Gebaeudeschluessel sind aus BUILDING_DEFS ABGELESEN, nicht erfunden: die Kristalle kommen
  // aus der 'raffinerie', nicht aus einer 'kristallmine'. Mit erfundenen Schluesseln produziert der
  // Pruefstand gar nichts - und 2c waere dann aus dem falschen Grund gruen (nichts bewegt sich).
  buildings:{solar:40,mine:38,raffinerie:20,synth:18,fusionsreaktor:14,habitat:10,lager:30,werft:24,turm:20,schild:18,laser:20,plasma:16,raketen:15,gauss:14,festung:9},
  research:{rkampf:12,rsolar:12,rerz:11,rschild:9},
  fleet:{ships:400,cruisers:300,jaeger:9000,bomber:2600,schlachtschiff:1200,frachter:800,missions:[]},
  discovered:DISC, colonies:KOL, activeBasePlanet:'home', player:{id:'u',name:'AdmiralX',avatarKey:null},
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
  const sichtbar = el => el && getComputedStyle(el).display !== 'none';
  const abgeschnitten = el => el.scrollWidth > el.clientWidth + 1;
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
  const erste = karten[0] || null;
  const ersteKol = kk[0] || null;
  return {
    kompaktKopf: document.body.classList.contains('compact-head'),
    resbar: bar ? {
      anzahl: karten.length, zeilen: zeilenVon(karten),
      hoehe: Math.round(bar.getBoundingClientRect().height),
      kartenH: erste ? Math.round(erste.getBoundingClientRect().height) : null,
      schnitt, ueberlauf: kartenUeberlauf(karten),
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
      titel: ersteKol ? (ersteKol.getAttribute('title')||'') : '',
      werteText: ersteKol ? (ersteKol.querySelector('.dash-colony-stats')||{textContent:''}).textContent.replace(/\s+/g,' ').trim() : '',
      werteSichtbar: sichtbar(ersteKol && ersteKol.querySelector('.dash-colony-stats'))
    } : null
  };
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
  const laden = async (breite, hoehe) => {
    const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe||1000 } });
    const page = await ctx.newPage();
    await versionAbfangen(page);
    await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
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
    P.check('0c'+b+' die Kolonienzeile traegt alle 14 Kolonien', !!m.kolonien && m.kolonien.anzahl === 14, m.kolonien && m.kolonien.anzahl);

    // 1: die Regel, aus der die Hoehe folgt
    P.check('1a'+b+' die sechs Rohstoffkarten stehen in EINER Reihe', m.resbar.zeilen === 1, m.resbar.zeilen);
    P.check('1b'+b+' eine Rohstoffkarte ist hoechstens so hoch wie zwei Textzeilen (<=50 px)', m.resbar.kartenH <= 50, m.resbar.kartenH);
    P.check('1c'+b+' eine Koloniekarte ist hoechstens so hoch wie eine Textzeile samt Polster (<=40 px)', m.kolonien.kartenH <= 40, m.kolonien.kartenH);

    // 2: nichts Sichtbares abgeschnitten, und was fehlt, steht im Titel
    P.check('2a'+b+' in der Rohstoffleiste ist kein sichtbarer Text abgeschnitten', m.resbar.schnitt.length === 0, m.resbar.schnitt);
    P.check('2a2'+b+' in der Kolonienzeile ist kein sichtbarer Text abgeschnitten', m.kolonien.schnitt.length === 0, m.kolonien.schnitt);
    P.check('2a3'+b+' keine Rohstoffkarte schneidet ihren eigenen Inhalt weg', m.resbar.ueberlauf.length === 0, m.resbar.ueberlauf);
    P.check('2a4'+b+' keine Koloniekarte schneidet ihren eigenen Inhalt weg', m.kolonien.ueberlauf.length === 0, m.kolonien.ueberlauf);
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

    // 3: die Kolonienkarte
    const kt = zahlen(m.kolonien.titel), kw = zahlen(m.kolonien.werteText);
    P.check('3a'+b+' der Kolonie-Titel nennt Angriffskraft, Verteidigung und Schiffe',
      /Angriffskraft/.test(m.kolonien.titel) && /Verteidigungspunkte/.test(m.kolonien.titel) && /Schiffe/.test(m.kolonien.titel), m.kolonien.titel);
    P.check('3b'+b+' der Kolonie-Titel traegt DIESELBEN drei Werte wie die (verborgene) Werte-Zeile',
      kw.length >= 3 && kw.every(z => kt.includes(z)), { titel:m.kolonien.titel, werte:m.kolonien.werteText });

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

  await P.ende(async () => { await browser.close(); });
})().catch(async e => { console.error(e); console.log('\nFAIL'); process.exit(1); });
