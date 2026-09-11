// Die Endprojekte im Spiel - was beim Umlegen von VP_ENDPROJEKTE_AKTIV noch fehlte (11.09.2026).
//
//   KEPLER_BACKEND_SERVER=/pfad/zu/server.js node tests/test_vorposten_endprojekte.js
//
// Das Projektfenster mit Grund je Endprojekt, der Griff des Lagers und die Buchung der
// Dock-Schiffe standen schon seit dem 07.09.2026 und haben ihre Waechter
// (test_vorposten_projekte_ui 2b, test_vorposten_lager_ui 5/6/7, test_vorposten_fracht 2b).
// Nachgemessen (Skill anzeigestellen) fehlten VIER Stellen, und um die geht es hier:
//   - Die Angriffsvorschau nannte fuer JEDE Station „6–45 % Verluste", auch mit Leitstand.
//   - Die Stationstafel nannte fertige Endprojekte nur beim Namen, nicht ihre Wirkung - und
//     nicht, ob sie ueberhaupt wirkt (ein Sternendock am Festungsring ruht).
//   - `dominiert` reiste zu jedem Client und wurde von keinem gelesen.
//   - Die Boersen-Kopfzeile sagte „+5 Angebotsplätze", ohne den Sternenmarkt zu nennen.
//   - Der Hilfetext kannte keines der drei Endprojekte.
//
// GEPRUEFT:
//   0a-0f Quelltext (immer): Vorschau liest projektBoni.verlust und die benannte Spanne; Tafel
//         traegt data-vp-dominiert und data-vp-endprojekt; Kartenzeichen und Leiste lesen
//         `dominiert`; die Boersen-Zeile liest projektBoni.marktPlaetze (und rechnet KEIN
//         basisMaxPerUser + x); der Lager-Zweig bucht `schiffe`; der Hilfetext nennt alle drei.
//   1a-1g Paritaet (nur mit Nachbar-server.js): VP_ENDPROJEKTE sind genau die Defs auf der
//         Endstufe, je EIN Kanal, und vpProjektWirkungText kennt jeden; das Sperrfeuer liest
//         auf beiden Seiten `projektBoni.verlust`; Grundverlust und Deckel sind gleich;
//         `dominiert` und `projektBoni` gehen an JEDEN Betrachter; Namen und Zahlen des
//         Hilfetexts (Schiff, Takt, Stapel, Plaetze, Punkte, Dauer) stimmen mit den Server-Defs.
//   2a-2h Browser, EIN Seitenaufruf, fuenf Stationen in fuenf Systemen:
//         Leiste (Basis-Tab): genau die dominierenden EIGENEN Stationen tragen den Chip.
//         w7 (eigen, Werft 7): Fenster nennt alle drei Endprojekte mit „Braucht Stufe 8.";
//                              Tafel ohne Dominanz und ohne Endprojekt-Zeile.
//         w8 (eigen, Werft 8, Sternendock fertig): Dominanz-Zeile; „Sternendock wirkt: …";
//                              Fenster nennt die zwei anderen mit „Baut nur …".
//         f8 (fremd, Festung 8, Leitstand fertig + ruhendes Sternendock): Tafel zeigt den
//                              Leitstand als wirkend, das Dock als ruhend; die Vorschau nennt
//                              den Leitstand, 14–45 % und data-vp-sperrfeuer=8.
//         x8 (fremd, Festung 8, ohne Leitstand): die Vorschau bleibt bei 6–45 %, kein Hinweis.
//         h8 (eigen, Handel 8, Sternenmarkt fertig): Boerse „+5 Angebotsplätze (davon 2 vom
//                              Sternenmarkt, über der üblichen Grenze)".
//
// GEGENPROBE: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = (src.match(/<script>([\s\S]*)<\/script>/) || [])[1] || '';

/* Rumpf einer Funktion: vom Namen bis zur NAECHSTEN Funktionsdefinition, gleich welcher
   Einrueckung (vorpostenFrachtBuchen steht am Zeilenanfang, die Vorposten-Helfer zwei Zeichen
   eingerueckt). Fehlt der Anfang, kommt '' zurueck - nie ein Slice bis zum Dateiende (der Anker
   wird VOR dem Schnitt geprueft, Skill neuer-test). */
function rumpf(name){
  const a = JS.indexOf(name);
  if (a < 0) return '';
  const re = /\n\s*(async\s+)?function\s/g;
  re.lastIndex = a + name.length;
  const m = re.exec(JS);
  return m ? JS.slice(a, m.index) : '';
}
const vorschau = rumpf('function vorpostenAngriffVorschauHtml(');
const tafel = rumpf('function vorpostenMapMenu(');
const endZeilen = rumpf('function vpEndprojektZeilen(');
const markt = rumpf('function marktVorpostenText(');
const buchen = rumpf('function vorpostenFrachtBuchen(');
const wirkFn = rumpf('function vpProjektWirkungText(');
const hilfeVon = JS.indexOf("title:'Vorposten: eine gehaltene Präsenz auf der Karte'");
const hilfe = hilfeVon < 0 ? '' : JS.slice(hilfeVon, JS.indexOf('{ title:', hilfeVon + 10));

check('0-anker: Vorschau, Tafel, Boersen-Zeile, Lager-Buchung, Wirkungstext und Hilfe-Eintrag sind auffindbar',
  vorschau.length > 200 && tafel.length > 2000 && markt.length > 100 && buchen.length > 500 && wirkFn.length > 200 && hilfe.length > 2000,
  { vorschau: vorschau.length, tafel: tafel.length, markt: markt.length, buchen: buchen.length, wirk: wirkFn.length, hilfe: hilfe.length });
check('0a: die Angriffsvorschau liest den Sperrfeuer-Aufschlag aus projektBoni.verlust und baut die Spanne aus den benannten Konstanten (keine harte „6–45%")',
  /\(v\.projektBoni\|\|\{\}\)\.verlust/.test(vorschau) && /VORPOSTEN_VERLUST_GRUND \+ sperr/.test(vorschau)
    && /data-vp-sperrfeuer=/.test(vorschau) && !/6–45%/.test(vorschau),
  { liestBoni: /\(v\.projektBoni\|\|\{\}\)\.verlust/.test(vorschau), harteSpanne: /6–45%/.test(vorschau) });
check('0b: die Stationstafel traegt die Dominanz (gegattert an v.dominiert vom Server) und die Wirkung der Endprojekte - gelesen aus projektBoni, nicht aus der Definition',
  /data-vp-dominiert="1"/.test(tafel) && /vpEndprojektZeilen\(v\)/.test(tafel)
    && /v\.projektBoni/.test(endZeilen) && /data-vp-wirkt=/.test(endZeilen) && /vpProjektWirkungText\(k\)/.test(endZeilen)
    && /\(v\.dominiert \? `<div class="bmeta" data-vp-dominiert="1"/.test(tafel),
  { dominanz: /data-vp-dominiert="1"/.test(tafel), zeilen: /vpEndprojektZeilen\(v\)/.test(tafel), helfer: endZeilen.length });
check('0c: Kartenzeichen und rechte Leiste lesen `dominiert` vom Server - und die Leiste fuehrt es in ihrer Signatur',
  /vpHier\.dominiert \? ' – dominiert das System'/.test(JS) && /data-fp-vp-dominiert="1"/.test(JS)
    && /\+ ':' \+ \(v\.dominiert \? 'D' : '-'\)\)\.join\('\|'\)/.test(JS),
  { zeichen: /vpHier\.dominiert/.test(JS), leiste: /data-fp-vp-dominiert/.test(JS), signatur: /v\.dominiert \? 'D'/.test(JS) });
/* Die Platzzahl bleibt die des Servers (test_vorposten_markt_ui 0d) - hier kommt nur die
   Herkunft dazu, und die darf nie mehr behaupten als die Zahl davor. */
check('0d: die Boersen-Zeile benennt den Sternenmarkt aus projektBoni.marktPlaetze der eigenen Stationen - gedeckelt auf `extra`, ohne basisMaxPerUser-Rechnung',
  /\(v\.projektBoni\|\|\{\}\)\.marktPlaetze/.test(markt) && /Math\.min\(extra,/.test(markt)
    && /vom Sternenmarkt/.test(markt) && !/basisMaxPerUser/.test(markt),
  { liest: /\(v\.projektBoni\|\|\{\}\)\.marktPlaetze/.test(markt), deckel: /Math\.min\(extra,/.test(markt) });
/* Die Kopplung zum Lager-Test (5a dort misst die Buchung im Browser): Der Zweig `vorposten-lager`
   muss durch DIESELBE Funktion gehen, die `r.schiffe` bucht - sonst schaltet das Backend heute ein
   Dock frei, dessen Kreuzer still verfallen. */
{
  const zweigVon = JS.indexOf("if (r.type === 'vorposten-lager'){");
  const zweigBis = zweigVon < 0 ? -1 : JS.indexOf("if (r.type === 'vorposten-verlust'){", zweigVon);
  const zweig = zweigVon >= 0 && zweigBis > zweigVon ? JS.slice(zweigVon, zweigBis) : '';
  check('0e: der Lager-Zweig bucht die Dock-Schiffe (r.schiffe ueber shipDefOrSuper) - auf beiden Wegen, Verband und Sofortbuchung',
    zweig.length > 100 && /vorpostenFrachtStarten\(r\)/.test(zweig) && /vorpostenFrachtBuchen\(r,/.test(zweig)
      && /r\.schiffe/.test(buchen) && /shipDefOrSuper\(k\)/.test(buchen),
    { zweig: zweig.length, startet: /vorpostenFrachtStarten\(r\)/.test(zweig), bucht: /r\.schiffe/.test(buchen) });
}
check('0f: der Hilfetext nennt alle drei Endprojekte, ihre Ausrichtung und die Dominanz',
  /<strong>Sternendock<\/strong> \(Werft\)/.test(hilfe) && /<strong>Sternenmarkt<\/strong> \(Handelsknoten\)/.test(hilfe)
    && /<strong>Sperrfeuerleitstand<\/strong> \(Festungsring\)/.test(hilfe) && /dominiert das System/.test(hilfe),
  { dock: /Sternendock/.test(hilfe), markt: /Sternenmarkt/.test(hilfe), sperr: /Sperrfeuerleitstand/.test(hilfe), dominanz: /dominiert das System/.test(hilfe) });

// ---- 1) Paritaet zu server.js ----------------------------------------------------------------
const SRV = SERVER_JS && fs.existsSync(SERVER_JS) ? fs.readFileSync(SERVER_JS, 'utf8') : '';
if (!SRV) {
  console.log('     INFO - Abschnitt 1 uebersprungen: keine server.js (KEPLER_BACKEND_SERVER setzen)');
} else {
  const schnitt = (t, von, bis) => { const a = t.indexOf(von); if (a < 0) return ''; const b = t.indexOf(bis, a); return b < 0 ? '' : t.slice(a, b); };
  const endKeys = ((schnitt(SRV, 'const VP_ENDPROJEKTE = [', '];')).match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, ''));
  const defsBlock = schnitt(SRV, 'const VP_PROJEKT_DEFS = [', '\n];');
  const defs = [...defsBlock.matchAll(/\{ key: '([a-z]+)', name: '([^']+)', icon: '([a-z0-9-]+)', zweig: (?:'([a-z]+)'|null), stufeAb: (\d+),\s*dauerMs: ([^,]+), wirkung: \{([^}]*)\}/g)]
    .map(m => ({ key: m[1], name: m[2], zweig: m[4] || null, stufeAb: Number(m[5]), dauer: m[6].trim(),
      wirkung: Object.fromEntries([...m[7].matchAll(/([a-zA-Z]+): ([\d.]+)/g)].map(x => [x[1], Number(x[2])])) }));
  const stufenBlock = schnitt(SRV, 'const VORPOSTEN_STUFEN = [', '\n];');
  const maxStufe = Math.max(0, ...[...stufenBlock.matchAll(/\{ stufe: (\d+),/g)].map(m => Number(m[1])));
  const endDefs = defs.filter(d => endKeys.includes(d.key));
  check('1-anker: VP_ENDPROJEKTE, VP_PROJEKT_DEFS und die Stufenleiter sind im Server lesbar (sonst misst 1a-1g nichts)',
    endKeys.length === 3 && defs.length >= 8 && endDefs.length === 3 && maxStufe >= 8,
    { endKeys, defs: defs.length, maxStufe });
  check('1a: die drei Endprojekte des Servers sind GENAU die Vorhaben der Endstufe, je eines pro Zweig',
    defs.filter(d => d.stufeAb === maxStufe).map(d => d.key).sort().join() === endKeys.slice().sort().join()
      && endDefs.every(d => d.zweig) && new Set(endDefs.map(d => d.zweig)).size === 3,
    { endstufe: defs.filter(d => d.stufeAb === maxStufe).map(d => d.key), zweige: endDefs.map(d => d.zweig) });
  /* Die Kanaele sind die EINZIGE Liste, die das Spiel ueber die Endprojekte fuehrt
     (VP_ENDPROJEKT_KANAELE) - und sie muss genau den Wirkungsschluesseln des Servers entsprechen,
     sonst uebersieht die Tafel ein Endprojekt oder haelt ein gewoehnliches dafuer. */
  const kanaeleFe = ((JS.match(/const VP_ENDPROJEKT_KANAELE = \[([^\]]*)\]/) || [])[1] || '').match(/'([a-zA-Z]+)'/g) || [];
  const kanaeleSrv = endDefs.map(d => Object.keys(d.wirkung));
  check('1b: jedes Endprojekt hat GENAU einen Wirkungskanal, das Spiel kennt jeden davon (Wirkungstext + Tafel) und keinen anderen',
    kanaeleSrv.every(k => k.length === 1)
      && kanaeleFe.map(x => x.replace(/'/g, '')).sort().join() === kanaeleSrv.map(k => k[0]).sort().join()
      && kanaeleSrv.every(k => new RegExp("k === '" + k[0] + "'").test(wirkFn)),
    { server: kanaeleSrv, spiel: kanaeleFe });
  const sperrDef = endDefs.find(d => d.key === 'sperrfeuer') || { wirkung: {} };
  check('1c: das Sperrfeuer liest auf beiden Seiten dasselbe Feld - Server vor dem Deckel aus projektBoni.verlust, Vorschau aus v.projektBoni.verlust',
    Object.keys(sperrDef.wirkung).join() === 'verlust'
      && /const sperrfeuer = \(vorpostenWerte\(doc\)\.projektBoni \|\| \{\}\)\.verlust \|\| 0;/.test(SRV)
      && /Math\.min\(0\.45, VORPOSTEN_VERLUST \+ sperrfeuer \+/.test(SRV)
      && /\(v\.projektBoni\|\|\{\}\)\.verlust/.test(vorschau),
    { defKanal: Object.keys(sperrDef.wirkung), serverListVorDeckel: /Math\.min\(0\.45, VORPOSTEN_VERLUST \+ sperrfeuer \+/.test(SRV) });
  const grundSrv = Number((SRV.match(/const VORPOSTEN_VERLUST = ([\d.]+);/) || [])[1]);
  const deckelSrv = Number((SRV.match(/Math\.min\(([\d.]+), VORPOSTEN_VERLUST \+ sperrfeuer/) || [])[1]);
  const grundFe = Number((JS.match(/const VORPOSTEN_VERLUST_GRUND = ([\d.]+);/) || [])[1]);
  const deckelFe = Number((JS.match(/const VORPOSTEN_VERLUST_MAX = ([\d.]+);/) || [])[1]);
  check('1d: Grundverlust und Deckel der Verlustspanne sind eine Kopie-Familie und stimmen ueberein',
    grundSrv > 0 && deckelSrv > 0 && grundSrv === grundFe && deckelSrv === deckelFe,
    { server: [grundSrv, deckelSrv], spiel: [grundFe, deckelFe] });
  const fnVon = SRV.indexOf('function vorpostenFuerClient(');
  const fnRumpf = fnVon < 0 ? '' : SRV.slice(fnVon, SRV.indexOf('\n}\n', fnVon));
  check('1e: `dominiert` und `projektBoni` gehen an JEDEN Betrachter (im Literal, nicht im Besitzer-Zweig) - sonst saehe der Angreifer weder Dominanz noch Leitstand',
    fnRumpf.length > 500 && /\n    dominiert: /.test(fnRumpf) && /\n    projektBoni: /.test(fnRumpf)
      && !/out\.dominiert =/.test(fnRumpf) && !/out\.projektBoni =/.test(fnRumpf),
    { rumpf: fnRumpf.length });
  /* Der Hilfetext ist selbst eine Anzeigestelle (Skill anzeigestellen). Seine Zahlen sind
     Kopien der Server-Werte - hier gegen die Quelle gehalten, damit ein geaenderter Takt oder
     Deckel nicht still im Hilfetext stehen bleibt. */
  const dockStd = Number((SRV.match(/const VP_DOCK_STUNDEN = (\d+);/) || [])[1]);
  const dockMax = Number((SRV.match(/const VP_DOCK_MAX = (\d+);/) || [])[1]);
  const dockSchiff = (SRV.match(/const VP_DOCK_SCHIFF = '([a-z]+)';/) || [])[1];
  const schiffName = (JS.match(new RegExp("\\{ key:'" + dockSchiff + "', name:'([^']+)'")) || [])[1];
  const dauerH = (() => { const s = new Set(endDefs.map(d => d.dauer)); if (s.size !== 1) return NaN;
    const e = endDefs[0].dauer; return /^[\d\s*+]+$/.test(e) ? Function('return (' + e + ')')() / 3600000 : NaN; })();
  const plaetze = (endDefs.find(d => d.key === 'sternenmarkt') || { wirkung: {} }).wirkung.marktPlaetze;
  const punkte = Math.round((sperrDef.wirkung.verlust || 0) * 100);
  check('1f: die Zahlen des Hilfetexts stimmen mit dem Server - Schiff, Takt, Stapel, Plaetze, Punkte, Dauer',
    dockStd > 0 && dockMax > 0 && !!schiffName && plaetze > 0 && punkte > 0 && dauerH > 0
      && new RegExp('alle ' + dockStd + ' Stunden einen ' + schiffName + ' bereit, bis zu ' + dockMax + ' gestapelt').test(hilfe)
      && new RegExp(plaetze + ' Angebotsplätze an der Modulbörse').test(hilfe)
      && new RegExp(punkte + ' Prozentpunkte mehr Verluste').test(hilfe)
      && new RegExp('Jedes dauert ' + dauerH + ' Stunden').test(hilfe),
    { dockStd, dockMax, schiffName, plaetze, punkte, dauerH, auszug: (hilfe.match(/alle \d+ Stunden[^;]{0,60}/) || [])[0] });
  check('1g: die Namen im Hilfetext sind die Namen der Server-Defs',
    endDefs.every(d => new RegExp('<strong>' + d.name + '</strong>').test(hilfe)), endDefs.map(d => d.name));
}

// ---- 2) Browser -------------------------------------------------------------------------------
const now = Date.now();
const ICH = 'u-ich';
const SYS = { w7: 'vega', w8: 'orion', f8: 'nebel', x8: 'krux', h8: 'rand' };
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:1200*s, kosten:{ erz:1000 } }));
const ZWEIGE = [
  { key:'werft',   name:'Werft',         kurz:'Schnelle Flotten.', namen:{ 7:'Flottenwerft', 8:'Sternenwerft' }, mult:{} },
  { key:'handel',  name:'Handelsknoten', kurz:'Verdient.',         namen:{ 8:'Sternenmarkt' }, mult:{} },
  { key:'festung', name:'Festungsring',  kurz:'Hält Systeme.',     namen:{ 8:'Sternenfestung' }, mult:{} }
];
const K = { erz:9000, kristalle:7000 };
const DEFS = [
  { key:'dockring', name:'Dockring', icon:'ti-rocket', zweig:'werft', stufeAb:5, dauerMs:28800000, wirkung:{ garnison:0.25 }, desc:'Ein zweiter Liegeplatzring.', kosten:K },
  { key:'handelskammer', name:'Handelskammer', icon:'ti-building-bank', zweig:'handel', stufeAb:5, dauerMs:28800000, wirkung:{ prod:0.35 }, desc:'Kontore am Ring.', kosten:K },
  { key:'bollwerk', name:'Bollwerk', icon:'ti-building-castle', zweig:'festung', stufeAb:5, dauerMs:28800000, wirkung:{ kern:0.20, verteidigung:0.20 }, desc:'Doppelte Schotten.', kosten:K },
  { key:'tiefenhorchen', name:'Tiefenhorchposten', icon:'ti-antenna-bars-5', zweig:null, stufeAb:6, dauerMs:43200000, wirkung:{ scan:1 }, desc:'Eine Lauschanlage.', kosten:K },
  { key:'sternendock', name:'Sternendock', icon:'ti-rocket', zweig:'werft', stufeAb:8, dauerMs:129600000, wirkung:{ werftSchiff:1 }, desc:'Eine eigene Helling im Orbit.', kosten:K },
  { key:'sternenmarkt', name:'Sternenmarkt', icon:'ti-building-bank', zweig:'handel', stufeAb:8, dauerMs:129600000, wirkung:{ marktPlaetze:2 }, desc:'Ein offener Handelsplatz.', kosten:K },
  { key:'sperrfeuer', name:'Sperrfeuerleitstand', icon:'ti-target', zweig:'festung', stufeAb:8, dauerMs:129600000, wirkung:{ verlust:0.08 }, desc:'Vorgehaltenes Sperrfeuer.', kosten:K },
  { key:'sprungtor', name:'Sprungtor', icon:'ti-atom-2', zweig:null, stufeAb:7, dauerMs:86400000, wirkung:{ flug:0.20, flugDeckel:0.75 }, desc:'Ein offenes Tor.', kosten:K }
];
/* Dieselben Felder wie in test_vorposten_lager_ui (Abschnitt 10 der Paritaetsdatei haelt jede
   Vorlage gegen vorpostenFuerClient). `projektBoni` ist absichtlich die SERVER-Rechnung: Bei f8
   steht ein Sternendock in `projekte`, sein Kanal in `projektBoni` aber auf 0 - genau der Fall,
   den die Tafel als „ruht" zeigen muss. */
function vp(over){
  return Object.assign({ id:'vp-' + over.sys, sys:'vega', besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Station', zweig:'werft', zweigName:'Werft', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000, garnison:{},
    schutzBis:0, ausbauAb: now-1000, eigener:true, verbuendet:false, meinLetzterSchlag:0, letzterKampf:null,
    slots:0, module:[], modulBoni:null, sets:[], setBoni:null,
    projekte:[], projektBoni:null, projektLaeuft:null, projektMoeglich:[],
    dockBereit:0, dockSchiff:'cruisers', dominiert:false, naechsteStufe:null, anflug:[],
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{ erz:0, kristalle:0, deuterium:0 }, lagerRate:{ erz:0, kristalle:0, deuterium:0 }, lagerVollAb: now + 9 * 3600 * 1000 }, over);
}
const fremd = { besitzer:'u-rivale', besitzerName:'Rivale', eigener:false, garnison:null, meineGarnison:0, meinPlatz:0 };
const LISTE = [
  vp({ sys:SYS.w7, stufe:7, name:'Flottenwerft', projektMoeglich:['sprungtor'] }),
  vp({ sys:SYS.w8, name:'Sternenwerft', projekte:['sternendock'], projektBoni:{ werftSchiff:1, marktPlaetze:0, verlust:0 }, dominiert:true }),
  vp(Object.assign({ sys:SYS.f8, name:'Sternenfestung', zweig:'festung', zweigName:'Festungsring',
    projekte:['sperrfeuer', 'sternendock'], projektBoni:{ werftSchiff:0, marktPlaetze:0, verlust:0.08 }, dominiert:true }, fremd)),
  vp(Object.assign({ sys:SYS.x8, name:'Sternenfestung', zweig:'festung', zweigName:'Festungsring', dominiert:true }, fremd)),
  vp({ sys:SYS.h8, name:'Orbitalfeste', zweig:'handel', zweigName:'Handelsknoten', projekte:['sternenmarkt'],
    projektBoni:{ werftSchiff:0, marktPlaetze:2, verlust:0 }, dominiert:true })
];
const LIMITS = { minPrice:1000, maxPrice:5000000, basisFeePct:0.05, basisMaxPerUser:5, maxPerUser:10, feePct:0.02, vorpostenRabatt:0.6, vorpostenAngebote:5 };
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN, zweige:ZWEIGE, zweigAb:4, maxStufe:8,
      modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'], modulAusbauKosten:250, modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0,
      projektDefs:DEFS, projekteAktiv:true, flugDeckel:0.5, lagerAktiv:true, lagerStunden:12,
      endprojekteAktiv:true, dockStunden:24, dockMax:7, dockSchiff:'cruisers',
      liste:LISTE, eigene:3 });
    if (p === 'modulemarket') return j({ listings:[], limits: LIMITS });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));

  /* Die Leiste steht auf dem Basis-Tab und wird VOR dem Wechsel zur Karte gelesen (wie in
     test_vorposten_zustand D3) - danach baut das Spiel sie bewusst nicht jede Sekunde neu. */
  const leiste = await page.evaluate(() => [...document.querySelectorAll('#fpVorpostenList [data-fp-vorposten]')]
    .map(b => ({ sys: b.getAttribute('data-fp-vorposten'), chip: !!b.querySelector('[data-fp-vp-dominiert]') })));
  check('2-anker: Boot ohne Skriptfehler, die Leiste fuehrt genau die drei eigenen Stationen',
    errs.length === 0 && leiste.length === 3, { errs: errs.slice(0, 2), leiste });
  check('2a: in der Leiste tragen GENAU die dominierenden eigenen Stationen den Chip - die Werft der Stufe 7 nicht',
    leiste.length === 3 && leiste.every(x => x.chip === (x.sys !== SYS.w7)), leiste);

  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);

  /* Ein Kartenmenue je Station. Das vorige wird VOR dem Klick entfernt (openKarteMenu taete es
     ohnehin), damit waitForFunction nie das alte Menue mit dem neuen Namen verwechselt. */
  async function tafelVon(sys, name){
    await page.evaluate(() => document.querySelectorAll('.kmenu').forEach(m => m.remove()));
    const offen = await oeffneSystemUeberSektoren(page, sys);
    await page.waitForTimeout(900);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await page.waitForFunction(n => { const m = document.querySelector('.kmenu'); return m && (m.textContent || '').indexOf(n) >= 0; }, name, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return null;
      const t = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
      return { text: t(m), dominiert: !!m.querySelector('[data-vp-dominiert]'),
        dominanzZeile: m.querySelector('[data-vp-dominiert]') ? t(m.querySelector('[data-vp-dominiert]')) : null,
        end: [...m.querySelectorAll('[data-vp-endprojekt]')].map(z => ({ key: z.getAttribute('data-vp-endprojekt'), wirkt: z.getAttribute('data-vp-wirkt'), text: t(z) })),
        knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), disabled: b.disabled })) };
    });
    return Object.assign({ offen }, g || { text: null, dominiert: null, dominanzZeile: null, end: [], knoepfe: [] });
  }
  async function projektFenster(name){
    await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /^Projekte/.test(x.textContent.trim())); if (b) b.click(); });
    await page.waitForFunction(n => { const o = document.getElementById('vorpostenProjektOverlay'); return o && o.classList.contains('open') && (o.textContent || '').indexOf('Projekte · ' + n) >= 0; }, name, { timeout: 15000 }).catch(() => {});
    const f = await page.evaluate(() => { const o = document.getElementById('vorpostenProjektOverlay');
      return o ? { text: (o.textContent || '').replace(/\s+/g, ' ').trim(), start: [...o.querySelectorAll('[data-vp-projekt-start]')].map(b => b.getAttribute('data-vp-projekt-start')) } : { text: '', start: [] }; });
    await page.evaluate(() => { const b = document.querySelector('#vorpostenProjektOverlay [data-vp-projekt-zu]'); if (b) b.click(); });
    await page.waitForTimeout(200);
    return f;
  }
  async function vorschauVon(){
    await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Vorposten angreifen/.test(x.textContent)); if (b) b.click(); });
    await page.waitForFunction(() => { const o = document.getElementById('fwahlOverlay'); return o && /Durchschlag/.test(o.textContent || ''); }, null, { timeout: 15000 }).catch(() => {});
    const v = await page.evaluate(() => { const o = document.getElementById('fwahlOverlay'); const z = o && o.querySelector('[data-vp-sperrfeuer]');
      return { text: o ? (o.textContent || '').replace(/\s+/g, ' ').trim() : '', sperr: z ? z.getAttribute('data-vp-sperrfeuer') : null }; });
    await page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-zu]'); if (b) b.click(); });
    await page.waitForTimeout(300);
    return v;
  }

  // w7 - Werft auf Stufe 7: die drei Endprojekte stehen mit dem Grund da, nichts dominiert.
  const w7 = await tafelVon(SYS.w7, 'Flottenwerft');
  const fw7 = await projektFenster('Flottenwerft');
  check('2b: auf Stufe 7 nennt das Fenster alle drei Endprojekte mit „Braucht Stufe 8." - und nur das Sprungtor hat einen Start-Knopf',
    /Sternendock[^·]{0,140}· Braucht Stufe 8\./.test(fw7.text) && /Sternenmarkt[^·]{0,140}· Braucht Stufe 8\./.test(fw7.text)
      && /Sperrfeuerleitstand[^·]{0,140}· Braucht Stufe 8\./.test(fw7.text) && fw7.start.join() === 'sprungtor',
    { start: fw7.start, auszug: (fw7.text.match(/Sperrfeuerleitstand.{0,120}/) || [])[0] });
  check('2c: die Tafel der Stufe 7 traegt weder Dominanz noch eine Endprojekt-Zeile',
    w7.offen && w7.text && /Flottenwerft/.test(w7.text) && w7.dominiert === false && w7.end.length === 0,
    { offen: w7.offen, dominiert: w7.dominiert, end: w7.end });

  // w8 - eigene Werft auf der Endstufe mit fertigem Sternendock.
  const w8 = await tafelVon(SYS.w8, 'Sternenwerft');
  const fw8 = await projektFenster('Sternenwerft');
  check('2d: die Endstufe dominiert - die Tafel sagt es, und das Sternendock steht als WIRKEND mit Schiff, Takt und Stapel',
    w8.dominiert === true && /Dominiert dieses System/.test(w8.dominanzZeile || '')
      && w8.end.length === 1 && w8.end[0].key === 'sternendock' && w8.end[0].wirkt === '1'
      && /Sternendock wirkt: 1 Kreuzer je 24 Stunden, bis zu 7 gestapelt/.test(w8.end[0].text),
    { dominanz: w8.dominanzZeile, end: w8.end });
  check('2d2: im Fenster der Werft stehen die zwei fremden Endprojekte mit ihrer Ausrichtung als Grund, ohne Start-Knopf',
    /Sternenmarkt[^·]{0,140}· Baut nur Handelsknoten\./.test(fw8.text) && /Sperrfeuerleitstand[^·]{0,140}· Baut nur Festungsring\./.test(fw8.text)
      && fw8.start.length === 0,
    { start: fw8.start, auszug: (fw8.text.match(/Sternenmarkt.{0,120}/) || [])[0] });

  // f8 - fremde Festung mit Leitstand und einem Sternendock, das dort nicht wirkt.
  const f8 = await tafelVon(SYS.f8, 'Sternenfestung');
  const vf8 = await vorschauVon();
  check('2e: an der fremden Festung zeigt die Tafel den Leitstand als wirkend, das Sternendock als RUHEND (falsche Ausrichtung) - und die Dominanz',
    f8.dominiert === true && f8.end.length === 2
      && f8.end.some(z => z.key === 'sperrfeuer' && z.wirkt === '1' && /Sperrfeuerleitstand wirkt: \+8 Prozentpunkte Verlust für jeden Angreifer/.test(z.text))
      && f8.end.some(z => z.key === 'sternendock' && z.wirkt === '0' && /Sternendock ruht – wirkt nur als Werft/.test(z.text)),
    { end: f8.end, dominiert: f8.dominiert });
  check('2f: die Angriffsvorschau nennt den Leitstand, den Aufschlag und die verschobene Spanne 14–45 %',
    vf8.sperr === '8' && /Sperrfeuerleitstand: \+8 Prozentpunkte Verluste/.test(vf8.text) && /14–45% Verluste/.test(vf8.text)
      && !/6–45% Verluste/.test(vf8.text) && /Durchschlag rund \d+%/.test(vf8.text),
    { sperr: vf8.sperr, auszug: (vf8.text.match(/Durchschlag.{0,220}/) || [])[0] });

  // x8 - fremde Festung OHNE Leitstand: die Vorschau bleibt bei der Grundspanne.
  await tafelVon(SYS.x8, 'Sternenfestung');
  const vx8 = await vorschauVon();
  check('2f2: ohne Leitstand bleibt die Vorschau bei 6–45 % und nennt keinen Aufschlag',
    vx8.sperr === null && /6–45% Verluste/.test(vx8.text) && !/Sperrfeuerleitstand/.test(vx8.text) && /Durchschlag rund \d+%/.test(vx8.text),
    { sperr: vx8.sperr, auszug: (vx8.text.match(/Durchschlag.{0,160}/) || [])[0] });

  // Boerse: der Sternenmarkt der eigenen Handelsstation wird benannt.
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="markt"]'); if (x) x.click(); });
  await page.waitForFunction(() => { const b = document.getElementById('moduleMarketBox'); const t = (b && b.textContent) || '';
    return /Angebot\(e\)/.test(t) || /bietet niemand ein Modul an/.test(t); }, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
  const boerse = await page.evaluate(() => { const b = document.getElementById('moduleMarketBox'); const z = b && b.querySelector('[data-vp-markt]');
    return { zeile: z ? (z.textContent || '').replace(/\s+/g, ' ').trim() : null }; });
  check('2g: die Boersen-Kopfzeile nennt die Plaetze des Servers UND davon den Anteil des Sternenmarkts',
    /\+5 Angebotsplätze \(davon 2 vom Sternenmarkt, über der üblichen Grenze\)/.test(boerse.zeile || ''), boerse);
  check('2h: keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });

/* GEGENPROBE, gemessen am 11.09.2026 gegen v8.715.0 (`git show HEAD:weltraum_kolonie.html` als
   KEPLER_SPIELDATEI, die Backend-Arbeitskopie mit umgelegtem Schalter als KEPLER_BACKEND_SERVER):
     FAELLT (15): 0a 0b 0c 0d 0f · 1b 1c 1d 1f 1g · 2a 2d 2e 2f 2g
     BLEIBT GRUEN (11, mit Absicht): 0-anker, 1-anker, 2-anker (Messvorrichtung); 0e (die Buchung
       der Dock-Schiffe stand schon - die Pruefung ist die KOPPLUNG, kein Neubau); 1a, 1e (reine
       Serverpruefungen); 2b, 2c, 2d2, 2f2 (Verhalten, das sich NICHT aendern darf: das Fenster mit
       Grund, die Tafel der Stufe 7 ohne Zeilen, die Vorschau ohne Leitstand); 2h.
   Eine Pruefung, die am alten Stand ebenfalls gruen waere und trotzdem Neues behauptete, gibt es
   nicht - jede neue Anzeigestelle hat genau eine rote Zeile in dieser Liste.
   Zweite Richtung (Regel 11 der Backend-CLAUDE): mit einer server.js OHNE die drei Endprojekte
   faellt 1-anker und mit ihm nichts Stilles - Abschnitt 1 meldet dann seine Voraussetzung. */
