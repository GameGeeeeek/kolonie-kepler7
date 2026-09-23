# English UI preview — not a production release

This work adds a selectable English preview to `weltraum_kolonie.html`. German remains the default. Select **English (preview)** on the landing page or in the settings footer, or open the game with `?lang=en`. `?lang=de` explicitly selects German. The preference is stored separately as `kepler7-ui-language`; it is not part of a saved colony.

## Delivered scope

The initial catalogue contains 1,197 exact translations: landing/authentication text, static navigation and settings, core resource/building/research/ship names, and common actions/errors. This is a count of catalogue entries, **not a percentage or claim that the whole game is translated**. The English UI includes a visible preview notice.

Many longer descriptions, dynamically assembled sentences, server-origin messages, and secondary HTML pages still need localization. Historical patchnotes remain unchanged. Player chat, commander names and player-owned names must never be translated. No backend changes are included.

## Safety and implementation

- No global text replacement, DOM mutation observer, third-party translation request or new runtime dependency.
- Only the initial static DOM is translated before authentication and user data are loaded.
- Dynamic UI output is localized at selected display sites. A WeakSet registers original static definition objects; presentation-only Proxy views translate their display properties without changing the underlying definition, ID or save. Unregistered player objects are returned unchanged. Frozen non-writable properties retain their original values to respect Proxy invariants.
- HTML translations are escaped. Selectors, event handlers, technical keys, comparison operands, tagged templates and historical `PATCHNOTES` literals are excluded by the compiler.
- The language selector uses the existing `sicherSpeichern()` helper before navigating from a loaded game. No new save or network protocol is introduced.
- There is still one game HTML file. Runtime and catalogue are inlined because the Pi deployment currently copies HTML files, not an application bundle.

## Development files

`locales/en.json` is the human-readable German-to-English catalogue. `tools/i18n/runtime.js` is its runtime template. `tools/i18n/build.cjs` uses development-only Acorn/Acorn Walk to find display sites and embed the runtime into the original single-file application. `tools/i18n/test.cjs` tests transformation and runtime invariants. `tests/test_english_locale.js` exercises an isolated mocked origin in Chromium, not the live server.

### Initial reproducible build

This initial preview was compiled from game blob `db881c88728b38dd4ddc005f17caa12dc8eefe0d` (SHA-256 `d2e1a3525a0b657b36022725fc2c7175f90a94281575a52cbda419040bafb24e`). The compiler refuses to stack transformations onto already localized source.

In an isolated working copy containing that original game file:

```sh
npm install --prefix tools/i18n --ignore-scripts
node tools/i18n/build.cjs --check
node --test tools/i18n/test.cjs
node tools/i18n/build.cjs
node tests/run.js --nur-pflicht
node tests/test_english_locale.js
```

The browser test uses the repository's usual Playwright setup and `KEPLER_CHROMIUM` override. `K7_SCREENSHOT_DIR` optionally saves screenshots. `KEPLER_SPIELDATEI` points the test at a counterexample without replacing the working game file. The original German source must fail the English-feature test.

Do **not** restore this old game blob over a newer shared branch to add translations. Further work must reconcile newer game changes and keep the runtime, catalogue and display-site edits together. The present compiler is an initial migration tool, not an automatic production build step.

## Release status and remaining work

This is an unreleased draft. VERSION, version.txt, generated patchnotes and historical patchnotes are untouched. No main merge or Pi deployment is authorized by this change.

Before production release: finish the remaining English text (including composed sentences and server messages), review terminology in context, complete the full repository/browser/backend parity suite, perform an adversarial review, then follow the normal `naechste-version.js` / German release note / `build-patchnotes.js` / `--nummer` process from CLAUDE.md. Targeted localization checks do not replace that full release gate.
