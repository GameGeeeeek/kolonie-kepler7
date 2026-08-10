// Fraktionsterritorium auf der Galaxiekarte: Fläche, Wappen, Frontsegmente, EINE Farbe.
//
// WARUM (Befund 09./10.08.2026): Territorium und gegenseitige Eroberung laufen serverseitig seit
// Monaten - im Client war davon nur ein 16-px-Ring am Systemknoten zu sehen. Keine Fläche, keine
// Grenze, kein Hinweis darauf, WO zwei verfeindete Gebiete aneinanderstoßen.
//
// Dazu widersprachen sich drei Farbquellen: Die Karte las galaxyCache roh aus (Serverfarbe: Legion
// blau, Void rot), das Wappen ICONS.fac_legion ist rot gezeichnet, und das Überfall-Banner nahm
// ausdrücklich die Frontend-Farbe. In der Fraktionskarte stand deshalb das rote Legions-Wappen
// direkt neben einem blau eingefärbten Namen.
//
// GEGENPROBE, in beide Richtungen ausgeführt (10.08.2026):
//   git show HEAD:weltraum_kolonie.html > /tmp/alt.html && KEPLER_SPIELDATEI=/tmp/alt.html node …
//   → rot: keine terrGlow-Verläufe, kein Frontsegment, factionOwning ohne Farbabbildung.
//   Am neuen Stand grün. Zusätzlich künstlich kaputtgemacht: mapColor der Legion auf #e24b4a
//   zurückgesetzt → „Legion-Fläche kollidiert nicht mit --c-danger" schlägt an.

const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const fs = require('fs');

const { check, ende } = pruefer();
const src = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8');

// ---- 1. Eine Farbquelle statt dreier ------------------------------------------------------------
check('factionColorOf existiert', /function factionColorOf\(fid, serverFarbe\)/.test(src));
check('factionMapColorOf existiert', /function factionMapColorOf\(fid, serverFarbe\)/.test(src));

// Der Kern der Umkehrung: In diplomacyFactions darf die Serverfarbe NICHT mehr gewinnen.
check('diplomacyFactions lässt die Serverfarbe nicht mehr gewinnen',
  !/color: s\.color \|\| d\.color/.test(src));
check('diplomacyFactions nimmt die lokale Farbe', /color: factionColorOf\(fid, s\.color\)/.test(src));

// factionOwning muss die Anzeigefarbe mitgeben, sonst greift die Karte wieder auf f.color zu.
const owningBlock = src.slice(src.indexOf('function factionOwning(systemId)'),
                              src.indexOf('function factionOwning(systemId)') + 900);
check('factionOwning gefunden', owningBlock.length > 100);
check('factionOwning bildet die Farbe ab', /color: factionColorOf\(f\.id, f\.color\)/.test(owningBlock));
check('factionOwning liefert auch die Kartenfarbe', /mapColor: factionMapColorOf\(f\.id, f\.color\)/.test(owningBlock));

// ---- 2. Die Legion-Flächenfarbe kollidiert nicht mehr -------------------------------------------
// #e24b4a ist --c-danger UND die Kernfarbe des eigenen Heimatsterns. Eine Legion-Fläche in genau
// dieser Farbe läge auf derselben Karte wie der rote Heimatkern und die roten Kollaps-Ringe.
const diploBlock = src.slice(src.indexOf('const FACTION_DIPLOMACY = {'),
                             src.indexOf('const FACTION_DIPLOMACY = {') + 1200);
check('FACTION_DIPLOMACY gefunden', diploBlock.includes('schatten:'));
const legionZeile = diploBlock.split('\n').find(z => z.trim().startsWith('legion:')) || '';
check('Legion hat eine eigene mapColor', /mapColor:'#[0-9a-f]{6}'/.test(legionZeile), legionZeile.trim().slice(0, 90));
const legionMap = (legionZeile.match(/mapColor:'(#[0-9a-f]{6})'/) || [])[1];
check('Legion-Fläche kollidiert nicht mit --c-danger', legionMap && legionMap !== '#e24b4a', legionMap);
// Und die Prüfung darf nicht trivial bestehen, weil gar keine Farbe gefunden wurde.
check('Legion-mapColor ist eine echte Farbe', /^#[0-9a-f]{6}$/.test(legionMap || ''), legionMap);
// Alle vier brauchen eine mapColor, sonst fällt eine still auf den Rückfall.
for (const fid of ['kartell', 'void', 'legion', 'schatten']) {
  const z = diploBlock.split('\n').find(x => x.trim().startsWith(fid + ':')) || '';
  check(fid + ' hat mapColor', /mapColor:'#[0-9a-f]{6}'/.test(z));
}

// ---- 3. Territorium als Fläche ------------------------------------------------------------------
check('Verlauf je Fraktion in den Karten-defs', /id="terrGlow-\$\{fid\}"/.test(src));
check('Fläche je besessenem System wird gezeichnet', /fill="url\(#terrGlow-\$\{fid\}\)"/.test(src));
check('Radius folgt der Knotenskala', /r="\$\{\(30\*galaxyNodeScale\(\)\)\.toFixed\(1\)\}"/.test(src));

// ---- 4. Frontsegmente ---------------------------------------------------------------------------
// Der Ausschnitt hat einen EXISTIERENDEN Endanker - fehlt er, liefe indexOf auf -1 und der Slice
// bis fast ans Dateiende, womit jede Prüfung darin vacuous würde (CLAUDE.md-Testregel 6).
const frontStart = src.indexOf('Frontsegmente zwischen verfeindeten Gebieten');
check('Frontsegment-Block vorhanden', frontStart > 0);
const frontEnde = src.indexOf('Die Systemebene: eine leere Gruppe', frontStart);
check('Endanker des Frontsegment-Blocks vorhanden', frontEnde > frontStart, { frontStart, frontEnde });
const frontBlock = frontEnde > frontStart ? src.slice(frontStart, frontEnde) : '';

check('Front nutzt FACTION_RIVALS', /FACTION_RIVALS\[besitzer\[a\]\]/.test(frontBlock));
// Der Punkt, an dem der Entwurf ausdrücklich hängt: Bildschirmabstände, nicht gx/gy.
check('Front misst Bildschirmabstände (spiralPos), nicht gx/gy',
  /Math\.hypot\(spiralPos\[a\]\.x-spiralPos\[b\]\.x/.test(frontBlock));
check('Front greift NICHT auf gx/gy zu', !/\.gx\b/.test(frontBlock) && !/\.gy\b/.test(frontBlock));
check('je System nur die engste Berührung', /if \(d < best\)\{ best = d; partner = b; \}/.test(frontBlock));
check('Riegel entsteht je Paar nur einmal', /a < partner \? a\+'\|'\+partner : partner\+'\|'\+a/.test(frontBlock));
check('Front hat einen dunklen Grat gegen die Territoriumsfarben', /stroke="#060812"/.test(frontBlock));

// ---- 5. Bewegung nur per SMIL -------------------------------------------------------------------
// Ein pro Tick gerechneter Wert würde das Markup jede Sekunde ändern und den Zwischenspeicher am
// Ende von buildGalaxyMap dauerhaft ausser Kraft setzen - alle Knoten würden im Sekundentakt neu
// gebaut. Deshalb: Animation ja, aber ausschliesslich als SMIL im Markup.
check('Front animiert per SMIL', /<animate attributeName="stroke-dashoffset"/.test(frontBlock));
check('kein Date.now im Frontsegment-Block', !/Date\.now\(\)/.test(frontBlock));
check('kein Math.random im Frontsegment-Block', !/Math\.random\(\)/.test(frontBlock));

// Dasselbe für die Flächenebene: Auch sie darf das Markup nicht sekündlich verändern.
const flaechStart = src.indexOf('Fraktionsterritorium als FLÄCHE');
check('Flächen-Block vorhanden', flaechStart > 0);
const flaechEnde = src.indexOf('Wurmloch-Verbindungslinie', flaechStart);
check('Endanker des Flächen-Blocks vorhanden', flaechEnde > flaechStart, { flaechStart, flaechEnde });
const flaechBlock = flaechEnde > flaechStart ? src.slice(flaechStart, flaechEnde) : '';
check('kein Date.now in der Flächenebene', !/Date\.now\(\)/.test(flaechBlock));
check('kein Math.random in der Flächenebene', !/Math\.random\(\)/.test(flaechBlock));

// ---- 6. Wappen am Knoten ------------------------------------------------------------------------
check('Wappen wird als verschachteltes SVG eingehängt', /ownerWappen/.test(src));
check('Wappen kommt aus ICONS', /ICONS\['fac_'\+owner\.id\]/.test(src));
check('Wappen wird im Knoten ausgegeben', /\$\{factionRing\}\$\{ownerWappen\}/.test(src));
// Der Ring darf die Fläche nicht doppeln: keine Füllung mehr.
check('Territoriumsring ist nicht mehr gefüllt',
  !/fill="\$\{owner\.color\}14"/.test(src));

ende();
