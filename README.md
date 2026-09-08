# Tumble Grove

A complete fruit dropping and merging web game, built as a separate project alongside Little Orchard.

## Licensing and credits

Original contributions are **rights reserved**, with personal play and offline saving allowed by the [project rights notice](LICENSE). This is not an open-source release. Third-party components and adapted UI source retain their upstream licences; their full text is in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). The game's Help dialog links to [Credits & licences](https://fran-mora.github.io/tumble-grove/credits.html), which also works offline.

[docs/legal/](docs/legal/README.md) contains the asset provenance, generated file fingerprints, dependency inventory, identified inspiration and review status for a UK-based maintainer intending worldwide availability. These records are not legal clearance; trademark and specialist IP review remain outstanding. `npm run build` regenerates dependency notices and public copies before preparing the offline cache.

## Play

Move the pointer and click to drop. On a phone, drag to aim and release. The focused play area also supports Left/Right arrows to aim, Space or Enter to drop, and P to pause.

Touching identical fruit merge through 11 growth levels. Each new round picks one character at each level from 110 fruit and variety characters (10 choices per level). That family remains fixed for the whole round, and the next round changes every level’s character. Merges score triangular points (1, 3, 6, …, 55). Two final-level fruit clear for 100 points. The dashed line is only a guide: fruit can stack above it indefinitely. A round ends only when a whole fruit spills outside. The basket has finite side walls and an open rim; the circular bowl has a visible opening that rotates with gravity. Fruit may protrude through the opening without immediately ending the round.

Includes a next-fruit preview, aim guide, optional synthesized sound, pause, restart confirmation, final-level celebration, reduced-motion support, and local personal-best storage. The fruit waiting to drop has a name label that follows the preview, stays upright with phone tilt, and moves around the sprite to fit within the arena. Browser storage may be unavailable or cleared; this never prevents play. The active round is not saved on refresh.

On phones, the game fills the available dynamic viewport without page scrolling, respecting safe areas and Safari's browser bars. The arena preserves its aspect ratio and scales into the space remaining below the controls; landscape moves scores alongside it. Offline status stays within the same screen. Help dialogs can scroll independently when needed. The fruit-family strip is removed, and the desktop discovery panel shows only the highest fruit reached so far.

## Develop

Requires Node 22.13 or newer.

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

React/Vite with a client-side Canvas renderer. Development runs at http://127.0.0.1:5174/. The physics engine has no network dependencies and uses a 120 Hz fixed step, convex fruit-silhouette collision constraints, mass-weighted impulses, friction, and collision-driven merges. Assets are bundled locally. The game is entirely static and needs no server runtime, external API, account database, or API key.

## Validation

Automated tests cover drops, all merge tiers, double-consumption prevention, chain reactions, collision separation, finite walls, high stacks above the former limit, actual spills through the basket rim and rotated circular mouth, pause/reset, invalid input, and extended deterministic games. Collection tests cover all 110 candidates, per-round selection, stable families during merges, sprite/collider alignment, floor contact, and guide contact. The offline check simulates cached navigation and every asset with networking disabled. Drop-preview names, edge placement, and name changes were checked in desktop and 390 × 844 browser viewports, including absence of mobile page scrolling. Physical-device testing has not been performed.

Gravity and sensor tests cover every direction, the circular walls, rotated guides, sideways/upward merges, full rotation, flat-phone dead zones, screen orientation, sensor permissions, missing data, and cleanup. Sensor events are simulated.

Optional WebMCP read-game and drop-fruit tools use the same engine as the controls, validate input, and are registered only when document.modelContext is supported. The drop-fruit tool was exercised through the local browser integration during drop-preview verification.

## Artwork

Fruit character sprite sheets were generated for this project. The original prompt is in public/artwork-prompt.txt; collection prompts are saved alongside their atlases. The runtime extracts 11 characters from public/fruits.png and 99 new choices from public/fruit-collection-a.png and public/fruit-collection-b.png; native fruit emoji provide a fallback if an image cannot load. Interface icons use Lucide, including Feather-derived icons; components and styling also include third-party work. See [asset provenance](docs/legal/asset-provenance.md) for origins, evidence and limitations. Generation and provenance records do not establish copyrightability or non-infringement.

## Fruit bounds

Rendering and collision detection share body-centered geometry measured from the existing sprite sheet. Convex hulls follow fruit flesh; stems and leaves remain decorative so they do not create invisible spacing between fruit bodies. Each crop retains its native aspect ratio without square padding. Every alternative at a level has the same body area; the next level has at least 26% more area. Shape and orientation can still change width or height independently. The same rotated bounds handle walls, floor, spill detection and the drop guide. Merge particles remain, but fruit sprites no longer shrink away from their colliders.

To regenerate geometry after replacing artwork, run `python3 scripts/trace-fruit-shapes.py` for the original sheet and `python3 scripts/trace-collection.py` for the new atlases, with Pillow installed. This reads PNG pixels and writes TypeScript coordinates; it does not modify the original image. Pillow is not required to build or run the game.

## Fruit sizes and growth levels

[All 110 sizes and sources](https://fran-mora.github.io/tumble-grove/fruit-sizes.html) are also available from the game's help dialog and as a downloadable CSV. The research data is in `docs/fruit-size-research.json`. Each entry records a representative whole-fruit mass, source URL, evidence type, and cultivar or sampling caveat. Study averages are distinguished from published typical weights, range midpoints, commercial grades, and proxies. These are not universal species averages.

Whole-fruit mass in grams is a consistent proxy for real-world size, including skin and seeds. We rank individual fruit (not grape bunches or paired cherries); coconut includes the husk. Values are rounded to three significant figures and sorted lightest to heaviest, then split into 11 consecutive buckets of exactly 10. Ties use stable artwork IDs and may straddle a boundary. Natural size ranges overlap. Game body areas increase by level but compress the real-world scale for playability.

After editing the research, run `npm run data:fruits` to regenerate the runtime weights, public source table, and CSV, then `npm test`. Artwork identity and atlas coordinates stay independent of growth levels, so reclassification does not change the characters or require new artwork. Tests check complete evidence coverage, ordered buckets, all alternatives, and increasing body area.

## Phone gravity mode

Turn on **Gravity mode** above the arena on a phone and allow motion/orientation access when prompted. This starts a circular round. Tilt in any direction to move fruit; the opening, spawn edge and dotted guides rotate with gravity. Flatter angles reduce gravity, and a small dead zone prevents drift when flat. Input is smoothed. Crossing the dotted guide never starts a loss timer; keep fruit from spilling through the opening.

Drag perpendicular to the dotted drop guide to move the entry point, then release to drop. Mode changes confirm before clearing an active round. Denied permission, missing sensors or no data preserve the existing game. Turning the mode off removes sensor listeners. Each mode stores its own local best score. Motion values are used only on the device and are not transmitted or saved.

Sensor access needs a secure context and a browser exposing DeviceOrientationEvent. If an embedded browser has no motion support, open the published HTTPS game directly in your phone browser. The app uses feature detection and invokes the optional requestPermission method directly from the toggle/confirmation gesture.

Implementation references: [MDN device coordinate frames](https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained), [MDN orientation permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static), and [W3C screen orientation](https://www.w3.org/TR/screen-orientation/#dfn-current-orientation-angle).

## Offline iPhone app and GitHub Pages

Play at https://fran-mora.github.io/tumble-grove/ . In Safari, choose Share → Add to Home Screen, keep Open as Web App enabled if shown, and tap Add. Open the new icon while online and wait for **Ready for offline play** beneath the game. Then turn on airplane mode and reopen the app to check it before traveling. Classic and phone gravity modes both run locally. A round resets when the app reloads; best scores remain on that device.

`npm run build` (also available as `npm run build:pages`) creates the static app in `dist-pages`, including a versioned service worker that saves every game asset before reporting offline readiness. `node scripts/check-offline.mjs` checks cached navigation, assets, and readiness with networking disabled. `npm start` previews the production build locally. Service worker registration is enabled only in production builds.

GitHub Pages is the only deployment target. Publish the contents of `dist-pages` to the `gh-pages` branch of `fran-mora/tumble-grove`; GitHub Pages serves that branch's root. Keep source code on `main`.

The source repository is https://github.com/fran-mora/tumble-grove. Install the Home Screen app from the Tumble Grove address above. Best scores migrate in the current browser or Home Screen installation without clearing the old data. Legacy storage keys are read when migrating to the new name. Historical artwork prompts retain their original wording.
