# iOS release status

Status recorded 25 September 2026. **Version 1.0, build 1 completed processing:
TestFlight shows upload Complete and build Ready to Submit, with a 90-day expiry.
It has not been submitted for review, approved, or published on the App Store.** These notes distinguish
local packaging and simulator evidence from Apple's distribution process.

## Implemented and checked

- The SwiftUI/WKWebView app bundles the complete game, artwork, fruit research,
  credits and licences. `npm run build:ios` generates its resources separately
  from GitHub Pages, excluding service-worker installation and remote-update UI.
- Native Core Motion and lifecycle events implement the web bridge contract.
  Bundled reference pages use a separate sheet, and ordinary external web links
  open in the system browser. The main game remains at the trusted bundled URL.
- `npm test`: **78 JavaScript tests passed**. `npx tsc --noEmit` passed.
- **Six native tests passed** after fixing bundle path resolution to reject
  symlinks component by component. Local report:
  `ios/build/NativeTests-fixed.xcresult`. This includes dangling/missing-leaf
  symlink escapes, regular-file controls and gravity-orientation projections.
- The iPhone simulator build launched successfully. Actual game drops and a
  merge were manually verified in the native app. This is simulator evidence,
  not a physical-iPhone motion test.
- On iPad Simulator, portrait and landscape gameplay were manually checked,
  including two drops merging for score 1. Opening the bundled fruit-size page
  from Help and closing its native sheet with Done preserved the running game.
  Gravity mode immediately reported unavailable simulator motion sensors,
  confirming the trusted native bridge handled the request.
- The first iPad launch timed out during concurrent simulator boot and test-build
  work; Retry then loaded promptly. Repeat a cold launch on a physical device
  before release, without treating this simulator recovery as proof of normal
  real-device startup performance.
- A fresh signed Release archive and local App Store-distribution IPA were
  successfully rebuilt **with the tested symlink fix and native safe-area CSS
  correction**. The drag hint retains its bottom safe-area padding when the web
  offline-status banner is absent in the native app. Strict code-signature
  verification passed for the archive app and exported app using the Mac's
  certificate trust services. The exported signature is Apple Distribution for
  the configured team, with debugging disabled and no device-limited profile.
- All 17 bundled-resource hashes match inside the exported IPA. The package has
  no service worker or web manifest, and its entry HTML/CSS has no remote runtime
  assets. The privacy manifest and non-exempt-encryption declaration are present.
- One standard Xcode App Store Connect upload of the same signed archive
  succeeded at **11:09:28 Europe/London on 25 September 2026**. Xcode reported
  “Uploaded package is processing” and “Upload succeeded”, and exited with code
  0. App Store Connect subsequently confirmed processing completion: TestFlight
  shows upload Complete and build 1 Ready to Submit, with a 90-day expiry.
  This does not record review approval or public release. Local upload log:
  `/private/tmp/tumble-ios-upload.log`.
- Two authentic 6.9-inch iPhone screenshots have been captured and visually
  checked: classic gameplay with a cascade, and dark-mode Mangosteen inspection.
  Opaque JPEG upload copies and provenance are in [screenshots](screenshots/README.md).
  They have not been uploaded to App Store Connect; an iPad capture is outstanding.
  The browser screenshot-upload attempt failed with “Not allowed” because
  AllowFileURLs was unavailable; no screenshot upload was completed.
- The main version listing was rechecked: promotional text, description,
  keywords, marketing URL, copyright and sign-in-not-required persisted. The
  App Review Notes textbox was observed empty and needs to be filled again.
  No private App Review contact was entered.
- App Information saved the subtitle “A colourful fruit puzzle” and the
  Games / Puzzle / Casual categories; its Saved indicator was observed.
- The age-rating questionnaire was answered with all listed content absent or
  No. Apple calculated 4+; the category choice was Not Applicable rather than
  Made for Kids. The modal Save was clicked. Content rights was set to Yes for
  licensed third-party content and Done was clicked. **Persistence of these age
  and content-rights choices is not confirmed:** the parent form still needed
  saving, and navigation produced an unsaved-changes prompt.
- The existing per-app Non-Trader status was visible. No new trader-status
  declaration was made. Pricing, territories and App Privacy remain unfinished.

The signing setup uses automatic signing for team `8XX87M89M2`, bundle ID
`com.franmora.tumblegrove`, version 1.0, build 1. Private signing keys and account
credentials are not part of the repository.

The current exported IPA is 10,027,245 bytes. SHA-256:
`80b9c39113fa2d701588b1e8857622add33b9a5420152d0cb4fcf1f807382ff4`.
This fingerprint identifies the local exported IPA. Xcode uploaded from the
same archive using its separate upload packaging step. Further native or
bundled-web changes require a higher build number, another archive/export/upload
and an updated fingerprint; approved privacy/support pages are still pending.

Local artifacts are ignored by Git:

| Artifact | Location |
| --- | --- |
| Xcode archive | `ios/build/TumbleGrove.xcarchive` |
| Exported IPA | `ios/build/AppStore/Tumble Grove.ipa` |
| Export audit | `ios/build/AppStore/DistributionSummary.plist` and `Packaging.log` |
| Passing native-test report | `ios/build/NativeTests-fixed.xcresult` |

## Still in progress or awaiting input

- Remaining native UI checks continue. Physical-device tilt, permission denial,
  interruptions, cold-launch performance and prolonged play have not been verified.
- The Mac is now unlocked. The owner needs to bring App Store Connect to the
  front and cancel the leave-page prompt so the pending form can be saved and
  verified. An unrelated Chrome window was foreground, and automatic approval
  review blocked interaction with that unrelated window. The two task-created
  test simulators had been shut down after severe Mac load; no user applications
  were stopped.
- App Store Connect is signed in, and app record **6816024635** has been created
  for `com.franmora.tumblegrove` in Prepare for Submission. An updated developer
  agreement is awaiting the owner's acceptance. Build 1 completed processing
  and is Ready to Submit; this is not a review submission.
- The public support email/contact needs owner approval. Privacy and support
  documents are drafts only; their proposed public URLs have not been published
  and the game does **not yet include those links in Help**. Credits and fruit
  sizes are already available there.
- Permission to use the owner's private App Review contact details is pending.
  Keep those details out of the public repository and policy/support pages.
- Finish and publish the approved policy/support pages, include them in the
  native resources, add Help links, and verify those links and listing claims.
- Finish authentic native screenshots for the declared device families and
  upload them through a permitted file-selection path. Save and verify the
  pending age-rating/content-rights choices, refill App Review Notes, and record
  eligible territories, price/release choice and privacy declarations using
  verified facts.
- After the remaining content changes, increment the build number, rebuild and
  validate the final archive/IPA, upload, wait for Apple's processing, select the
  processed build and submit the complete record. Record
  the actual outcome here. Local export does not establish App Store acceptance.

The [submission checklist](submission-checklist.md) retains the earlier
documentation audit and its Apple references. This status record supplies newer
implementation and test evidence; unchecked checklist items must still be
assessed against the final submitted binary.
