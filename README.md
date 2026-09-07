# Fruit Merge

A complete fruit dropping and merging web game, built as a separate project alongside Little Orchard.

## Play

Move the pointer and click to drop. On a phone, drag to aim and release. The focused play area also supports Left/Right arrows to aim, Space or Enter to drop, and P to pause.

Touching identical fruit merge through 11 tiers, from cherry to watermelon. Merges score triangular points (1, 3, 6, …, 55). Two watermelons clear for 100 points. Fruit remaining above the dashed line beyond a grace period ends the round. A fresh drop is exempt while entering the basket.

Includes a next-fruit preview, aim guide, optional synthesized sound, pause, restart confirmation, watermelon celebration, reduced-motion support, and local personal-best storage. Browser storage may be unavailable or cleared; this never prevents play. The active round is not saved on refresh.

## Develop

Requires Node 22.13 or newer.

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

React/Vinext with a client-side Canvas renderer. The physics engine has no network dependencies and uses a 120 Hz fixed step, convex fruit-silhouette collision constraints, mass-weighted impulses, friction, and collision-driven merges. Assets are bundled locally. The site does not need an external API, account database, or API key.

## Validation

Fifteen automated tests cover initial drops, all merge tiers, double-consumption prevention, chain reactions, collision separation, fresh-fruit grace, overflow, pause/reset, invalid input, and eight deterministic complete games. Contact tests additionally cover all 121 fruit pairings at three rotations, measured artwork alignment, floor contact, and containment. TypeScript and the production build pass. The local route returns HTTP 200. Interactive browser UI and physical-device testing were not requested or performed.

Optional WebMCP read-game and drop-fruit tools use the same engine as the controls, validate input, and are registered only when document.modelContext is supported. No supported WebMCP validation context was available, so these optional tools have not been verified in a browser implementing that API.

## Artwork

Original fruit character sprite sheet generated for this project. The exact prompt is in public/artwork-prompt.txt. The runtime extracts each character from public/fruits.png; native fruit emoji provide a fallback if the image cannot load. Interface icons use Lucide. The game reimplements the drop-and-merge mechanic with original artwork and interface; it is not affiliated with an existing Fruit Merge publisher.

## Fruit bounds

Rendering and collision detection share body-centered geometry measured from the existing sprite sheet. Convex hulls follow fruit flesh; stems and leaves remain decorative so they do not create invisible spacing between fruit bodies. Each crop retains its native aspect ratio without square padding. The same rotated bounds handle walls, floor, overflow and the drop guide. Merge particles remain, but fruit sprites no longer shrink away from their colliders.

To regenerate geometry after replacing artwork, run `python3 scripts/trace-fruit-shapes.py` with Pillow installed. This reads PNG pixels and writes TypeScript coordinates; it does not modify the original image. Pillow is not required to build or run the game.
