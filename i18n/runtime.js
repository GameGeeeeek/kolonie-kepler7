/* German/English presentation layer. The installer embeds this inside the existing script.
 * Game data, saves, keys, API requests and user content are never translated.
 * No external translation service, DOM prototype patch or document-wide HTML replacement.
 */
(function installKeplerLanguages(catalog) {
  'use strict';
  if (window.KeplerI18n) return;
  const STORAGE_KEY = 'kepler7_ui_language';
  const LANGUAGES = new Set(['de', 'en']);
  const ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt'];
  // Only audited, application-owned render targets accept NEW translated nodes. Everything
  // else must be one of the static text nodes captured before the game starts.
  const DYNAMIC = [
    '#buildings', '#defenseBuildings', '#research', '#researchQueueBox',
    '#researchMilestonesBox', '#researchSprintBox', '#exoticResearchBox', '#allianceResearch',
    '#fleet', '#fleetJobs', '#defenseJobs', '#shipBasketBox', '#resbar',
    '#moduleBox', '#shipModuleBox', '#inventoryBox', '#buffsBox', '#rareItemsBox',
    '#achievementsList', '#skillTreeBox', '#dailyQuestBar', '#dailyLoginBox',
    '#comebackQuestBox', '#tutorialTitle', '#tutorialText', '#tutorialStepLabel',
    '#tutorialNextBtn', '#tutorialBackBtn', '#loginModal', '#loginError', '#loginInfo',
    '#themePicker', '#log', '#toastContainer', '.tab-btn', '.header-btn-label',
    '#soundStateLabel', '#notifStateLabel', '#powerSaveStateLabel'
  ].join(',');
  const RAW = [
    'script', 'style', 'noscript', 'textarea', 'code', 'pre', '[translate="no"]',
    '[data-i18n-skip]', '[contenteditable]:not([contenteditable="false"])',
    '#profileNameDisplay', '#profileModalName', '#profileModalAvatar', '#avatarInitials',
    '.dash-colony-name-text', '.fp-lb-name', '.planet-label',
    '#chatPanelGlobalBox', '#chatPanelAllianceBox', '#messagesBox',
    '#allianceDescriptionDisplay', '#adminFeedbackList', '#adminReportsList'
  ].join(',');
  const staticText = new WeakSet();
  const staticElements = new WeakSet();
  const originals = new WeakMap();
  const attributeOriginals = new WeakMap();
  const missing = new Set();
  const stats = { visits: 0, writes: 0, batches: 0 };
  let language = 'de';
  let observer = null;
  let started = false;
  let storageFailed = false;
  const controls = [];
  const normalize = value => String(value).replace(/\s+/g, ' ').trim().split(String.fromCharCode(8220)).join('"');
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.has(stored)) language = stored;
  } catch (_) { /* Private browsing may disallow storage; switching still works this session. */ }
  const translations = new Map(catalog.entries);
  const patterns = (catalog.patterns || []).map(([source, target]) => {
    const slots = [];
    const escaped = source.split(/(\{\d+\})/).map(part => {
      if (/^\{\d+\}$/.test(part)) { slots.push(part); return '([0-9][0-9.,\\s]*?)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { regex: new RegExp('^' + escaped + '$'), target, slots };
  });
  function translate(value, locale = language) {
    if (locale !== 'en' || typeof value !== 'string' || !value.trim()) return value;
    const key = normalize(value);
    let result = translations.get(key);
    if (result === undefined && key.length <= 500) {
      for (const pattern of patterns) {
        const match = pattern.regex.exec(key);
        if (!match) continue;
        result = pattern.target.replace(/\{\d+\}/g, slot => {
          const index = pattern.slots.indexOf(slot);
          return index < 0 ? slot : match[index + 1];
        });
        break;
      }
    }
    if (result === undefined) return value;
    return (value.match(/^\s*/) || [''])[0] + result + (value.match(/\s*$/) || [''])[0];
  }
  function excluded(element) {
    return !element || !!element.closest(RAW);
  }
  function eligibleText(node, parent) {
    if (excluded(parent)) return false;
    // Option labels can be names of player-owned locations; never infer their provenance.
    if (parent.closest('option') && !staticText.has(node)) return false;
    return staticText.has(node) || !!parent.closest(DYNAMIC);
  }
  function applyText(node) {
    const parent = node.parentElement;
    if (!eligibleText(node, parent)) return;
    stats.visits++;
    const current = node.nodeValue;
    const previous = originals.get(node);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = translate(source);
    originals.set(node, { source, rendered });
    if (current !== rendered) { node.nodeValue = rendered; stats.writes++; }
    if (language === 'en' && rendered === source && /[A-Za-zÄÖÜäöüß]/.test(source) && missing.size < 1000) {
      // Diagnostic values never leave the browser, and only audited application text is collected.
      missing.add(normalize(source));
    }
  }
  function applyAttributes(element) {
    if (excluded(element)) return;
    if (!staticElements.has(element) && !element.closest(DYNAMIC)) return;
    let records = attributeOriginals.get(element);
    if (!records) { records = Object.create(null); attributeOriginals.set(element, records); }
    for (const name of ATTRIBUTES) {
      if (!element.hasAttribute(name)) { delete records[name]; continue; }
      const current = element.getAttribute(name);
      const previous = records[name];
      const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = translate(source);
      records[name] = { source, rendered };
      if (current !== rendered) { element.setAttribute(name, rendered); stats.writes++; }
    }
  }
  function visit(root, capture = false) {
    if (!root || (root !== document.body && !root.isConnected)) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (capture) staticText.add(root);
      else applyText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || excluded(root)) return;
    function element(el) {
      if (capture) staticElements.add(el);
      else applyAttributes(el);
    }
    element(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && excluded(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.ELEMENT_NODE) element(node);
      else if (capture) staticText.add(node);
      else applyText(node);
    }
  }
  function observe() {
    if (language === 'en') observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRIBUTES
    });
  }
  function updateControls() {
    for (const select of controls) select.value = language;
    const notice = document.getElementById('keplerLanguageNotice');
    if (notice) notice.textContent = language === 'en'
      ? 'English beta: detailed texts not yet in the catalog stay in German. Player messages and custom names are not translated.'
      : 'Die Sprache wird auf diesem Gerät gespeichert. Englisch ist eine Beta: noch nicht übersetzte Detailtexte bleiben auf Deutsch.';
    const warning = document.getElementById('keplerLanguageStorage');
    if (warning) {
      warning.hidden = !storageFailed;
      warning.textContent = language === 'en'
        ? 'Your browser blocked saving the language. This choice applies to this tab only.'
        : 'Dein Browser blockiert das Speichern der Sprache. Die Auswahl gilt nur in diesem Tab.';
    }
  }
  function setLanguage(next, persist = true) {
    if (!LANGUAGES.has(next)) return false;
    language = next;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); storageFailed = false; }
      catch (_) { storageFailed = true; }
    }
    if (!started) return true;
    observer.disconnect();
    missing.clear();
    document.documentElement.lang = language;
    visit(document.body);
    const title = document.querySelector('title');
    if (title) {
      const old = originals.get(title);
      const source = old && title.textContent === old.rendered ? old.source : title.textContent;
      const rendered = translate(source);
      originals.set(title, { source, rendered });
      if (title.textContent !== rendered) title.textContent = rendered;
    }
    updateControls();
    observe();
    document.dispatchEvent(new CustomEvent('kepler-language-change', { detail: { language } }));
    return true;
  }
  function addControl(parent, id) {
    if (!parent || document.getElementById(id)) return;
    const label = document.createElement('label');
    label.className = 'kepler-language-control';
    label.setAttribute('translate', 'no');
    const caption = document.createElement('span');
    caption.textContent = 'DE / EN';
    caption.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.id = id;
    select.setAttribute('aria-label', 'Sprache / Language');
    for (const [value, text] of [['de', 'Deutsch'], ['en', 'English']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = text; select.appendChild(option);
    }
    select.value = language;
    select.addEventListener('change', () => setLanguage(select.value));
    label.append(caption, select); parent.appendChild(label); controls.push(select);
  }
  function start() {
    if (started || !document.body) return;
    // This runs before the game IIFE, when all initial text still belongs to the HTML source.
    visit(document.body, true);
    const style = document.createElement('style');
    style.id = 'keplerLanguageStyles';
    style.textContent = '.kepler-language-control{display:inline-flex;align-items:center;gap:5px;font-size:11px;white-space:nowrap}.kepler-language-control select{width:auto;min-width:92px;max-width:125px;min-height:32px;padding:4px 6px;font:inherit;color:inherit;background:var(--elev-1,#101526);border:1px solid rgba(255,255,255,.25)}.kepler-language-control select:focus-visible{outline:2px solid #c3bef5;outline-offset:2px}#keplerLanguageSettings{margin-bottom:16px}#keplerLanguageNotice,#keplerLanguageStorage{max-width:70ch;margin:7px 0;font-size:12px;line-height:1.5;color:#b8bdd1}@media(max-width:700px){.kepler-language-control select{min-height:44px}.hero-actions .kepler-language-control>span,.ll-topbar .kepler-language-control>span{display:none}.ll-topbar{flex-wrap:wrap}.ll-topbar .kepler-language-control{margin-left:auto}}';
    document.head.appendChild(style);
    addControl(document.querySelector('#loginOverlay .ll-topbar'), 'keplerLanguageLogin');
    addControl(document.querySelector('.hero-actions'), 'keplerLanguageHeader');
    const settings = document.getElementById('tab-einstellungen');
    if (settings) {
      const box = document.createElement('section');
      box.id = 'keplerLanguageSettings'; box.setAttribute('translate', 'no');
      const heading = document.createElement('h2'); heading.className = 'section-title';
      heading.textContent = 'Sprache / Language';
      const notice = document.createElement('p'); notice.id = 'keplerLanguageNotice';
      const warning = document.createElement('p'); warning.id = 'keplerLanguageStorage';
      warning.setAttribute('role', 'status'); warning.hidden = true;
      box.appendChild(heading); addControl(box, 'keplerLanguageSettingsSelect');
      box.append(notice, warning); settings.prepend(box);
    }
    observer = new MutationObserver(records => {
      stats.batches++;
      const roots = new Set();
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) roots.add(node);
        else roots.add(record.target);
      }
      // Synchronous, before paint; temporarily disconnect to avoid observing our own edits.
      // Unrelated subtrees are not rescanned on every game tick.
      observer.disconnect();
      try {
        for (const root of roots) {
          let parent = root.parentNode;
          while (parent && !roots.has(parent)) parent = parent.parentNode;
          if (!parent) visit(root);
        }
      } finally { observe(); }
    });
    started = true;
    setLanguage(language, false);
  }
  window.KeplerI18n = Object.freeze({
    get language() { return language; },
    get locale() { return language === 'en' ? 'en-GB' : 'de-DE'; },
    t: translate, setLanguage,
    diagnostics: () => ({ ...stats, catalogEntries: translations.size, untranslated: Array.from(missing) })
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY && LANGUAGES.has(event.newValue)) setLanguage(event.newValue, false);
  });
  start();
})(KEPLER_LANGUAGE_CATALOG);
