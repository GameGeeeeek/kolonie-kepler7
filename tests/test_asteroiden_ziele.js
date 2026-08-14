// Tagesaufgaben und Erfolge mit Asteroiden-Bezug (Konzept docs/asteroiden-konzept.md, Phase 5).
//
// WARUM ERST JETZT: Das Konzept haelt ausdruecklich fest, dass Tagesaufgaben und Erfolge zuerst
// OHNE Asteroiden-Bezug ausgeliefert werden - "ein Erfolg, der eine Mechanik voraussetzt, die noch
// nicht rund laeuft, ist eine Beschwerde mit Ankuendigung". Mit Phase 5 laeuft sie.
//
// GEPRUEFT WIRD:
//   1) Die zwei Lebenszaehler werden an der EINEN Stelle gebucht, an der eine Abbaumission bzw.
//      eine gewonnene Anfechtung endet - und die Abbau-Buchung zaehlt die GESCHUERFTE Ladung,
//      nicht das im Lager Angekommene. Wer mit vollem Lager heimkommt, hat trotzdem geschuerft.
//   2) Die zwei Tagesaufgaben messen den Zuwachs seit Tagesbeginn (Muster battle/abgrundtauch),
//      haben ein available-Praedikat auf die Minentechnik und werden von der Tagesbeginn-Marke
//      erfasst - ohne sie waeren sie beim Aktualisieren mitten am Tag sofort erledigt.
//   3) Die vier Erfolge lesen dieselben Zaehler, haben Kategorie (ACH_CAT) und eigenes Icon
//      (ACH_ICONS, aus der Font-Whitelist), und ihre Beschreibung ist ein ganzer Satz (Regel 7).
//   4) DER EIGENTLICHE KERN: Die Zaehler ueberleben BEIDE Resets. "Schuerfbaron" verlangt eine
//      Million geschuerfter Rohstoffe - mit einem beim Prestige zurueckgesetzten Zaehler waere der
//      Erfolg fuer jeden, der prestiget, unerreichbar, und der Fortschrittsbalken rutschte bei
//      jedem Durchlauf zurueck. Das ist dieselbe Ueberlegung, aus der der Erfolg "Vollstaendige
//      Expansion" bei 11 Plaetzen stehen blieb, als das Limit auf 15 stieg.
//   5) Und die Anzeigestellen dazu: Beide Reset-Dialoge und der Hilfe-Abschnitt "Prestige" zaehlen
//      auf, was ein Reset erhaelt. Eine Liste, die den neuen Posten nicht nennt, ist genau die
//      zweite Anzeigestelle mit der alten Annahme (CLAUDE.md Pflicht 6).
//
// GEGENPROBE (Arbeitsregel 1, in BEIDE Richtungen ausgefuehrt - Ergebnisse siehe PR):
//   - Am Stand davor fehlen Zaehler, Vorlagen und Erfolge: 1a, 2a, 3a, 4a fallen geschlossen.
//   - Nimmt man `asteroidStats` aus den beiden Reset-Neuaufbauten heraus, faellt NUR 4a/4b - die
//     Probe, die belegt, dass Punkt 4 wirklich den Reset misst und nicht bloss die Existenz des
//     Feldes.
//   - Bucht man statt m.ladung die angekommene Menge, faellt 1c.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

const schnitt = (von, bis, ab) => {
  const a = JS.indexOf(von, ab || 0); if (a < 0) return '';
  const b = JS.indexOf(bis, a);       if (b < 0) return '';
  return JS.slice(a, b);
};

// ---------------------------------------------------------------- 1) Die Buchungsstellen
{
  // Der Ausschnitt endet am pushReport der Abbaumission - so ist sicher, dass die Buchung wirklich
  // im Zweig der ANGEKOMMENEN Mission steht und nicht irgendwo daneben in der Datei.
  const abbau = schnitt("const aufZusatzEcht = Math.max(0,", "pushReport({ type:'mining'");
  check('1a: die Abbaumission bucht Missionszahl und Menge', abbau.length > 200
    && /state\.asteroidStats\.missionen = \(state\.asteroidStats\.missionen\|\|0\) \+ 1;/.test(abbau)
    && /state\.asteroidStats\.geschuerft = \(state\.asteroidStats\.geschuerft\|\|0\) \+ \(m\.ladung\|\|0\);/.test(abbau),
    abbau.replace(/\s+/g, ' ').slice(0, 160));
  // Anker-Gegenprobe (Arbeitsregel 6): Ein indexOf-Endanker, den es nicht gibt, liefert -1 und
  // macht den Slice riesig - die Pruefung darueber waere dann trivial gruen.
  check('1b: der Ausschnitt ist wirklich der Abbau-Zweig (Endanker existiert)',
    abbau.length > 200 && abbau.length < 4000, abbau.length);
  /* Gezaehlt wird die GESCHUERFTE Ladung. Die Alternative waere `summe` (das im Lager
     Angekommene) - dann haenge der Fortschritt am Lagerstand statt am Bergbau.
     Gelesen wird die ZUWEISUNG selbst, nicht irgendein Vorkommen des Wortes: Der erste Anlauf
     dieses Tests suchte /geschuerft[\s\S]{0,60}m\.ladung/ ueber den ganzen Ausschnitt und traf
     damit den KOMMENTAR ueber der Buchung, der beide Woerter zitiert - gruen aus dem falschen
     Grund, also so schlecht wie rot (CLAUDE.md Regel 6 und 28). */
  const zuweisung = (abbau.match(/state\.asteroidStats\.geschuerft = [^\n]*/) || [''])[0];
  check('1c: gezaehlt wird die geschuerfte Ladung, nicht das Angekommene',
    /m\.ladung/.test(zuweisung) && !/summe/.test(zuweisung), zuweisung);

  const anf = schnitt("if (daten.gewonnen){", "pushReport({ type:'asteroid-contest'");
  check('1d: nur eine GEWONNENE Anfechtung wird gebucht',
    /state\.asteroidStats\.anfechtungen = \(state\.asteroidStats\.anfechtungen\|\|0\) \+ 1;/.test(anf)
    && anf.length < 700, anf.replace(/\s+/g, ' ').slice(0, 200));
}

// ---------------------------------------------------------------- 2) Die zwei Tagesaufgaben
{
  const defs = schnitt('const DAILY_QUEST_DEFS = [', 'const DAILY_QUEST_ACTIVE_COUNT');
  const prog = schnitt('function dailyQuestProgress(key){', '\n  }');
  const marken = schnitt('state.dailyQuests = {', 'claimed:{}');
  for (const k of ['asteroidabbau', 'asteroidladung']){
    const zeile = (defs.match(new RegExp("\\{ key:'" + k + "'[^\\n]*")) || [''])[0];
    check('2a: Vorlage "' + k + '" existiert mit Icon, Ziel und Belohnung',
      /icon:'ti-[a-z0-9-]+'/.test(zeile) && /target:\d+/.test(zeile) && /reward:\{/.test(zeile), zeile.slice(0, 140));
    // Ohne available-Praedikat kaeme die Aufgabe auch ohne Minentechnik in den Pool und waere den
    // ganzen Tag unerfuellbar - derselbe Fall wie bei 'tier2' und 'skillpoint'.
    check('2b: "' + k + '" kommt nur mit Minentechnik in den Pool',
      /available: \(\) => \(state\.research\.rminentechnik\|\|0\) >= 1/.test(zeile), zeile.slice(-120));
    check('2c: "' + k + '" misst den Zuwachs seit Tagesbeginn',
      new RegExp("key==='" + k + "'[\\s\\S]{0,140}Math\\.max\\(0,[\\s\\S]{0,120}dq\\.startAst").test(prog),
      (prog.match(new RegExp("key==='" + k + "'[^\\n]*")) || [''])[0]);
  }
  check('2d: die Tagesbeginn-Marken werden gesetzt (sonst waere die Aufgabe sofort erledigt)',
    /startAstMissionen: \(state\.asteroidStats\|\|\{\}\)\.missionen\|\|0/.test(marken)
    && /startAstGeschuerft: \(state\.asteroidStats\|\|\{\}\)\.geschuerft\|\|0/.test(marken),
    (marken.match(/startAst[^\n]*/) || [''])[0]);
  // Gegenprobe zu 2d: Der Marken-Ausschnitt muss wirklich der Tagesreset sein.
  check('2d2: der Marken-Ausschnitt ist der Tagesreset', /startBattlePoints/.test(marken), marken.length);
}

// ---------------------------------------------------------------- 3) Die vier Erfolge
{
  const ERWARTET = { astfirst:'missionen', ast50:'missionen', astmillion:'geschuerft', astrevier:'anfechtungen' };
  const achBlock = schnitt('const ACHIEVEMENTS = [', '\n  const ACH_CAT_DEFS');
  const catBlock = schnitt('const ACH_CAT = {', '\n  };');
  const iconBlock = schnitt('const ACH_ICONS = {', '\n  };');
  const whitelist = new Set([...HTML.matchAll(/\.ti-([a-z0-9-]+):before/g)].map(m => 'ti-' + m[1]));
  check('3-vorab: Erfolgs-, Kategorie- und Icon-Block gefunden',
    achBlock.length > 1000 && catBlock.length > 200 && iconBlock.length > 200 && whitelist.size > 50,
    { ach: achBlock.length, cat: catBlock.length, icon: iconBlock.length, icons: whitelist.size });
  for (const [k, zaehler] of Object.entries(ERWARTET)){
    const zeile = (achBlock.match(new RegExp("\\{ key:'" + k + "'[^\\n]*")) || [''])[0];
    check('3a: Erfolg "' + k + '" liest den Zaehler ' + zaehler,
      new RegExp("asteroidStats\\|\\|\\{\\}\\)\\." + zaehler).test(zeile), zeile.slice(0, 120));
    check('3b: "' + k + '" hat check UND progress', /check: s =>/.test(zeile) && /progress: s =>/.test(zeile));
    // Regel 7: ein ganzer Satz, nicht ein Kuerzel.
    const desc = (zeile.match(/desc:'((?:[^'\\]|\\.)*)'/) || [])[1] || '';
    check('3c: "' + k + '" hat eine vollstaendige Beschreibung', desc.length >= 90 && /\.$/.test(desc.trim()),
      desc.slice(0, 90));
    check('3d: "' + k + '" hat eine Kategorie', new RegExp(k + ":'[a-z]+'").test(catBlock));
    const icon = (iconBlock.match(new RegExp(k + ":'(ti-[a-z0-9-]+)'")) || [])[1];
    check('3e: "' + k + '" hat ein eigenes Icon aus der Whitelist', !!icon && whitelist.has(icon), icon);
  }
  // Vier verschiedene Symbole - sonst waere die Gruppe in der groessten Kartenliste des Spiels flach.
  const icons = Object.keys(ERWARTET).map(k => (iconBlock.match(new RegExp(k + ":'(ti-[a-z0-9-]+)'")) || [])[1]);
  check('3f: die vier tragen vier VERSCHIEDENE Icons', new Set(icons).size === 4, icons);
}

// ---------------------------------------------------------------- 4) Der Kern: Resets
{
  // Beide Neuaufbauten - Prestige und Aufstieg. Die Zahl 2 ist die eigentliche Aussage: EIN
  // Vorkommen hiesse, dass genau einer der beiden Wege den Fortschritt wegwirft.
  const treffer = (JS.match(/asteroidStats: state\.asteroidStats \|\| \{ missionen:0, geschuerft:0, anfechtungen:0 \}/g) || []).length;
  check('4a: die Zaehler ueberleben BEIDE Reset-Neuaufbauten', treffer === 2, treffer);
  // Gegenprobe: Es gibt wirklich zwei Neuaufbauten - sonst waere die 2 oben eine Zufallszahl.
  const rebuilds = (JS.match(/abgrund: abgrundUeberReset\(/g) || []).length;
  check('4b: es gibt auch wirklich zwei Neuaufbauten', rebuilds === 2, rebuilds);
  check('4c: und ein Vorgabewert, damit das Feld in jedem Spielstand dieselbe Form hat',
    /if \(!state\.asteroidStats \|\| typeof state\.asteroidStats !== 'object'\) state\.asteroidStats =/.test(JS));
}

// ---------------------------------------------------------------- 5) Die Anzeigestellen dazu
{
  const stellen = [
    ['Prestige-Dialog', schnitt("if (!confirm('Prestige zurücksetzen?", "')) return;")],
    ['Aufstiegs-Dialog', schnitt("if (!confirm('AUFSTIEG:", "')) return;")],
    ['Hilfe-Abschnitt Prestige', schnitt("{ title:'Prestige', body:", "' },")]
  ];
  for (const [name, text] of stellen){
    check('5: ' + name + ' gefunden', text.length > 200, text.length);
    check('5: ' + name + ' nennt die Asteroiden-Bilanz', /Asteroiden-Bilanz/.test(text),
      text.replace(/\s+/g, ' ').slice(0, 120));
  }
}

// ---------------------------------------------------------------- 6) Hilfe zu den Tagesaufgaben
{
  const hilfe = schnitt("{ title:'Tagesaufgaben', body:", "' },");
  check('6: die Hilfe nennt beide Guertel-Aufgaben',
    /Abbaumissionen abschließen/.test(hilfe) && /Rohstoffe aus Asteroiden schürfen/.test(hilfe), hilfe.length);
  // Die bewusste Auslassung gehoert genannt - sonst liest sie sich wie ein Versehen.
  check('6: und sagt, warum Schuerfrechte KEINE Tagesaufgabe sind',
    /Schürfrechte und Anfechtungen sind bewusst keine Tagesaufgabe/.test(hilfe));
}

ende();
