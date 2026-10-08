# Kepler 7 graphics integration — visual QA

## Visual truth and comparison method

Approved source images: `../analyse-2026-10-07/10-entwurf-kolonie.png`,
`11-entwurf-sternenkarte.png`, and `12-entwurf-orbitalwerft.png`.
These are art-direction concepts for the existing game. The implementation retains all
13 navigation tabs, live game data, existing queues and existing action handlers.
It does not replace the game with the concepts' simplified five-tab interface.

Desktop source pixels and implementation CSS viewport: 1487 × 1058, density 1.
Screenshots capture the page without browser chrome. Full captures are placed in equal-width
panels on the comparison board; focused inspector crops are shown at source pixel scale.
The comparison board contains both source and actual browser-rendered implementation in the
same image. Fixtures use an isolated local API, never a production player account.

| View | State | Actual capture | Combined full-view and focused comparison |
| --- | --- | --- | --- |
| Colony | Developed home colony, ore mine level 22 selected | [16](docs/graphics-review/16-kolonie-final.jpg) | [19](docs/graphics-review/19-qa-kolonie-vergleich.jpg) |
| Shipyard | Cruiser selected, actual count and costs | [17](docs/graphics-review/17-werft-final.jpg) | [20](docs/graphics-review/20-qa-werft-vergleich.jpg) |
| System map | Kepler open, explored owned Rhea selected | [18](docs/graphics-review/18-karte-final.jpg) | [21](docs/graphics-review/21-qa-karte-vergleich.jpg) |

Mobile CSS viewport: 390 × 844, density 1. Verified after reload following the viewport change.
Evidence: [colony](docs/graphics-review/22-kolonie-mobil.jpg),
[shipyard](docs/graphics-review/23-werft-mobil.jpg),
[planet actions](docs/graphics-review/24-karte-mobil.jpg), and
[English shipyard](docs/graphics-review/25-werft-englisch.jpg).

## Findings and comparison history

- Fixed P2: the first ship inspector used two stat columns, causing text/bars to collide.
  It now uses four single-column rows with visible numeric values. Post-fix evidence: 17 and 20.
- Fixed P2: intrinsic SVG sizing grew the system grid beyond 900px.
  An explicit 480px map track and `min-height:0` keep the entire overview readable.
  On wide, short screens the inspector remains below the original map, retaining its aspect ratio.
  Post-fix evidence: 18 and 21; the existing map-label test passes on 1920 × 700 as well.
- Fixed P2: excessive desktop side margins made the artwork unnecessarily small.
  The expanded game column keeps space for the fleet panel; frame and game column share both
  width and position. Post-fix evidence: 16–18 and the measured desktop alignment check.
- Fixed P2: mobile mine/solar touch areas almost touched and were too small.
  Mobile positions are separated and all four building controls have 44px minimum height.
  Post-fix evidence: 22 and the measured pairwise overlap check.
- Fixed P2: the new planet Actions button initially opened and immediately closed the existing
  menu through the document click handler. It now stops the opening event's propagation.
  Post-fix evidence: 24; Escape closes only the menu and retains the system.
- Fixed P2: English stats, stock labels and temporary role/type views contained German text.
  Explicit presentation translation covers those fields; underlying game definitions remain intact.
  Post-fix evidence: 25 and the English rendering assertion.

Each fix was followed by a fresh browser capture or corresponding behavioral measurement.
The final combined comparisons 19, 20 and 21 have no remaining actionable P0/P1/P2 findings.

## Required fidelity surfaces

- Typography: existing system sans-serif retained, with readable 18–21px headings and 12px
  inspector copy. The concepts use a similar neutral sans-serif; they supply no font specification.
  Desktop inspector wrapping and mobile headings remain inside their panels. Stat labels are small
  by design but paired with values and existing explanatory tooltips.
- Spacing/layout: large illustration, separate inspector and dark framing match the approved
  hierarchy. Ship choice/model/inspector follow the three-region concept. Mobile stacks these
  regions. The existing navigation, briefing, resource bar and queue cards remain accessible.
- Colors/tokens: navy surfaces, violet dusk/nebula, cyan ship engines and teal action/selection
  accents follow the references. Existing resource, stat and disabled-action colors retain their
  game meanings. Keyboard focus is explicit on the new selection controls.
- Image quality: all eleven new landscapes, dock, ships, nebula and supported planet images are
  generated raster assets. Transparent ship/planet edges remain clean on the game background;
  images use contain or controlled cover cropping. No CSS/SVG substitute replaces the approved
  colony or spacecraft imagery. Existing procedural textures remain for planet types for which
  this release has no new illustration.
- Copy/content: labels describe actual selected buildings, ship classes and planet properties.
  Costs, quantity, eligibility and build action come from the existing card controls. Planet names
  remain player-controlled text, safely escaped and preserved in both languages.

## Intentional product constraints and residual differences

- This is a graphical integration into the complete game, not a pixel-for-pixel copy of the
  concept's surrounding shell. A permanent fleet panel and all thirteen tabs are retained.
- Actual colony levels, resources, fleet counts and queues differ from the concept's static data.
  The building inspector prioritizes actual production/cost data instead of the concept's extra
  decorative mine thumbnail. Original queue cards keep their existing progress/cancel behavior.
- Planet positions, sizes, routes, markers and collision layout remain governed by the real map.
  The large illustrated planet appears in the inspector. Vesna remains an asteroid, correcting
  the concept's Earth-like rendering. Unexplored planets do not reveal a fabricated surface.
- The three colony scenes represent economic development stages, not a literal building-by-building
  reconstruction. Additional bespoke art for the remaining ship/planet classes is future scope.

These are expected integration constraints; none hides a persistent control or prevents a task.

## Interaction and accessibility evidence

Actual building upgrade, single ship order, class selection, planet menu, Escape, and opening an
owned colony were verified. Mobile ship purchase produced a real local queue entry and toast.
New controls are native buttons with selection state, keyboard access and visible focus.
Decorative images have empty alt text; meaningful illustrations have descriptive alt text.
Reduced motion is respected when scrolling to the full lists. No added animation loop exists.
The preview's captured error console was empty after the tested interactions.

Twenty-two targeted checks pass. Controlled counterexamples prove that disconnected actions,
immediate menu closure, untranslated stats, misaligned frame, oversized map and mobile hit-area
regressions are rejected. Existing planet texture, map-label and sector-width tests also pass.
The complete repository test run is recorded separately in the pull request before release.

The full regression run exposed a desktop map target regression at 1400px: belt asteroid hit
areas shrank to 22px in the two-column layout. The inspector now stacks below the map until
1480px. The unchanged asteroid target test fails before this CSS correction and passes after it
(26px targets on both tested desktop and mobile, no overlaps, real taps open the menu). Its
regression check and the existing map interaction/resize checks are part of graphics CI.
The inspector layout is applied before the native camera is measured. Wide desktop maps
share a 480px height across their levels. Region labels retain their existing automatic minimum
size. Their desktop check measures visible pixels (at least 9px, no needless enlargement) instead
of requiring fixed SVG units; a 15-unit name would shrink to 6.3px in the compact frame. The existing mobile and flat-window behavior is retained. The native
map size/resize checks and the new initial-aspect and stable-height guards pass.
Seven controlled counterexamples exercise eleven intended faults; failed navigation is restored only
after its assertions so the remaining checks still run. Source-file reads remain file based, while
the test preload redirects actual game navigation to the isolated HTTP server.

## Implementation checklist

- [x] Real assets integrated into all three approved directions.
- [x] Five fidelity surfaces inspected in combined comparison evidence.
- [x] Desktop/mobile presentation and primary interactions verified.
- [x] All identified P0/P1/P2 findings corrected and rechecked.
- [x] Browser error console checked.

final result: passed

### Final map camera verification

The actual game was reopened with a fresh preview origin at 1487 × 1058 after the final camera/layout correction. The system map measures 480px, all planets and native map controls fit, the selected ocean illustration loads, the detail column aligns with the map, and there is no horizontal overflow. Screenshot: `docs/graphics-review/26-karte-kamera-final.png`. The temporary viewport was reset afterward. The baseline font and map-size checks pass; the added desktop-font counterexample fails exactly at 6.3 visible pixels, confirming the 9px readability guard.

### Cross-platform map typography

Chrome on the Linux review runners exposed two existing failures. Running the same checks against release `6550cb2` reproduced the identical five narrow-screen overlaps and 0.85 SVG-unit intersections between asteroid rims and alliance tags. The update separates the complete Pulsar label/hint block by six visible pixels on narrow screens and adds one SVG unit between holder tags and the rim. Font sizes, hint hit areas, region geometry, and all original collision assertions remain intact. Both local typography checks and the 22 graphics checks pass. The actual 360px view was inspected in `docs/graphics-review/27-karte-beschriftung-mobile.png`. The Linux checks run first in graphics CI to confirm the spacing on the originally failing platform.

The detailed Linux measurements also exposed a reference-bucket error in the collision test: centered SVG labels rounded to both `-0.0` and `0.0`, splitting one measured offset into two buckets and falsely reporting a missing reference. Rounded values are normalized numerically before counting; all eight assertions and collision rules remain intact. The original release still fails its own-body collision guard. Diagnostics now include exact object rectangles for missing references. The native placement algorithm retains its original candidates and limits.

Linux verification passed at `56dc8bbb65ac6671013d730c4f4d1d8577478514`: original region-overlap checks, all eight dense-belt collision assertions, 22 graphics checks, and the existing texture, label, hit-area, interaction, focus, resize and map-size checks. Seven controlled counterexamples reject eleven intended faults. GitHub Actions run: `37690262505`, job `113028327188`, conclusion `success`.

### Final HUD consistency and test isolation

The complete suite found four additional issues. New panels and selectors now use the existing
single HUD corner formula and border tokens; keyboard selection has an inset focus ring. The
grouped header retains its original available width while the illustrated main column expands.
The unchanged form-language and header-chip guards pass locally after these corrections.

HTTP fixtures now preserve navigation query/hash values. Service workers default to blocked in
fixture contexts, matching their previous file-origin isolation; explicit worker opt-in remains
available. This prevents worker fetches from bypassing the mocked release HTML. Temporary HTML
copies retain their own documents and receive only whitelisted companion fonts, CSS and images
from the same test origin. The previously failing update-overlay, notification-target and
header-height tests pass without assertion changes.

The final actual views were inspected in `28-kolonie-hud-final.png`, `29-werft-hud-final.png`,
`30-karte-hud-final.png` (1487 × 1058), and `31-kolonie-hud-mobile.png` (390 × 844).
The desktop card cuts and mobile scene/control placement are intact; the viewport override was reset.

### Complete-suite release evidence

All 460 test files were executed against the immutable game/assets at
`e599427c1f10a7dc9e51f7a326f19040d432b8c9` in run `37694408193`.
Partitions 0–6 passed without a failed test; partition 7 found only
`test_bewertungskarte.js`, including its isolated retry. Playwright's worker-blocking
init script itself accessed `navigator.serviceWorker` in the unrelated opaque
rating-card iframe and caused its console-error guard to fail. That fixture now
explicitly retains normal worker settings on its own theme-page server. Its
sandbox, storage, cookie, request-origin and console assertions remain unchanged.
The isolated local retry passed, and Linux run `37696835255`, job `113050530505`,
passed the separate `Sandboxed rating-card regression` step. The production game,
stylesheet, all eleven assets and shared fixture harness are byte-identical
between the full-suite source and this fixture correction (`8a05625668bcc2ad9b7e65ebaac372a85c8a8fe1`).
Only this red file was rechecked, following the repository's isolated-retry rule.

Graphics run `37694413857`, job `113042400066`, passed at the full-suite source:
22 graphics checks, existing targeted guards and all seven controlled
counterexamples (eleven intentionally rejected faults). Ideas run `37694414008`
also passed. Version 8.745.0 and German patchnotes are assigned after this review;
the numbering checks and final PR checks validate the resulting release metadata.

## Whole-game visual harmony — 8 October 2026

The user's approved illustrated v8.746.0 style is the reference for this update.
Fresh captures from this review cover all 13 main tabs, reports, help, settings
and the actual fleet picker. The same native game and local marketing fixture
were used; no production player action was submitted. Captures are stored in
[`harmony-2026-10-08`](docs/graphics-review/harmony-2026-10-08).

Overall visual health: the native cards and illustrated inspectors now share
opaque navy surfaces, technical borders, brighter secondary text and consistent
headings. Category, resource, warning and reward colors keep their meanings.
The existing 23 illustrations, 14 themes, selectable alliance banners, native
dimensions and battle replay remain intact. The catalogue shows unowned items
at readable contrast while retaining the explicit possession badge.

| Reviewed view | Visual finding / resulting behavior | Actual capture |
| --- | --- | --- |
| Basis | Colony inspector and native building cards use the same surface; costs and warning text retain their colors. | [Basis](docs/graphics-review/harmony-2026-10-08/nachher-basis.png) |
| Verteidigung | Fortress controls and inspector follow the shared palette and heading style. | [Defense](docs/graphics-review/harmony-2026-10-08/nachher-verteidigung.png) |
| Forschung | Queue, inspector, prerequisite area and technology links share the console materials. | [Research](docs/graphics-review/harmony-2026-10-08/nachher-forschung.png) |
| Flotte | Status bar, native subtabs, ship list and illustrated inspector are consistent. | [Fleet](docs/graphics-review/harmony-2026-10-08/nachher-flotte-desktop.png) |
| Expedition | Heading, journey area and familiar launch controls match the other illustrated views. | [Expedition](docs/graphics-review/harmony-2026-10-08/nachher-expedition.png) |
| Sektorkarte | Existing sector geometry and map controls retain their layout alongside the common navigation. | [Map](docs/graphics-review/harmony-2026-10-08/nachher-karte.png) |
| Galaxie | NPC cards gain opaque surfaces and clearer secondary labels; combat colors remain distinct. | [Galaxy](docs/graphics-review/harmony-2026-10-08/nachher-galaxie.png) |
| Allianz | Entry cards, subtabs and hero body match; selectable banner artwork remains independent. | [Alliance entry](docs/graphics-review/harmony-2026-10-08/nachher-allianz.png) |
| Offiziere | Portrait cards, module subtabs and descriptions use the common materials. | [Officers](docs/graphics-review/harmony-2026-10-08/nachher-offiziere.png) |
| Markt | Credit/shop cards and explanatory notes match the orbital market illustration. | [Market](docs/graphics-review/harmony-2026-10-08/nachher-markt.png) |
| Punktestand | Breakdown cards, profile panel and section headings follow the same visual hierarchy. | [Score](docs/graphics-review/harmony-2026-10-08/nachher-punkte.png) |
| Fortschritt | Commander and statistics cards no longer show conflicting transparent backgrounds. | [Progress](docs/graphics-review/harmony-2026-10-08/nachher-fortschritt.png) |
| Sammlung | Unknown entries are readable; “noch nicht” continues to distinguish ownership. | [Collection](docs/graphics-review/harmony-2026-10-08/nachher-sammlung.png) |
| Berichte | Empty reports/messages states share text contrast; native refresh action remains available. | [Reports](docs/graphics-review/harmony-2026-10-08/nachher-berichte.png) |
| Hilfe | Category cards and disclosure labels match the common raised surfaces. | [Help](docs/graphics-review/harmony-2026-10-08/nachher-hilfe.png) |
| Einstellungen | Account cards, section headers and existing native preferences retain their hierarchy. | [Settings](docs/graphics-review/harmony-2026-10-08/nachher-einstellungen.png) |
| Flottenwahl | Document-mounted picker receives the same surface and fonts as the main game. | [Fleet dialog](docs/graphics-review/harmony-2026-10-08/nachher-flottendialog.png) |

Before and after progress captures were inspected together at 756 × 884:
[before](docs/graphics-review/harmony-2026-10-08/vorher-fortschritt.png),
[after](docs/graphics-review/harmony-2026-10-08/nachher-fortschritt.png).
Fixture restarts and normal ticks changed some displayed values, so this is a
visual material comparison, not a pixel-identical gameplay-state comparison.
The 390 × 844 [colony](docs/graphics-review/harmony-2026-10-08/nachher-basis-mobile.png)
and [catalogue](docs/graphics-review/harmony-2026-10-08/nachher-sammlung-mobile.png)
were inspected for wrapping and visible controls; the wide fleet view uses
1487 × 1058. The temporary viewport override was reset afterwards.

Confirmed review findings fixed in this change:

- Affordable order pulses, warning tab animation and the selected theme's inline
  shadow could hide keyboard focus. A prioritized inset ring survives clipped
  corners; affordable orders pause their decorative pulse while focused.
  The full suite also exposed delayed subtab feedback: native shadow transitions
  are now disabled during keyboard focus, making the ring appear immediately.
- The fleet picker is attached outside `#game-root`. Its keyboard scope and fonts
  now explicitly match the game. The final picker capture verifies the new font.
- Higher-specificity surface rules could suppress jump-link, close-button and
  officer-card hover feedback. Reduced specificity and an explicit officer hover
  rule preserve the original feedback.
- The catalogue combined row and child opacity, making undiscovered descriptions
  unnecessarily faint. The explicit ownership badge now carries that distinction.

`test_visual_harmony.js` uses the real HTML and stylesheet over HTTP with an
isolated API. It checks native and illustrated surface tokens, actual keyboard
navigation, the body-mounted picker, native theme selection, hover feedback,
collection filtering and all 16 panels at 320, 390, 756 and 1487 pixels.
Native color/shadow transitions are allowed to settle before exact measurements.
Nine independently injected CSS faults must fail their named assertions;
the source files are never modified by those counterexamples.

Limits: alliance entry and empty server-backed reports/market states were visible
in the preview; this does not establish live alliance transactions or market
prices. Existing automated behavior checks cover the preserved game flows.
Screenshots and keyboard checks are not a comprehensive accessibility certification.
Final immutable-source test and release evidence is recorded below after completion.

### Complete colony and defense catalogue

The illustrated home base now exposes all 29 native economic buildings, and the
fortress exposes all 23 native defense installations. These are always expanded
grids, with the existing building models, translated names, selected-location
levels and explicit research/item/moon restrictions. Finished entries remain in
this overview when the native detailed list's completed-building filter is on.
Original game cards remain authoritative for costs, quantities and build actions.

Desktop evidence: [all buildings](docs/graphics-review/harmony-2026-10-08/nachher-alle-gebaeude.png)
and [all defenses](docs/graphics-review/harmony-2026-10-08/nachher-alle-verteidigung.png).
The [390px catalogue](docs/graphics-review/harmony-2026-10-08/nachher-alle-gebaeude-mobile.png)
wraps into two columns. Selecting the last building, Botschaftsviertel, was also
visually verified to bring its [native details and order](docs/graphics-review/harmony-2026-10-08/nachher-gebaeude-auswahl-mobile.png)
into view, below the sticky navigation. The temporary viewport is reset after QA.

Independent review found that leaving focus on a distant selected tile hid the
updated inspector several screens above it. Selection now moves keyboard focus
to the new detail heading and brings the inspector into view immediately, using
the native measured sticky-navigation offset. Regression checks cover this on
320, 390, 756 and 1487px layouts and observe the actual visible result. Controlled faults
remove a catalogue entry, its focus transfer and its scroll action independently.

Final immutable-source review: [run 37829077257](https://github.com/GameGeeeeek/kolonie-kepler7/actions/runs/37829077257)
passed all eight isolated partitions on `083a9a4bc6a77609b2b9154c6685560797c35929`:
462 test files, 518 aggregate checks including each partition's required checks,
zero failures. HTML, graphics stylesheet, all 23 images and the pinned backend
source passed the before/after SHA-256 freeze verification in every partition.
[Targeted graphics review](https://github.com/GameGeeeeek/kolonie-kepler7/actions/runs/37829085005)
also passed: 78 harmony checks, 67 graphics-expansion checks, existing native
subtab keyboard behavior and all nine harmony plus six expansion counterexamples.
Independent adversarial review of the final native navigation correction found
no further confirmed issue. Release metadata is checked separately after numbering.
