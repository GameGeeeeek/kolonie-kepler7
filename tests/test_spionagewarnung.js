// Die Spionage-Warnung kommt beim Ziel an (03.09.2026).
//
//   node tests/test_spionagewarnung.js
//
// DER ANLASS, gemessen: Die einzige Gegenspionage-Meldung des Spiels feuerte NIE. Beide Haelften
// waren fertig gebaut und nur nicht verbunden:
//
//   Einstellung   "Spionage-Warnungen - wenn dich jemand ausspaeht", Vorgabe AN
//   Absender      notifySpyTarget() nach jeder aufgeloesten Spionage
//   Anzeige       'spy-detected' mit Symbol, Farbe und Text
//   Server        eigener spyping:-Block, gegen Faelschung abgesichert
//
// `storageSet(key, value)` wurde ohne drittes Argument gerufen, schickte also `?shared=false` -
// und der Server behandelt `spyping:` ausschliesslich im shared-Zweig. Der Ping landete
// stattdessen im PRIVATEN Speicher des Absenders: ein dauerhafter Eintrag je geflogener Spionage
// in der echten db.json, waehrend das Ziel nichts erfuhr.
//
// WIE HIER GEPRUEFT WIRD: Die Funktion wird aus der Spieldatei GESCHNITTEN UND AUSGEFUEHRT, mit
// einem storageSet, das seine Argumente mitschreibt. Ein Regex auf die Aufrufzeile waere die
// Sorte Pruefung, die heute schon zweimal danebengelegen hat (docs/PROJECT_MEMORY.md): Sie
// haelt eine Schreibweise fest, nicht die Sache. Hier wird gemessen, WAS die Funktion sendet.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 0) Die Funktion schneiden und ausfuehren --------------------------------------------------
const von = JS.indexOf('  async function notifySpyTarget(targetId, deep){');
const bis = von >= 0 ? JS.indexOf('\n  }', von) : -1;
check('0-anker: notifySpyTarget laesst sich schneiden', von >= 0 && bis > von, { von, bis });
if (von < 0 || bis < 0) { ende(); return; }
const FN = JS.slice(von, bis + 4);

function ruf(opts){
  opts = opts || {};
  const gesendet = [];
  const bauen = new Function('gesendet', 'mitBackend', `
    function useBackend(){ return mitBackend; }
    const state = { player: { id: 'ich', name: 'Späher' } };
    async function storageSet(key, value, shared){ gesendet.push({ key, value, shared, argumente: arguments.length }); }
    ${FN}
    return notifySpyTarget;`);
  const fn = bauen(gesendet, opts.mitBackend !== false);
  return { fn, gesendet };
}

// ---- 1) Der Ping geht in den GETEILTEN Speicher -------------------------------------------------
{
  const { fn, gesendet } = ruf();
  return fn('opfer', true).then(() => {
    check('1: notifySpyTarget schickt genau einen Ping', gesendet.length === 1, gesendet.length);
    const p = gesendet[0] || {};
    check('1b: und zwar unter dem Schluessel des ZIELS', p.key === 'spyping:opfer', p.key);
    /* Der eigentliche Befund. `shared` muss WAHR sein - nicht nur "irgendein drittes Argument":
       storageSet baut daraus `?shared=` + (shared?'true':'false'), ein falsy Wert ist also
       genauso kaputt wie ein fehlendes Argument. */
    check('1c: SHARED - sonst behandelt der Server den Ping nicht und das Ziel erfaehrt nichts',
      p.shared === true,
      { shared: p.shared, argumente: p.argumente,
        hinweis: 'ohne dieses Argument landet der Ping im privaten Speicher des Absenders' });
    const nutz = JSON.parse(p.value || '{}');
    /* fromId muss mitgehen: Der Server verwirft jeden Ping, dessen fromId nicht zum eingeloggten
       Absender passt (Faelschungsschutz). Ein Ping ohne sie waere still wirkungslos. */
    check('1d: die Nutzlast traegt fromId, fromName und deep',
      nutz.fromId === 'ich' && typeof nutz.fromName === 'string' && nutz.deep === true,
      nutz);
    return weiter();
  });
}

function weiter(){
  // ---- 2) Die Gegenrichtungen ------------------------------------------------------------------
  {
    const { fn, gesendet } = ruf({ mitBackend: false });
    return fn('opfer', false).then(() => {
      check('2: ohne Backend (Solo-Betrieb) wird nichts gesendet', gesendet.length === 0, gesendet.length);
      const ohneZiel = ruf();
      return ohneZiel.fn(null, false).then(() => {
        check('2b: ohne Ziel ebenfalls nicht', ohneZiel.gesendet.length === 0, ohneZiel.gesendet.length);
        abschnitt3();
      });
    });
  }
}

function abschnitt3(){
  // ---- 3) Die andere Haelfte: der Server behandelt spyping NUR im shared-Zweig -------------------
  /* Ohne diese Pruefung koennte jemand den Server auf den privaten Zweig umbauen und die beiden
     Haelften liefen wieder auseinander - genau der Zustand, den diese Datei beendet. Geprueft
     wird die REIHENFOLGE im Text: Der spyping-Block muss NACH `if (shared) {` und VOR dessen
     Ende stehen. */
  const SERVER = path.join(__dirname, '..', '..', 'kolonie-kepler7-backend', 'server.js');
  if (!fs.existsSync(SERVER)) {
    console.log('----  3: Backend-Klon nicht daneben - Paritaetspruefung uebersprungen');
    return schluss();
  }
  const BE = fs.readFileSync(SERVER, 'utf8');
  const iShared = BE.indexOf('\n  if (shared) {');
  const iSpy = BE.indexOf("if (key.startsWith('spyping:'))");
  check('3-anker: beide Stellen sind im Backend zu finden', iShared > 0 && iSpy > 0, { iShared, iSpy });
  check('3: der Server behandelt spyping im SHARED-Zweig - dieselbe Seite, auf die der Client sendet',
    iShared > 0 && iSpy > iShared,
    { hinweis: 'liegt der Block ausserhalb, sendet der Client wieder ins Leere' });
  /* Und er speichert den Ping NICHT: Ein Eintrag je Spionage waere dauerhafter Datenmuell im
     geteilten Speicher. Der Block muss also mit einer eigenen Antwort enden, bevor geschrieben
     wird - genau das war im privaten Zweig anders, und deshalb wuchs db.private still mit. */
  const block = iSpy > 0 ? BE.slice(iSpy, BE.indexOf('\n    }', iSpy) + 6) : '';
  check('3b: und antwortet aus dem Block heraus, statt den Ping zu speichern',
    /return res\.json\(\{ ok: true \}\);/.test(block), block.slice(-90));
  schluss();
}

function schluss(){
  // ---- 4) Die Anzeige beim Ziel ist vorhanden ----------------------------------------------------
  /* Eine Meldung, die ankommt und nicht dargestellt wird, ist so still wie eine, die nie ankommt. */
  check('4: das Ziel kann die Meldung auch anzeigen',
    /'spy-detected':\s*\{/.test(JS), {});
  check('4b: und die Einstellung, die sie verspricht, gibt es weiterhin',
    /data-notif-cat="spy"/.test(HTML) && /Wenn dich jemand ausspäht/.test(HTML), {});
  ende();
}
