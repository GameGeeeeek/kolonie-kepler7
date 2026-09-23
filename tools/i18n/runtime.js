/* English preview: presentation only. No remote translation service and no DOM observer. */
const K7_TRANSLATIONS = /* K7_CATALOG */{};
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
  return K7_LANGUAGE === 'en' && Object.prototype.hasOwnProperty.call(K7_TRANSLATIONS, text)
    ? K7_TRANSLATIONS[text] : text;
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
const K7_DISPLAY_FIELDS = new Set(['name', 'label', 'title', 'desc', 'effectDesc', 'nicheDesc', 'text', 'hint']);
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
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walk.nextNode())) {
      if (!text.parentElement || text.parentElement.closest('script,style,textarea,code,pre,[translate="no"]')) continue;
      const source = text.nodeValue, key = source.trim();
      if (key && Object.prototype.hasOwnProperty.call(K7_TRANSLATIONS, key)) {
        text.nodeValue = source.slice(0, source.indexOf(key)) + k7t(key) + source.slice(source.indexOf(key) + key.length);
      }
    }
    document.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(el => {
      if (el.closest('script,style,[translate="no"]')) return;
      ['title', 'placeholder', 'aria-label', 'alt'].forEach(attr => {
        if (el.hasAttribute(attr)) el.setAttribute(attr, k7t(el.getAttribute(attr)));
      });
    });
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
    [['de', 'Deutsch'], ['en', 'English (preview)']].forEach(([value, name]) => {
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
      note.textContent = 'English preview: some descriptions and messages are still in German.';
      host.append(note);
    }
  }
}
k7InitialStaticText();
