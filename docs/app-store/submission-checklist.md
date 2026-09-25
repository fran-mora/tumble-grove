# First iOS submission checklist

Audit date: 23 September 2026. Drafts are based on the game source and public
Apple documentation. Signing, account configuration and the final native binary
were not inspected by this documentation audit. Unticked items mean not verified
here, not necessarily missing from the existing Apple account.

## Confirmed from the repository

- [x] A complete local physics game: 110 fruit/variety characters, 11 growth
  levels, basket and circular tilt modes, names/Inspect, two appearance modes,
  optional generated sound and local best scores.
- [x] No login, ads, purchases, multiplayer, in-game messaging, tracking library,
  or developer gameplay service in the audited web implementation.
- [x] Local storage holds best scores, appearance and fruit-selection/discovery
  history. Motion readings are transient, local inputs. A live round is not
  persisted across a process restart.
- [x] Game art and sound provenance, rights notice and third-party notices exist
  in [the legal records](../legal/README.md). There is no recorded trademark or
  specialist IP clearance; [review status](../legal/review-status.md) describes
  the limitations. This is not evidence that clearance has been obtained.
- [x] Repository and existing public game URLs identify the project. The repo
  contains no verified publisher support email or other private support channel.

## Native build and device validation

- [ ] Bundle all runtime code, images, fruit research, credits and legal pages.
  Test first launch and several rounds with networking unavailable.
- [ ] Disable service-worker installation and remote code-update UI in iOS.
  Open external reference/support links in the user's browser; do not turn the
  game view into an unrestricted browser.
- [ ] Test on a physical iPhone: drag/release, tilt, permission denial, returning
  from background, interruption by phone/system UI, sound/silent behaviour,
  memory use and prolonged play. Check that inactive gameplay pauses.
- [ ] Check compact iPhones, safe areas, landscape, large text and reduced
  motion. Test each device family actually declared by the target.
- [ ] Use a current accepted Xcode/SDK, valid signing team, unique bundle ID,
  version/build numbers and a release archive. Verify Apple's then-current
  [upload requirements](https://developer.apple.com/news/upcoming-requirements/).
- [ ] Audit native code and linked SDKs for data collection and required-reason
  APIs. Include an accurate `PrivacyInfo.xcprivacy` where applicable. A framework
  or SDK addition can change the web audit's conclusions. See Apple's
  [manifest guidance](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
  and [required-reason API guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).
- [ ] Use a project-art app icon with appropriate Xcode assets; avoid relying on
  a platform emoji glyph as the App Store icon. Check icon and archive validation.

## Listing, policy and review

- [ ] Verify each feature claim in [the listing](listing.en-GB.json) against the
  uploaded build. Name and subtitle are within 30 characters; the description
  is under 4,000 characters and keywords under 100 UTF-8 bytes. See
  [app fields](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
  and [version fields](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information).
- [ ] Publish working HTTPS privacy and support pages, with verified publisher
  identity and a monitored contact. Apple requires actual contact information
  at the Support URL. The public GitHub issue tracker is a supplementary route,
  not evidence of a private contact or a substitute for all local requirements.
  [Support URL field](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information).
- [ ] Link privacy accessibly in the app. Include accurate retention/deletion
  information. The full game, usable URLs, device testing and honest screenshots
  matter to review. Apple's minimum-functionality and copycat rules still apply
  to bundled games; a native wrapper alone does not establish eligibility.
  [Review guidelines, 1.5, 2.1, 2.3, 4.1–4.3 and 5.1.1](https://developer.apple.com/app-store/review/guidelines/).
- [ ] App Privacy candidate: **No, we do not collect data from this app**, only
  after checking the final native build. Local-only data is outside Apple's
  collection definition. Review any added diagnostics, embedded web traffic and
  support flow before selecting this. See
  [privacy definitions](https://developer.apple.com/app-store/app-privacy-details/)
  and [submission steps](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).
- [ ] Complete the current age-rating questionnaire. Source-observed answers:
  no parental controls or age assurance; no in-app UGC, messaging/chat,
  advertising, unrestricted web browsing, health/treatment advice, gambling,
  contests, loot boxes or objectionable content. Cartoon fruit combining is not
  presented as violence. A 4+ outcome is expected, not pre-assigned; App Store
  Connect calculates regional ratings. Use the general Games category rather
  than choosing Made for Kids without a deliberate children's-product decision.
  [Age-rating setup](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/).
- [ ] Recommended screenshots: 3–5 actual native screenshots showing a basket
  round, a named fruit in Inspect, gravity bowl, a cascade and dark mode. Use
  gameplay states produced by the app. One to ten JPEG/PNG screenshots are
  allowed; no alpha. A 6.9-inch iPhone set at 1320 × 2868 portrait (or accepted
  alternatives in the table) covers the highest current standard phone group.
  If the app declares iPad support, add the required 13-inch set, e.g.
  2064 × 2752. Do not upscale browser screenshots to impersonate native captures.
  [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
- [ ] Upload the build, wait for processing, resolve validation feedback, select
  it on the version and submit the complete record. An upload is not a submission
  or approval. See [build uploads](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds).

## Account and owner facts still to resolve

Retrieve these from the existing authenticated account where they are already
established. Ask the owner only for missing facts or decisions; do not invent
answers or repeat resolved questions.

| Item | What is needed |
| --- | --- |
| Publisher and copyright | Verified legal person/entity and appropriate year for the App Store copyright field. A local username or repository handle does not establish ownership. |
| Public support/privacy contact | An existing owner-approved monitored email or suitable private contact route, plus publisher identity. Confirm the support-retention wording reflects actual practice. |
| Private App Review contact | A reachable person, phone and email in App Store Connect. Reuse accurate existing account values; do not commit them. No demo login is needed for this game. |
| Content-rights declaration | Confirm authority to publish the original contributions and the scope of any third-party permissions. Preserve upstream notices. The existing legal file does not record a clearance opinion; do not claim one or falsely select a declaration merely to bypass the field. |
| EU trader status | Reuse an applicable existing declaration or obtain the owner's factual self-assessment. Traders must provide verified public contact information. Free pricing alone does not determine trader status. [Apple's DSA guidance](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements). |
| Territories | The owner previously requested worldwide availability if possible. Use eligible regions; mainland China and Vietnam require game approvals not recorded here. Exclude them unless the owner supplies applicable permits. Record the actual territory selection. [China requirements](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information), [Vietnam game licensing](https://developer.apple.com/news/?id=06h4gf33). |
| Encryption | Web game source implements no cryptography. For a shell using only Apple's exempt system cryptography, `ITSAppUsesNonExemptEncryption = NO` is the likely correct build setting. Verify all native dependencies and answer the export questions accurately. [Apple's export guidance](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations). |
| Price and release | Existing game is free without monetisation; a free iOS release is the working assumption. Record actual price, availability and release option when configured. No custom EULA has been supplied; Apple's standard EULA is available while third-party notices remain intact. |

The factual declarations above are separate from the optional further IP work
in `docs/legal/review-status.md`. No record here claims that Apple has approved
the game or that publication eliminates legal risk.
