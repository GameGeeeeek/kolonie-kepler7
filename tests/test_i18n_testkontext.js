const assert = require('assert/strict');
const fs = require('fs');
const { SPIELDATEI } = require('./lib/spieldatei');
const { i18nKontext, i18nFunction, ohneI18nWoerterbuch } = require('./lib/i18n');
const source = fs.readFileSync(SPIELDATEI, 'utf8');
const de = i18nKontext(source);
const en = i18nKontext(source, 'en');
assert.equal(de.K7_LANGUAGE, 'de');
assert.equal(en.K7_LANGUAGE, 'en');
assert.equal(de.k7t('Werft'), 'Werft');
assert.equal(en.k7t('Werft'), 'Shipyard');
assert.equal(de.k7h('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
const definition = { name: 'Werft', count: 3 };
assert.equal(en.k7View(definition), definition);
en.k7RegisterDefinitions([definition]);
assert.equal(en.k7View(definition).name, 'Shipyard');
assert.equal(en.k7View(definition).count, 3);
assert.equal(definition.name, 'Werft');
assert.equal(de.k7View(definition), definition);
assert.equal(i18nFunction(source, 'x', 'return k7h(x);')('<x>'), '&lt;x&gt;');
const without = ohneI18nWoerterbuch(source);
assert.ok(!without.includes('const K7_TRANSLATIONS = '));
assert.ok(!without.includes('const K7_TRANSLATION_PATTERNS = '));
assert.ok(without.includes('function k7h(text)'));
assert.throws(() => i18nKontext(''), /anker fehlen/);
assert.throws(() => ohneI18nWoerterbuch(''), /anker fehlen/);
// Gegenprobe: Der Helfer muss den gelesenen Produktivcode verwenden, keine Kopie.
const broken = source.replace(".replace(/>/g, '&gt;')", ".replace(/>/g, 'KAPUTT')");
assert.notEqual(broken, source);
assert.equal(i18nKontext(broken).k7h('>'), 'KAPUTT');
assert.throws(() => assert.equal(i18nKontext(broken).k7h('>'), '&gt;'));
// Genuine scanner regression: stopping before pattern data would count a
// catalogue matcher as a native display site. The language key moved earlier.
const scanFixture = "const K7_LANGUAGE_KEY = 'de';\nconst K7_TRANSLATIONS = {};\n" +
  "const K7_TRANSLATION_PATTERNS = [/catalogue-only-text/];\n" +
  "const K7_TRANSLATION_CACHE = new Map();\nconst display = 'native-display-text';\n";
assert.ok(!ohneI18nWoerterbuch(scanFixture).includes('catalogue-only-text'));
assert.ok(ohneI18nWoerterbuch(scanFixture).includes('native-display-text'));
const scanner = ohneI18nWoerterbuch.toString();
const boundary = "source.indexOf('const K7_TRANSLATION_CACHE = ',start)";
assert.equal(scanner.split(boundary).length, 2, 'one actual catalogue scan boundary');
const badScanner = new Function('return (' + scanner.replace(boundary,
  "source.indexOf('const K7_TRANSLATION_PATTERNS = ',start)") + ');')();
assert.ok(badScanner(scanFixture).includes('catalogue-only-text'));
assert.throws(() => assert.equal(badScanner(scanFixture).includes('catalogue-only-text'), false));
console.log('PASS - echter i18n-Testkontext: Sprache, Escaping, Ansichten, Anker und Gegenprobe');
