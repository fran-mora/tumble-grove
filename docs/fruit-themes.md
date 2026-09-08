# Random round themes

Tumble Grove rolls a theme automatically when a round starts, including a new
round after a mode change. There is no theme chooser. The probabilities are
30% Tropical Grove, 30% Temperate Orchard, 30% Mediterranean Market, and 10%
Wild Mix. Independent rolls can repeat a theme. The chosen theme and eleven
fruit identities stay fixed throughout that round.

## Associations and limits

The lists in [`app/fruit-themes.ts`](../app/fruit-themes.ts) are **editorial
associations with growing conditions and market/garden collections**. They are
not a native-origin database, botanical classification, planting guide, or claim
that all fruits in a round come from the same region. Several tags may fit a
fruit. Every theme also admits visiting fruits; Wild Mix has no theme preference.

- Tropical Grove includes tropical and subtropical fruit. The broader scope
  accommodates citrus and highland fruits as well as humid-tropical species.
- Temperate Orchard includes berries, orchard crops and warm-season garden
  harvests. Melons and squash are seasonal crops here, not winter-hardy trees.
- Mediterranean Market groups sun-loving orchard and market fruit, including
  introduced crops. A market association does not establish Mediterranean origin.
- Named colour/market variants generally inherit their crop group's associations;
  this is not a separate cultivation study for every depicted cultivar.

For example, pawpaw means the temperate **Asimina triloba** represented in the
existing size research, not papaya. Feijoa, citrus and cherimoya can bridge the
tropical/subtropical and Mediterranean collections. Golden kiwi is a warm-site
orchard association; it is not a claim that it tolerates every temperate winter.

## Sources consulted

These references inform the associations; the authors did not create or endorse
the game's tags. No source images or article text are bundled.

| Reference | Use in the curation |
| --- | --- |
| [UF/IFAS: tropical and subtropical fruit alternatives](https://ask.ifas.ufl.edu/publication/MG373) | Subtropical/tropical group, including longan, jaboticaba, starfruit, star apple and jackfruit. |
| [UF/IFAS: tropical fruit collection](https://gardeningsolutions.ifas.ufl.edu/plants/edibles/fruits/tropical-fruit/) | Additional warm-region crop references. |
| [UF/IFAS: coffee](https://gardeningsolutions.ifas.ufl.edu/plants/trees-and-shrubs/shrubs/coffee/) | Coffee's warm-region association. |
| [Kew: Garcinia mangostana](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A428073-1/general-information) | Wet-tropical mangosteen association. |
| [University of Minnesota: fruit in northern gardens](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/fruit) | Orchard and berry groups, including seasonal melons. |
| [University of Minnesota: melons, squash and pumpkins](https://extension.umn.edu/agriculture/specialty-crops/commercial-fruit-production/harvesting-and-storing-melons-squash-and-pumpkins) | Seasonal garden harvest association. |
| [Oregon State: kiwifruit and table grapes](https://extension.oregonstate.edu/catalog/em-9181-growing-berries-oregon-coast-kiwifruit-table-grapes) | Orchard associations and the importance of suitable sites. |
| [Oregon State: kiwifruit species](https://extension.oregonstate.edu/catalog/em-9322-growing-kiwifruit-your-home-garden) | Golden kiwi differs from hardy kiwiberries; tags are not hardiness advice. |
| [UC ANR: fruit trees](https://ucanr.edu/node/139083/printable/print) | California Mediterranean-climate orchard associations. |
| [UC ANR: citrus and other subtropicals](https://ucanr.edu/node/125819/printable/print) | Citrus, feijoa, loquat and cherimoya overlap. |
| [UC ANR: cherimoya](https://ucanr.edu/county/cooperative-extension-ventura-county/cherimoya) | Highland-tropical fruit cultivated in suitable coastal California conditions. |

## Coverage of the current size buckets

Each row contains ten fruit candidates. Counts overlap because a fruit may fit
more than one association. Coverage is tested against the runtime tags.

| Level | Tropical | Temperate | Mediterranean |
| --- | ---: | ---: | ---: |
| 1 | 1 | 9 | 0 |
| 2 | 2 | 8 | 2 |
| 3 | 5 | 5 | 3 |
| 4 | 5 | 5 | 6 |
| 5 | 7 | 2 | 7 |
| 6 | 5 | 4 | 6 |
| 7 | 3 | 6 | 9 |
| 8 | 6 | 2 | 7 |
| 9 | 6 | 4 | 5 |
| 10 | 3 | 7 | 7 |
| 11 | 3 | 7 | 7 |

There is deliberately no Mediterranean tag invented for a level-one berry just
to fill a gap. The ordinary selection fallback supplies that level. All 110
fruits remain eligible, except the previous round's fruit at the same level.

## Selection and balancing

1. Roll the theme using the fixed probabilities above.
2. For each fruit, start with a weight of 5 if it matches the theme, or 1 if it
   does not. Wild Mix starts all fruit at 1.
3. Multiply by 1.4 if that fruit has never been encountered in the saved history.
4. Divide by `(1 + excess selections)^2`, where excess is relative to the least
   frequently selected fruit in that size level.
5. Randomly choose one candidate per level with those weights, excluding that
   level's previous character. Record the selected lineup for future balancing.

This is a feedback system, not a fixed promise that a certain percentage of any
individual round matches its theme. No candidate is permanently removed and
there is no change to level sizes, merge rules, drop-level probabilities or
physics. Long-term balancing is within each level; reaching larger fruit still
requires merges.

Selected and encountered counts are separate. The currently previewed fruit,
up-next preview and fruit created on the board count as encountered, once per
fruit per round. Merely assigning an unreached upper level does not count as
encountering it. Inspection does not add duplicate encounters.

History is saved in browser storage under `tumblegrove.fruit-history.v1`, with a
validated previous lineup. It survives normal reloads and offline play in the
same browser installation. Cleared/blocked storage starts fresh or uses memory;
play always continues. There is no account or cross-device history sync. Large
selection counts are rebased per level while preserving their differences.

## Reproducible simulation

Run `npm run test:themes` for invariant and deterministic simulation checks.
`npm run simulate:themes` prints theme frequency, matching proportion versus
an unthemed baseline, and minimum/maximum selection count across all 110 fruits.
The simulation measures **lineup inclusion**, not what a human player reaches.
