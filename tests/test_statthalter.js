// Die acht Statthalter: Regeln statt acht Geschmacksentscheidungen (03.09.2026, Konzept E2).
//
//   node tests/test_statthalter.js
//
// DER ANLASS, gemessen vor dem Bau: Die 18 Gegner der NPCS-Tabelle sassen in nur VIER der acht
// Regionen, zehn davon allein im Kepler-Kern. Obsidian-Saum, Meridian-Weiten und Ilyra-Tiefen
// hatten KEINEN einzigen Gegner. Acht benannte Statthalter schliessen die Luecke.
//
// WARUM DIESER TEST DIE REGELN NACHRECHNET UND NICHT DIE ACHT EINTRAEGE ABLIEST (Hausregel 40):
// Ort und Staerke folgen zwei Regeln, die sich aus SEKTOR_DEFS und STAR_SYSTEMS ableiten lassen.
// Eine Pruefung, die nur "statt_kepler steht in sysn_xenax" abhakt, waere beim naechsten neuen
// Sternsystem still falsch - und genau dann still, wenn ein Statthalter plotzlich nicht mehr am
// naechsten am Zentrum seiner Region sitzt. Gerechnet wird deshalb hier dasselbe, was der Bau
// gerechnet hat.
//
// Abschnitt 3 ist der eigentliche Waechter und gilt fuer ALLE Gegner, nicht nur die acht:
// npcWeaknessAusgenutzt ist eine if-Kette ueber sieben Schluessel und gibt fuer jeden achten
// still `false` zurueck. Das Kartenmenue zeigt die Schwaeche trotzdem an - eine Anzeige ohne
// Wirkung, also genau die Sorte Fehler, die man im Spiel nicht bemerkt.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const schneide = (start, endeRe) => {
  const i = S.indexOf(start);
  if (i < 0) return null;
  const rest = S.slice(i);
  const j = rest.search(endeRe);
  return j < 0 ? null : rest.slice(0, j);
};

// ===== 0. Anker ==============================================================================
const NPCBLOCK  = schneide('const NPCS = [', /\n\s*\];/);
const SEKBLOCK  = schneide('const SEKTOR_DEFS = [', /\n\s*\];/);
const SYSBLOCK  = schneide('const STAR_SYSTEMS =', /\n\s*\];/);
check('0-anker: NPCS, SEKTOR_DEFS und STAR_SYSTEMS lassen sich schneiden',
  !!NPCBLOCK && !!SEKBLOCK && !!SYSBLOCK,
  { npcs: !!NPCBLOCK, sektoren: !!SEKBLOCK, systeme: !!SYSBLOCK });
if (!NPCBLOCK || !SEKBLOCK || !SYSBLOCK) { ende(); return; }

const npcs = [...NPCBLOCK.matchAll(/\{\s*id:'([a-z0-9_]+)',\s*name:'([^']+)',\s*level:(\d+),\s*defense:(\d+),\s*duration:(\d+)[\s\S]*?system:'([a-z0-9_]+)'/g)]
  .map(m => ({ id: m[1], name: m[2], level: +m[3], defense: +m[4], duration: +m[5], system: m[6] }));
for (const n of npcs) {
  const eintrag = NPCBLOCK.slice(NPCBLOCK.indexOf("id:'" + n.id + "'"));
  const w = /weakness:'([a-z]+)'/.exec(eintrag);
  const st = /statthalter:'([a-z]+)'/.exec(eintrag.slice(0, eintrag.indexOf('\n    { id:') + 1 || undefined));
  n.weakness = w ? w[1] : null;
  n.statthalter = /^[\s\S]{0,900}?statthalter:'([a-z]+)'/.test(eintrag) ? /statthalter:'([a-z]+)'/.exec(eintrag)[1] : null;
}
const statthalter = npcs.filter(n => n.statthalter);
/* Ein leeres statthalter-Array liesse jede `filter(...).length === 0`-Pruefung unten trivial
   gruen werden - am Stand VOR dieser Etappe waeren sie alle unbeteiligt statt rot. `ACHT`
   steht deshalb in jeder dieser Bedingungen mit drin. */
const ACHT = statthalter.length === 8;
const sektoren = [...SEKBLOCK.matchAll(/\{\s*key:'([a-z]+)',\s*name:'([^']+)',\s*cx:(\d+),\s*cy:(\d+)/g)]
  .map(m => ({ key: m[1], name: m[2], cx: +m[3], cy: +m[4] }));
const systeme = [...SYSBLOCK.matchAll(/\{[^{}]*id:\s*'([a-z0-9_]+)'[^{}]*\}/g)].map(m => {
  const gx = /gx:\s*(-?[\d.]+)/.exec(m[0]), gy = /gy:\s*(-?[\d.]+)/.exec(m[0]);
  return { id: m[1], gx: gx ? +gx[1] : null, gy: gy ? +gy[1] : null, hidden: /hidden:\s*true/.test(m[0]) };
});
check('0b-vorab: die drei Tabellen sind vollstaendig gelesen',
  npcs.length >= 26 && sektoren.length === 8 && systeme.length >= 69 && systeme.every(s => s.gx !== null),
  { npcs: npcs.length, sektoren: sektoren.length, systeme: systeme.length });

// Dieselbe Naechster-Nachbar-Rechnung wie sektorVon() in der Spieldatei.
const sektorVon = sy => {
  let best = sektoren[0], bd = Infinity;
  for (const sk of sektoren) {
    const d = (sy.gx - sk.cx) * (sy.gx - sk.cx) + (sy.gy - sk.cy) * (sy.gy - sk.cy);
    if (d < bd) { bd = d; best = sk; }
  }
  return best;
};
const sysVon = id => systeme.find(s => s.id === id);

// ===== 1. Genau einer je Region, und er sitzt am richtigen Platz ==============================
check('1: in jeder der acht Regionen sitzt genau ein Statthalter',
  statthalter.length === 8 && new Set(statthalter.map(n => n.statthalter)).size === 8
    && sektoren.every(sk => statthalter.some(n => n.statthalter === sk.key)),
  { anzahl: statthalter.length, regionen: statthalter.map(n => n.statthalter) });

const falscheRegion = statthalter.filter(n => {
  const sy = sysVon(n.system);
  return !sy || sektorVon(sy).key !== n.statthalter;
});
check('1b: das statthalter-Feld stimmt mit der GERECHNETEN Region seines Systems ueberein',
  ACHT && falscheRegion.length === 0,
  { abweichend: falscheRegion.map(n => n.id + ': ' + n.statthalter + ' vs. ' + sektorVon(sysVon(n.system)).key) });

/* Regel 1 - der ORT. Frei heisst: dort steht kein ANDERER Gegner. Versteckte Systeme
   (hidden:true, zenith/tiefsee) scheiden aus: Ein Statthalter, den man erst nach einer
   Expeditions-Entdeckung ueberhaupt sehen kann, ist keine Landmarke seiner Region. */
const belegtVonAnderen = n => new Set(npcs.filter(x => x.id !== n.id).map(x => x.system));
const nichtAmZentrum = statthalter.filter(n => {
  const belegt = belegtVonAnderen(n);
  const frei = systeme.filter(s => !s.hidden && sektorVon(s).key === n.statthalter && !belegt.has(s.id));
  const sk = sektoren.find(x => x.key === n.statthalter);
  const abst = s => Math.hypot(s.gx - sk.cx, s.gy - sk.cy);
  const naechstes = frei.slice().sort((a, b) => abst(a) - abst(b))[0];
  return !naechstes || naechstes.id !== n.system;
});
check('2: jeder Statthalter sitzt im freien, sichtbaren System am naechsten zum Regionszentrum',
  ACHT && nichtAmZentrum.length === 0,
  { abweichend: nichtAmZentrum.map(n => n.id + ' steht in ' + n.system),
    hinweis: 'Regel 1 des Konzepts - siehe Kommentar ueber den acht Eintraegen in NPCS' });

// ===== 2. Regel 2 - die STAERKE waechst mit der Entfernung der Region ==========================
const kern = sektoren.find(sk => sk.key === 'kepler');
check('2-vorab: der Kepler-Kern ist der Bezugspunkt der Entfernungsregel', !!kern, { sektoren: sektoren.map(s => s.key) });
if (kern) {
  const nachEntfernung = statthalter.slice().sort((a, b) => {
    const sa = sektoren.find(x => x.key === a.statthalter), sb = sektoren.find(x => x.key === b.statthalter);
    return Math.hypot(sa.cx - kern.cx, sa.cy - kern.cy) - Math.hypot(sb.cx - kern.cx, sb.cy - kern.cy);
  });
  const nachStaerke = statthalter.slice().sort((a, b) => a.defense - b.defense);
  check('3: die Staerke waechst mit der Entfernung der Region vom Kepler-Kern',
    ACHT && nachEntfernung.map(n => n.id).join(',') === nachStaerke.map(n => n.id).join(','),
    { nachEntfernung: nachEntfernung.map(n => n.statthalter),
      nachStaerke: nachStaerke.map(n => n.statthalter) });
}

/* Die Verteidigungswerte liegen in den LUECKEN der vorhandenen Leiter. Gemessen wird die Regel,
   nicht die acht Zahlen: Kein Statthalter darf der neue Hoechst- oder Tiefstwert sein, und
   zwischen zwei Statthaltern muss immer mindestens ein alter Gegner stehen. */
const alt = npcs.filter(n => !n.statthalter).map(n => n.defense).sort((a, b) => a - b);
const ausserhalb = statthalter.filter(n => n.defense <= alt[0] || n.defense >= alt[alt.length - 1]);
check('4: kein Statthalter ist der neue schwaechste oder staerkste Gegner des Spiels',
  ACHT && ausserhalb.length === 0,
  { ausserhalb: ausserhalb.map(n => n.id + ' def ' + n.defense), alteLeiter: [alt[0], alt[alt.length - 1]] });
const doppelt = statthalter.filter(n => alt.includes(n.defense));
check('4b: kein Statthalter uebernimmt den Verteidigungswert eines vorhandenen Gegners',
  ACHT && doppelt.length === 0, { doppelt: doppelt.map(n => n.id + ' def ' + n.defense) });

// ===== 3. Der Waechter: eine Schwaeche, die niemand auswertet, ist eine Anzeige ohne Wirkung ===
const AUSGENUTZT = schneide('  function npcWeaknessAusgenutzt(npc, flotte){', /\n  \}/);
check('5-anker: npcWeaknessAusgenutzt laesst sich schneiden', !!AUSGENUTZT, {});
if (AUSGENUTZT) {
  const behandelt = new Set([...AUSGENUTZT.matchAll(/w === '([a-z]+)'/g)].map(m => m[1]));
  const unbehandelt = npcs.filter(n => n.weakness && !behandelt.has(n.weakness));
  check('5: JEDE weakness in NPCS wird von npcWeaknessAusgenutzt wirklich ausgewertet',
    unbehandelt.length === 0,
    { unbehandelt: unbehandelt.map(n => n.id + ': ' + n.weakness), behandelt: [...behandelt],
      hinweis: 'ein unbekannter Schluessel faellt dort still auf false und steht im Kartenmenue trotzdem als Schwachstelle' });
}
/* Der inhaltliche Anspruch: Ein Statthalter fuerchtet eine ANDERE Klasse als alle uebrigen
   Gegner seiner eigenen Region - sonst ist er nur ein weiterer Gegner mit demselben Rezept. */
const gleicheSchwaeche = statthalter.filter(n => npcs.some(x =>
  x.id !== n.id && x.weakness === n.weakness && sysVon(x.system) && sektorVon(sysVon(x.system)).key === n.statthalter));
check('6: jeder Statthalter fuerchtet eine andere Klasse als die uebrigen Gegner seiner Region',
  ACHT && gleicheSchwaeche.length === 0,
  { kollision: gleicheSchwaeche.map(n => n.id + ' (' + n.weakness + ')') });

// ===== 4. Die Chronik ========================================================================
const STUFEN = /const STATTHALTER_CHRONIK_STUFEN = \[([^\]]+)\]/.exec(S);
check('7-anker: die Chronik-Stufen stehen an EINER Stelle', !!STUFEN, {});
const stufenZahl = STUFEN ? STUFEN[1].split(',').length : 0;
const chronikFehlt = statthalter.filter(n => {
  const eintrag = NPCBLOCK.slice(NPCBLOCK.indexOf("id:'" + n.id + "'"));
  const arr = /chronik:\s*\[([\s\S]*?)\n\s*\]/.exec(eintrag);
  if (!arr) return true;
  return (arr[1].match(/^\s*'/gm) || []).length !== stufenZahl;
});
check('7: jeder Statthalter hat genau so viele Chronik-Fassungen wie es Stufen gibt',
  ACHT && stufenZahl === 4 && chronikFehlt.length === 0,
  { stufen: stufenZahl, unvollstaendig: chronikFehlt.map(n => n.id) });

// Die Auswahlfunktion wird AUSGEFUEHRT, nicht gelesen: Ein Off-by-one in der Schleife waere
// sonst genau der Fehler, den ein Textvergleich nicht sieht.
const FN = schneide('  function statthalterChronik(npc){', /\n  \}/);
check('8-anker: statthalterChronik laesst sich schneiden', !!FN, {});
if (FN && STUFEN) {
  const stufen = JSON.parse('[' + STUFEN[1] + ']');
  const lauf = new Function('STATTHALTER_CHRONIK_STUFEN', 'siegeVon', `
    function istStatthalter(npc){ return !!(npc && npc.statthalter); }
    function npcScalingCount(id){ return siegeVon(id); }
    ${FN}\n}
    return statthalterChronik;`);
  const vier = ['A', 'B', 'C', 'D'];
  const npcTest = { id: 'x', statthalter: 'kepler', chronik: vier };
  const erwartet = { 0: 'A', 1: 'B', 2: 'B', 3: 'C', 9: 'C', 10: 'D', 99: 'D' };
  const falsch = Object.keys(erwartet).filter(k => lauf(stufen, () => +k)(npcTest) !== erwartet[k]);
  check('8: statthalterChronik trifft die Stufen 0 / 1-2 / 3-9 / 10+ genau',
    falsch.length === 0,
    { falsch: falsch.map(k => k + ' Siege -> ' + lauf(stufen, () => +k)(npcTest) + ', erwartet ' + erwartet[k]) });
  check('8b: ein Gegner ohne Chronik bekommt einen leeren Text statt undefined',
    lauf(stufen, () => 0)({ id: 'y' }) === '', {});
}

// ===== 5. Anzeigestellen =====================================================================
const BADGES = schneide('  function karteSystemBadges(sysId){', /\n  \}/);
check('9-anker: karteSystemBadges laesst sich schneiden', !!BADGES, {});
if (BADGES) {
  const zeile = BADGES.split('\n').find(z => z.includes("icon:'🚩'"));
  check('9: das Statthalter-Abzeichen 🚩 steht in karteSystemBadges', !!zeile, {});
  /* Ohne Ebenen-Gate - wie das 🏰 und aus demselben Grund: ein Statthalter ist keine wechselnde
     Lage. Gemessen wird der TEXT VOR dem Abzeichen: liegt darin kein karteEbeneAn-Aufruf mehr
     zwischen dem Funktionsanfang und dem Abzeichen, steht es ausserhalb jedes Gates. */
  /* Kommentare leeren, bevor gemessen wird: Der Block ueber dem Abzeichen NENNT karteEbeneAn,
     um zu erklaeren, warum es dort nicht steht - ein roher Textvergleich faende genau diese
     Begruendung und meldete sie als Gate (derselbe Griff wie in test_flugzeit_deckel.js). */
  const BADGES_CODE = BADGES.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '');
  const vorher = BADGES_CODE.slice(0, BADGES_CODE.indexOf("icon:'🚩'"));
  check('9b: das 🚩 haengt an KEINER Kartenebene (wie das 🏰)',
    BADGES_CODE.includes("icon:'🚩'") && !/karteEbeneAn\(/.test(vorher),
    { hinweis: 'Ein Statthalter ist kein Ereignis. Wer das Gate einbaut, versteckt eine feste Tatsache.' });
  const zielZeile = BADGES.split('\n').find(z => z.includes('const npcsHier = NPCS.filter'));
  check('9c: der Statthalter faellt aus dem 🎯 heraus (kein zweites Abzeichen fuer denselben Gegner)',
    !!zielZeile && /!n\.statthalter/.test(zielZeile),
    { zeile: zielZeile });
}
const MENU = schneide('  function npcMapMenu(ev, npcId, npcName){', /\n  \}/);
check('10: das Kartenmenue zeigt die Chronik und den offenen Erstsieg',
  !!MENU && /statthalterChronik\(npc\)/.test(MENU) && /statthalterErstsiegOffen\(npc\)/.test(MENU), {});

// ===== 6. Der Erstsieg ist eine EINMALIGE Auszahlung ==========================================
/* Sternenessenz ist die einzige Waehrung, die Prestige UND Aufstieg ueberlebt. Ein Marker, der
   beim Reset mitgeloescht wird, macht aus 24 Essenz eine je Durchlauf wiederholbare Quelle -
   genau die Luecke, die bei den Forschungs-Meilensteinen schon einmal 127 Essenz je Prestige
   ausgeschuettet hat (Kommentar im Prestige-Zweig). */
const uebernahmen = (S.match(/statthalterKills: keepStatthalterKills/g) || []).length;
check('11: statthalterKills wird bei BEIDEN Resets mitgenommen (Prestige und Aufstieg)',
  uebernahmen === 2 && (S.match(/const keepStatthalterKills = /g) || []).length === 2,
  { uebernahmen, hinweis: 'sonst waeren 3 Sternenessenz je Statthalter und Durchlauf wiederholbar' });
check('11b: der Erstsieg wird nur gebucht, wenn er noch offen ist',
  /if \(istStatthalter\(npc\) && statthalterErstsiegOffen\(npc\)\)\{/.test(S)
  && /state\.statthalterKills\.push\(npc\.id\);/.test(S), {});
check('11c: der Anfangszustand kennt statthalterKills und die Vorgaben fuellen es auf',
  /claimedBossKills: \[\], statthalterKills: \[\],/.test(S)
  && (S.match(/if \(!Array\.isArray\(state\.statthalterKills\)\) state\.statthalterKills = \[\];/g) || []).length >= 2, {});

// ===== 7. Kompendium: eigene Kategorie, abgeleitete Gesamtzahl =================================
const KOMP = schneide('  const COMPENDIUM_CATS = [', /\n\s*\];/);
check('12-anker: COMPENDIUM_CATS laesst sich schneiden', !!KOMP, {});
if (KOMP) {
  const eintrag = KOMP.slice(KOMP.indexOf("key:'statthalter'"), KOMP.indexOf("key:'statthalter'") + 700);
  check('12: es gibt eine EIGENE Kompendium-Kategorie statthalter',
    KOMP.includes("key:'statthalter'"), {});
  check('12b: sie zaehlt die Erstsiege und leitet ihre Gesamtzahl aus der Tabelle ab',
    /have:\(\)=>statthalterErstsiege\(\)/.test(eintrag) && /total:\(\)=>statthalterAlle\(\)\.length/.test(eintrag),
    { hinweis: 'eine eingetippte 8 risse die Kategorie beim neunten Statthalter still auf' });
  /* Der Trophaeensaal bleibt bei drei Bossen. Wuerde er auf 11 erweitert, faellt jeder, der ihn
     bereits eingeloest hat, auf 3/11 zurueck und kaeme nie wieder an seine Belohnung -
     compendiumClaimed ueberlebt jeden Reset. */
  const bossEintrag = KOMP.slice(KOMP.indexOf("key:'bosses'"), KOMP.indexOf("key:'bosses'") + 400);
  check('12c: der Trophaeensaal wurde NICHT um die Statthalter erweitert',
    /total:\(\)=>3/.test(bossEintrag) && !/statt_/.test(bossEintrag), {});
}

// ===== 8. Hilfe und Detailtafel ===============================================================
check('13: die Hilfe erklaert die Statthalter mit beiden Regeln und der Erstsieg-Praemie',
  /title:'Die acht Statthalter'/.test(S)
  && /Entfernung seiner Region vom Kepler-Kern/.test(S)
  && /3 Sternenessenz und 40 Kampfpunkte/.test(S), {});
check('13b: der Landmarken-Eintrag nennt das 🚩 und die Ausnahme von der Ereignis-Ebene',
  /Ein <strong>🚩<\/strong> steht für den <strong>Statthalter<\/strong>/.test(S)
  && /die Allianzbasis \(🏰\) und der Statthalter \(🚩\) bleiben stehen/.test(S), {});
check('14: die Detailtafel gibt dem Statthalter einen EIGENEN Chip',
  /'Statthalter: ' \+ n\.name/.test(S), {});

/* Das Suchfeld bleibt bewusst frei davon (Entscheidung Sascha, 22.08.2026: die Suche zeigt
   Systeme und Planeten, Gegner findet man auf der Karte). Das Konzept vom 19.08.2026 nannte
   performSectorSearch noch als Anzeigestelle - es ist aelter als die Entscheidung. */
const SUCHE = schneide('  function performSectorSearch(query){', /\n  \}/);
check('15: die Statthalter sind ueber das Suchfeld bewusst NICHT auffindbar',
  !!SUCHE && !/statthalter/i.test(SUCHE) && !/NPCS/.test(SUCHE),
  { hinweis: 'Spieldesign-Entscheidung, kein Versehen - siehe Kommentar in performSectorSearch' });

ende();
