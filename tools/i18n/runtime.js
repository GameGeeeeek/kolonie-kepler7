/* English mode: presentation only. No remote translation service. */
const K7_TRANSLATIONS = /* K7_CATALOG */{};
const K7_TRANSLATION_PATTERNS = [
  [/^Benötigt (.+)$/, requirement => 'Requires ' + k7InlineTranslation(requirement)],
  [/^Benötigt: (.+)$/, requirement => 'Requires: ' + k7InlineTranslation(requirement)],
  [/^Requires: (.+)$/, requirement => 'Requires: ' + k7InlineTranslation(requirement)],
  [/^(.+) Stufe (\d+)$/, (name, level) => k7InlineTranslation(name) + ' level ' + level],
  [/^(.+) \(Stufe (\d+)\)$/, (name, level) => k7InlineTranslation(name) + ' (level ' + level + ')'],
  [/^(Trümmerfeld|Kristallgürtel|Ödwelt) (.+)$/, (type, name) => k7InlineTranslation(type) + ' ' + name],
  [/^(.+) Prestige-Stufe (\d+)(.*)$/, (prefix, level, suffix) => k7InlineTranslation(prefix) + ' prestige level ' + level + k7InlineTranslation(suffix)],
  [/^(\d+) Schiffe · (\d+) (.+)$/, (ships, count, type) => ships + ' ships - ' + count + ' ' + k7InlineTranslation(type)],
  [/^(.+)\/s \(Lager voll\)$/, rate => rate + '/s (storage full)'],
  [/^(\d+) Fähigkeitspunkt investieren \((\d+)\/(\d+)\)$/, (count, done, total) => count + ' skill point' + (count === '1' ? '' : 's') + ' invested (' + done + '/' + total + ')'],
  [/^(\d+) Handel am Markt abschließen \((\d+)\/(\d+)\)$/, (count, done, total) => count + ' market trade completed (' + done + '/' + total + ')'],
  [/^(\d+) Forschung abschließen \((\d+)\/(\d+)\)$/, (count, done, total) => count + ' research project completed (' + done + '/' + total + ')'],
  [/^(\d+)\/(\d+) AUFTRÄGE$/, (used, total) => used + '/' + total + ' ORDERS'],
  [/^Signatur (.+) · (.+) Stück · (.+) Energie\/s$/, (signature, amount, energy) => 'Signature ' + signature + ' - ' + amount + ' units - ' + energy + ' energy/s'],
  [/^verfügbar: (.+) von (.+) · Angriffspunkte je Schiff: (.+) · Signatur (.+)$/, (available, total, attack, signature) => 'available: ' + available + ' of ' + total + ' - attack points per ship: ' + attack + ' - signature ' + signature],
  [/^(.+) · (.+) Flugzeit · (.+) Treibstoff$/, (name, time, fuel) => k7InlineTranslation(name) + ' - ' + time + ' flight time - ' + fuel + ' fuel'],
  [/^(.+) · (.+) · läuft$/, (name, progress) => k7InlineTranslation(name) + ' - ' + progress + ' - running'],
  [/^Bau-Wunschliste ist leer – \u201e(.+)" wäre gerade bezahlbar\.$/, name => 'Build wishlist is empty - "' + k7InlineTranslation(name) + '" is affordable right now.'],
  [/^Keine Schiffe im Bau – \u201e(.+)" wäre gerade bezahlbar\.$/, name => 'No ships are being built - "' + k7InlineTranslation(name) + '" is affordable right now.'],
  [/^Keine Forschung läuft – \u201e(.+)" wäre gerade bezahlbar\.$/, name => 'No research is running - "' + k7InlineTranslation(name) + '" is affordable right now.'],
  [/^Talentwahl offen: (.+) wartet auf eine Ausrichtung\.$/, name => 'Talent choice open: ' + k7InlineTranslation(name) + ' is waiting for a specialization.'],
  [/^(\d+) Offiziere warten auf ihre Talentwahl\.$/, count => count + ' officers are waiting for talent choices.'],
  [/^(\d+) Fähigkeitspunkt(e?) nicht verteilt\.$/, count => count + ' unspent skill point' + (count === '1' ? '' : 's') + '.'],
  [/^Wochenangebot noch ungenutzt: (.+)\.$/, name => 'Weekly offer still unused: ' + k7InlineTranslation(name) + '.'],
  [/^· (\d+) Lager voll$/, count => '- ' + count + ' storage full'],
  [/^· (\d+) gedrosselt$/, count => '- ' + count + ' throttled']
];
const K7_LANGUAGE_KEY = 'kepler7-ui-language';
const K7_LANGUAGE = (() => {
  let language;
  try { language = new URLSearchParams(location.search).get('lang'); } catch (_) {}
  if (language !== 'de' && language !== 'en') {
    try { language = localStorage.getItem(K7_LANGUAGE_KEY); } catch (_) {}
  }
  return language === 'en' ? 'en' : 'de';
})();
const K7_DEFINITION_OBJECTS = new WeakSet();
function k7t(text) {
  if (K7_LANGUAGE !== 'en') return text;
  const source = String(text);
  if (Object.prototype.hasOwnProperty.call(K7_TRANSLATIONS, source)) return K7_TRANSLATIONS[source];
  for (const [pattern, replacement] of K7_TRANSLATION_PATTERNS) {
    const match = source.match(pattern);
    if (!match) continue;
    return typeof replacement === 'function' ? replacement(...match.slice(1)) : source.replace(pattern, replacement);
  }
  return text;
}
function k7InlineTranslation(text) {
  let value = k7t(text);
  if (value !== text) return value;
  value = String(text);
  value = value.replace(/\b(Erz|Kristalle|Deuterium|Energie|Forschungspunkte|Kredite|KI-Kerne|Antimaterie|Protomaterie)\b/g, term => k7t(term));
  return [
    [' Stufe ', ' level '],
    ['Fähigkeitspunkte', 'skill points'],
    ['Fähigkeitspunkt', 'skill point'],
    ['Forschungs', 'research'],
    ['Forschung', 'research'],
    ['Schiffe', 'ships'],
    ['Schiff', 'ship'],
    ['Kreuzer', 'cruisers'],
    ['Allianz', 'alliance'],
    ['Allianzen', 'alliances'],
    ['Kolonien', 'colonies'],
    ['Kolonie', 'colony'],
    ['Spenden', 'donations'],
    ['Gebäude', 'buildings'],
    ['Ressourcen', 'resources'],
    ['Rohstoffe', 'resources'],
    ['Treibstoff', 'fuel'],
    ['Flugzeit', 'flight time'],
    ['Trümmerfeld', 'Debris field'],
    ['Kristallgürtel', 'Crystal belt'],
    ['Ödwelt', 'Barren world'],
    ['Wasserwelt', 'Ocean world'],
    ['Schmugglernest', 'Smuggler nest'],
    ['Jäger', 'Fighters'],
    ['Wächter', 'Guardians']
  ].reduce((result, [from, to]) => result.split(from).join(to), value);
}
function k7h(text) {
  return String(k7t(text)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function k7RegisterDefinitions(value) {
  if (!value || typeof value !== 'object' || K7_DEFINITION_OBJECTS.has(value)) return;
  K7_DEFINITION_OBJECTS.add(value);
  Object.values(value).forEach(k7RegisterDefinitions);
}
const K7_DISPLAY_FIELDS = new Set(['name', 'label', 'title', 'desc', 'effectDesc', 'nicheDesc', 'text', 'hint', 'body']);
const K7_DEFINITION_VIEWS = new WeakMap();
function k7View(object) {
  // A presentation-only view. Saved/player-owned objects retain both identity and values.
  if (K7_LANGUAGE !== 'en' || !object || !K7_DEFINITION_OBJECTS.has(object)) return object;
  if (K7_DEFINITION_VIEWS.has(object)) return K7_DEFINITION_VIEWS.get(object);
  const view = new Proxy(object, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'string' || !K7_DISPLAY_FIELDS.has(key)) return value;
      // Respect Proxy invariants for any future frozen definition properties.
      const property = Object.getOwnPropertyDescriptor(target, key);
      if (property && property.configurable === false && property.writable === false) return value;
      return k7t(value);
    }
  });
  K7_DEFINITION_VIEWS.set(object, view);
  return view;
}
const K7_TRANSLATE_SKIP_SELECTOR = 'script,style,textarea,code,pre,[translate="no"],[contenteditable="true"]';
function k7LooksLikeUiPhrase(key) {
  return /[\s:().,;!?·–—"\u201e\/-]/.test(key) || /[ÄÖÜäöüß]/.test(key);
}
function k7TranslateWrappedText(source, conservative) {
  const key = String(source).trim();
  if (!key) return source;
  if (conservative && !k7LooksLikeUiPhrase(key)) return source;
  const translated = k7t(key);
  if (translated === key) return source;
  const start = String(source).indexOf(key);
  return String(source).slice(0, start) + translated + String(source).slice(start + key.length);
}
function k7TranslateTextNode(node, conservative = true) {
  if (!node || !node.parentElement || node.parentElement.closest(K7_TRANSLATE_SKIP_SELECTOR)) return;
  const translated = k7TranslateWrappedText(node.nodeValue, conservative);
  if (translated !== node.nodeValue) node.nodeValue = translated;
}
function k7TranslateElementAttributes(element, conservative = true) {
  if (!element || element.closest(K7_TRANSLATE_SKIP_SELECTOR)) return;
  ['title', 'placeholder', 'aria-label', 'alt'].forEach(attr => {
    if (!element.hasAttribute(attr)) return;
    const translated = k7TranslateWrappedText(element.getAttribute(attr), conservative);
    if (translated !== element.getAttribute(attr)) element.setAttribute(attr, translated);
  });
}
function k7TranslateSubtree(root, conservative = true) {
  if (K7_LANGUAGE !== 'en' || !root) return;
  if (root.nodeType === Node.TEXT_NODE) { k7TranslateTextNode(root, conservative); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.matches(K7_TRANSLATE_SKIP_SELECTOR)) return;
    k7TranslateElementAttributes(root, conservative);
  }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text;
  while ((text = walk.nextNode())) k7TranslateTextNode(text, conservative);
  const elements = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder],[aria-label],[alt]') : [];
  elements.forEach(element => k7TranslateElementAttributes(element, conservative));
}
function k7StartDynamicTranslation() {
  if (K7_LANGUAGE !== 'en' || typeof MutationObserver === 'undefined' || !document.body) return;
  k7TranslateSubtree(document.body, false);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') k7TranslateTextNode(record.target, true);
      else if (record.type === 'attributes') k7TranslateElementAttributes(record.target, true);
      else record.addedNodes.forEach(node => k7TranslateSubtree(node, true));
    }
  });
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','placeholder','aria-label','alt']});
}
let k7SwitchBusy = false;
async function k7SwitchLanguage(language) {
  if (k7SwitchBusy || !['de', 'en'].includes(language) || language === K7_LANGUAGE) return;
  k7SwitchBusy = true;
  const selectors = document.querySelectorAll('[data-k7-language]');
  selectors.forEach(el => { el.disabled = true; });
  try {
    // The existing save-before-navigation helper preserves the current game's save semantics.
    if (typeof bootDataReady !== 'undefined' && bootDataReady) await sicherSpeichern();
    try { localStorage.setItem(K7_LANGUAGE_KEY, language); } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    location.assign(url.href);
  } catch (error) {
    k7SwitchBusy = false;
    selectors.forEach(el => { el.disabled = false; el.value = K7_LANGUAGE; });
    console.error('Language switch failed', error);
  }
}
function k7InitialStaticText() {
  // Called once, synchronously, BEFORE authentication, saves, chat or other user data is loaded.
  if (K7_LANGUAGE === 'en') {
    document.documentElement.lang = 'en';
    k7StartDynamicTranslation();
    document.title = 'Kepler-7 Colony — Space Strategy in Your Browser';
  }
  ['.ll-actions', '.resetrow'].forEach(selector => {
    const host = document.querySelector(selector);
    if (!host) return;
    const label = document.createElement('label');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;max-width:100%;';
    label.append(document.createTextNode(K7_LANGUAGE === 'en' ? 'Language' : 'Sprache'));
    const select = document.createElement('select');
    select.dataset.k7Language = '';
    select.setAttribute('aria-label', 'Sprache / Language');
    select.style.cssText = 'width:auto;max-width:180px;margin:0;';
    [['de', 'Deutsch'], ['en', 'English']].forEach(([value, name]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option);
    });
    select.value = K7_LANGUAGE;
    select.addEventListener('change', () => k7SwitchLanguage(select.value));
    label.append(select); host.append(label);
  });
  if (K7_LANGUAGE === 'en') {
    const host = document.querySelector('.resetrow');
    if (host) {
      const note = document.createElement('small');
      note.dataset.k7PreviewNotice = '';
      note.textContent = 'English mode is active.';
      host.append(note);
    }
  }
}
k7InitialStaticText();
