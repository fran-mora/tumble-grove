# Asset and code provenance

Recorded 8 September 2026. This records evidence available in the repository
and development history. Generation or independent implementation is not, by
itself, a finding that material does not infringe another work.

| Material | Origin and evidence | Rights / remaining limitations |
| --- | --- | --- |
| `public/fruits.png` | Generated for this project; prompt in `public/artwork-prompt.txt`; introduced in commit `c6ea489`. | Original file and prompt retained. No statutory copyrightability or non-infringement conclusion is asserted. |
| `public/fruit-collection-a.png`, `public/fruit-collection-b.png` | Generated additional fruit atlases; matching `*-prompt.txt` files; introduced in `8ffd48f`. | Prompts refer to a style-reference image. Development history identifies the existing fruit atlas as the reference; the prompt files alone do not encode the reference image's hash. |
| Cropped sprites and collision outlines | `app/render.ts`, `scripts/trace-fruit-shapes.py`, `scripts/trace-collection.py`, `app/fruit-shapes.ts`, `app/collection-shapes.ts`. | Derived from the project atlases. Runtime cropping removes the background; source PNGs remain preserved. |
| Game engine and presentation | Project implementation in `app/engine.ts`, `app/collision.ts`, `app/arena.ts`, `app/tilt.ts`, `app/render.ts`, `app/page.tsx` and `app/globals.css`; git history begins at `c6ea489`. | AI-assisted development. The source has not been forensically compared with the inspiration game's source. Third-party components and styles are identified separately. |
| UI components and icons | shadcn scaffold recorded in `components.json`; Base UI components; Lucide icons, including Feather-derived icons. | Upstream terms apply. Full installed licence text is included in `THIRD_PARTY_NOTICES.txt`; exact scaffold revision was not recorded. |
| Sound | `playTone` in `app/page.tsx` creates short oscillator tones with the Web Audio API. | No recorded music or sampled sound file is bundled in the present source. |
| Emoji and favicon | `public/favicon.svg` contains a Unicode cherry character; fallback emoji appear in `app/fruit-collection.ts`. | Rendered by the player's platform fonts. No Apple, Google or other emoji font/artwork file is bundled. Platform glyph appearance is not claimed as original project artwork. |
| Fonts | System font stack in `app/globals.css` and canvas text styles. | No font files are distributed. Naming an installed font does not transfer rights in that font. |
| Fruit-size research | `docs/fruit-size-research.json`, generated `public/fruit-sizes.html`, `public/fruit-sizes.csv`, `app/fruit-sizes.ts`. | Source links and limitations are retained. Measurements are representative values, not universal averages. No third-party article, photograph or source dataset is relicensed by the project's rights notice. |

## Image-generation metadata

All three original PNG files contain embedded metadata identifying a
`softwareAgent` named `gpt-image` with version `2.0`. These strings were inspected
on 8 September 2026. This is an observation of embedded metadata, **not** a
cryptographic validation of the C2PA signature or a rights-clearance certificate.
The file and prompt hashes are recorded in `asset-hashes.json`.

OpenAI's applicable terms govern rights between the service provider and the
account holder; they do not grant a third-party game's rights. Copyrightability
and ownership can depend on jurisdiction, human contribution, and the account
or employment arrangements. Do not infer exclusive rights merely from an AI
generation record. Relevant references:

- [OpenAI European terms](https://openai.com/policies/eu-terms-of-use/)
- [UK government copyright guidance](https://www.gov.uk/copyright)
- [US Copyright Office report on AI copyrightability](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)

## Inspiration

The maintainer identified [Fruit Merge™: Match Game, App Store ID
6471572249](https://apps.apple.com/us/app/fruit-merge-match-game/id6471572249)
as the inspiration. Apple lists **Brave HK Limited** as seller and displays
its copyright notice. This identifies the listing's publisher; it is not a
verification of ownership of every asset or registered right.

No licence from that publisher is recorded. This record does not assert that
one is required for a shared game idea, nor that the present implementation
has received clearance. See `review-status.md` for the comparison's limits.
