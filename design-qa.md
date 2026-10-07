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
