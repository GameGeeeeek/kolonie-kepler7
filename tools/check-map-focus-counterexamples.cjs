'use strict';
// Controlled native-map regressions over the repository's isolated HTTP wrapper.
// Optional case names select a subset; every case must exit 1 for exactly its intended guards.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const labels = {
  boot: '0-vorab: Boot ohne Skriptfehler',
  background: '0-vorab: dunkler Kartenhintergrund folgt dem Kommandovertrag',
  regionReady: '1-vorab: ein Regionsknoten ist da und nimmt den Fokus',
  region: '1: der Fokusring der Region ist explizit gesetzt und auf dunklem Grund sichtbar',
  pixels: '1b: und er wird wirklich gemalt (Pixel ändern sich)',
  systemReady: '2-vorab: ein Systemknoten ist da und nimmt den Fokus',
  system: '2: der Fokusring des Systemknotens ist explizit gesetzt und sichtbar',
  levelReady: '3-vorab: ein Ebenen-Knopf ist da und nimmt den Fokus',
  level: '3: der Fokusring des Ebenen-Knopfes ist explizit gesetzt und sichtbar',
  keyboard: '4: mit Tab erreicht man einen Kartenknoten, und der Ring ist dort sichtbar',
  mouseReady: '5-vorab: ein Systemknoten ist anklickbar',
  mouse: '5: nach einem Mausklick steht kein Fokusring auf der Karte',
  script: '6: bis hierher keine Skriptfehler'
};
const allLabels = Object.values(labels);
const focusLabels = [labels.region, labels.system, labels.level, labels.keyboard];
const cases = [
  ['shell-light', [labels.background]],
  ['shell-transparent', [labels.background]],
  ['map-white', [labels.background]],
  ['ring-dark', focusLabels],
  ['ring-none', [labels.region, labels.pixels, labels.system, labels.level, labels.keyboard]],
  ['ring-auto', focusLabels]
];
const requested = process.argv.slice(2);
if (new Set(requested).size !== requested.length || requested.some(name => !cases.some(c => c[0] === name))) {
  throw Error('Use distinct controlled case names: ' + cases.map(c => c[0]).join(', '));
}
for (const [fault, expected] of cases.filter(c => !requested.length || requested.includes(c[0]))) {
  const result = spawnSync(process.execPath, ['tests/http-run.js', 'test_kartenfokus.js'], {
    cwd: root,
    // The wrapper supplies its own HTTP origin. Do not allow an inherited alternate test URL.
    env: { ...process.env, KEPLER_TESTDATEI: '', K7_MAP_FOCUS_FAULT: fault },
    encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024
  });
  const output = (result.stdout || '') + (result.stderr || '');
  const lines = output.split(/\r?\n/);
  const records = lines.flatMap(line => {
    const m = /^(OK|FAIL)\s+- (.*?)(?: \| .*)?$/.exec(line);
    return m ? [{ status: m[1], label: m[2] }] : [];
  });
  const failures = records.filter(record => record.status === 'FAIL');
  const complete = records.length === allLabels.length
    && new Set(records.map(record => record.label)).size === allLabels.length
    && records.every(record => allLabels.includes(record.label));
  const exactFailures = failures.length === expected.length
    && failures.every(record => expected.includes(record.label))
    && expected.every(label => failures.some(record => record.label === label));
  const surviving = allLabels.filter(label => !expected.includes(label));
  const allOtherGuardsGreen = surviving.every(label => records.some(record => record.label === label && record.status === 'OK'));
  const bootAndScriptGreen = [labels.boot, labels.script].every(label => records.some(record => record.label === label && record.status === 'OK'));
  if (result.error || result.signal || result.status !== 1 || (result.stderr || '').trim()
      || !complete || !exactFailures || !allOtherGuardsGreen || !bootAndScriptGreen || !lines.includes('FAIL')) {
    console.error(output);
    throw Error(fault + ': expected exit 1, all 13 native guards, exactly the intended failed labels, and green boot/final JavaScript guards; exit ' + result.status);
  }
  console.log('OK - ' + fault + ' rejects only its intended regression (' + failures.length + ' guards); all other native guards stay green');
}
