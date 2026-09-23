# Colourful mixed rounds

Every new round draws from the entire collection, without climate or region themes.
The eleven size levels still have ten alternatives each. The chosen lineup stays
fixed until restart or a mode change, and every level changes from the previous round.

## Colours from the artwork

`app/fruit-colours.ts` records one representative body colour per artwork ID, in
sRGB and OKLab. `python3 scripts/measure-fruit-colours.py` reproduces the table
using the existing PNGs and collision hulls; it requires Pillow and Node. It only
reads images and never changes them. Median RGB channels inside each flesh hull,
excluding near-white and near-black pixels, reduce the influence of highlights,
faces and decorative leaves. A single colour approximates patterned or multicoloured
fruit; it is not a claim about botanical colour.

## Selection

`app/fruit-selection.ts` shuffles the level order, then makes a weighted random
choice for each level. Similar colours already selected reduce a candidate's
weight. Similarity combines OKLab distance (with less emphasis on lightness) and
hue, so light and dark shades of green still compete. Adjacent levels receive an
extra penalty because distinguishing consecutive growth stages helps play.

This is a preference, not a hard exclusion: eleven fruits can share colours,
particularly when a level has many red berries or green melons. A minimum colour
weight of 0.025 and selection-history balancing keep every variety available.
Base weights favour less-selected alternatives by `1 / (1 + excess selections)^2`,
with a 1.4 multiplier for fruit not yet encountered. History counts hidden lineup
selection separately from fruit actually displayed or created. Existing saved
history remains compatible, and each encounter counts once per round.

Run `npm run test:selection` or `npm run simulate:selection` to check this behaviour.
In the seeded 30,000-round simulation, with no simulated discoveries:

| Measure | Colour preference | Uniform random baseline |
| --- | ---: | ---: |
| Very similar pairs per round | 3.39 | 4.97 |
| Very similar adjacent pairs per round | 0.64 | 1.11 |

“Very similar” means similarity above 0.75, not a human-assigned colour category.
The comparison uses the same ten-candidate size levels. Individual fruits appeared
2,998–3,004 times each against an equal-share target of 3,000. These are simulated
results for one seed, not a promise about any individual player's rounds.
