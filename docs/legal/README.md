# Licensing and provenance

Recorded 8 September 2026. The maintainer selected **rights reserved**, operates
from the **United Kingdom**, and intends worldwide availability. These are
project records, not a legal opinion or a claim of worldwide clearance.

## Where each record belongs

| File | Purpose |
| --- | --- |
| [`../../LICENSE`](../../LICENSE) | Rights reserved for original contributions, with permission for personal play and offline saving. |
| [`../../THIRD_PARTY_NOTICES.txt`](../../THIRD_PARTY_NOTICES.txt) | Generated copies of dependency licences and notices, including adapted UI source. |
| [`asset-provenance.md`](asset-provenance.md) | How the artwork, code, audio, fonts and research data entered the project. |
| [`asset-hashes.json`](asset-hashes.json) | Generated SHA-256 fingerprints of the recorded assets and prompts. |
| [`third-party-sources.json`](third-party-sources.json) | Explicit CSS, copied-source and generated-helper inputs added to the automatic JavaScript inventory. |
| [`dependency-inventory.json`](dependency-inventory.json) | Build-selected package versions, sources, license identifiers, and licence-file hashes. |
| [`review-status.md`](review-status.md) | Confirmed inspiration, scope of the initial comparison, and unfinished clearance work. |
| [`../../public/credits.html`](../../public/credits.html) | Player-facing credits and links to the distributed notices; accessible from Help. |

## Scope of the rights notice

The root notice addresses only rights that the project's contributors actually
hold. It does not replace third-party licences, create a monopoly over game
mechanics, establish the copyrightability of AI output, or provide permission
from the inspiration game's publisher. There is no general open-source grant
for original Tumble Grove code or artwork. GitHub's public-repository viewing
and forking terms and statutory exceptions remain applicable.

The shadcn-derived files under `components/ui/`, `hooks/use-mobile.ts`, and
`lib/utils.ts` retain their upstream MIT permissions; the root reservation
does not remove those permissions. Material from installed packages retains
its own terms. Factual fruit measurements and source-owned research content
are not claimed as exclusive project property.

## Maintaining the records

Run `npm ci`, then `npm run build`. Vite inventories JavaScript dependencies
in the production bundle. `scripts/build-legal.mjs` combines their full licence
files with the CSS, adapted source, and helper notices recorded explicitly in
`third-party-sources.json`. It preserves accompanying root-level NOTICE and
COPYING files, produces the root notices and public copies, and fingerprints
the recorded project assets. The offline cache is generated **after** these files.

Review changes to the inventory and upstream terms before deploying dependency
updates. The script fails if licence text is missing, the package differs from
the lockfile, or a package declares a licence outside the currently reviewed
set. Detection and notices are compliance aids, not a complete legal audit.
The inventory covers shipped JavaScript, explicitly identified styles and
helpers, and vendored UI source; it does not claim every development-only
dependency is shipped in the browser. `node_modules` is not distributed in
the source repository. If that distribution changes, review its notices too.

When changing the styling pipeline or adding copied source/assets, update the
explicit input list and provenance record as well as the dependency lockfile.
Preserve the original artwork files, embedded metadata, prompts and git history.
Do not rewrite them to obscure inspiration or earlier project names.

Keep confidential legal advice, correspondence, insurance documents, credentials
and personal contact details outside this public repository. This folder holds
factual provenance and review status, not privileged advice.

## Reference material

- [GitHub repository licensing](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [UK IPO: search for a trade mark](https://www.gov.uk/search-for-trademark)
- [UK IPO: protecting IP abroad](https://www.gov.uk/government/collections/protecting-your-uk-intellectual-property-abroad)
- [Vite's build licence inventory](https://vite.dev/config/build-options.html#build-license)

These records reduce avoidable licensing gaps. A lawyer's review is still
needed for the questions marked open in `review-status.md`.
