# App Store submission material

Prepared 23 September 2026 for Tumble Grove's first iOS release. The updated
[release status](release-status.md) records the successful build 1 upload on
25 September; review submission, approval and public release remain outstanding.

See [release-status.md](release-status.md) for the 25 September build and test
record, and [the iOS README](../../ios/README.md) for reproducible build,
test, archive and export commands.

| File | Purpose |
| --- | --- |
| [listing.en-GB.json](listing.en-GB.json) | Copy-ready English listing and review notes, subject to the final native build matching the claims. |
| [privacy.md](privacy.md) | Public policy draft; needs verified publisher/contact details and final native audit. |
| [support.md](support.md) | Support page draft; needs a monitored private contact. |
| [submission-checklist.md](submission-checklist.md) | Evidence, remaining build checks, owner facts and current Apple references. |
| [release-status.md](release-status.md) | Current native validation, local artifacts and remaining submission work. |

The proposed public pages are `https://fran-mora.github.io/tumble-grove/privacy.html`
and `https://fran-mora.github.io/tumble-grove/support.html`. The listing includes
these intended URLs, but this documentation task has **not published or verified
them**. Add the final pages to `public/`, bundle them in the iOS app, link them
from Help, and publish them on GitHub Pages before submitting the URLs. Keep
editorial instructions and unresolved placeholders out of public policy text.

The native release should include the complete game and assets. It should not
depend on the website being available, download replacement game code, or show
the web app's service-worker installation/update controls. Website updates and
App Store updates are separate release paths.

Use verified existing account details where available. Keep passwords,
authentication tokens, App Review contact phone numbers and private legal advice
out of the repository. Only owner-approved public contact information belongs in
the published policy/support pages.
