// Isolierte Rechentests brauchen dieselben Sprachfunktionen wie das Spiel.
// Keine Passthrough-Kopien: insbesondere k7h muss weiterhin HTML escapen.
// Browser-/Sprachtests laden weiterhin das ganze Spiel und benutzen diesen Helfer nicht.
function i18nQuelle(source) {
  const dictionary = source.indexOf('const K7_TRANSLATIONS = ');
  const language = source.indexOf('const K7_LANGUAGE_KEY = ');
  const start = language >= 0 && language < dictionary ? language : dictionary;
  const end = source.indexOf('const K7_TRANSLATE_SKIP_SELECTOR = ', dictionary);
  if (dictionary < 0 || start < 0 || end <= start) throw new Error('i18n-Quelltextanker fehlen');
  let code = source.slice(start, end);
  const external = /const K7_TRANSLATIONS = K7_LANGUAGE === "en" \? await k7LoadEnglishCatalogue\("(kepler-english\.json\?v=[a-f0-9]{16})"\) : \{\};/;
  if (external.test(code)) {
    // Pure calculation tests consume the same checked-in data. Browser tests
    // separately exercise the actual optional HTTP loader and its error paths.
    const fs = require('node:fs'), path = require('node:path');
    const catalogue = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../kepler-english.json'),'utf8'));
    code = code.replace(external,()=> 'const K7_TRANSLATIONS = '+JSON.stringify(catalogue)+';');
  }
  return code;
}

function i18nKontext(source, language = 'de') {
  if (!['de', 'en'].includes(language)) throw new Error('Unbekannte Testsprache');
  return new Function('location', 'localStorage', i18nQuelle(source) +
    '\nreturn { K7_LANGUAGE, k7t, k7h, k7View, k7RegisterDefinitions, k7InlineTranslation };')(
    { search: '?lang=' + language }, { getItem: () => language });
}

function i18nFunction(source, ...args) {
  const context = i18nKontext(source);
  return new Function(...Object.keys(context), ...args).bind(null, ...Object.values(context));
}

// Fuer Quelltext-Scans nach Live-Anzeigestellen: das Woerterbuch ist keine Anzeigestelle.
function ohneI18nWoerterbuch(source) {
  const start = source.indexOf('const K7_TRANSLATIONS = ');
  const oldEnd = source.indexOf('const K7_LANGUAGE_KEY = ', start);
  const end = oldEnd >= 0 ? oldEnd : source.indexOf('const K7_TRANSLATION_PATTERNS = ',start);
  if (start < 0 || end <= start) throw new Error('i18n-Woerterbuchanker fehlen');
  return source.slice(0, start) + source.slice(end);
}

module.exports = { i18nQuelle, i18nKontext, i18nFunction, ohneI18nWoerterbuch };
