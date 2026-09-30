# iOS release status

Status recorded 30 September 2026. The owner resumed App Store release work.
**Version 1.0 build 4 uploaded successfully at 14:44:44 Europe/London, finished
Apple processing, and was selected and saved in App Store Connect at about
14:51. The version remains Prepare for Submission. It has not been submitted
for review or published. Do not submit build 3.**

## Account and submission

App Store Connect app **6816024635**, bundle ID `com.franmora.tumblegrove`,
signing team `8XX87M89M2`. The authenticated App Store Connect session confirmed
**Prepare for Submission** on 30 September, with build 4 selected and saved.
No review submission, approval or public release is confirmed.

The Chrome session initially required sign-in; authenticated access was restored
on 30 September. Updated promotional text, description and review notes from
[the listing](listing.en-GB.json) have been saved to App Store Connect. No
passwords, verification codes or private review contacts belong in this
repository.

## Current native build 4

Build 4 includes the current Fruit powers toggle, whole-basket combos,
accidental and overlapping-drop merge credit, explicit Gather pair selection,
all-size Squeeze, and the latest web game improvements. All game resources are
bundled for offline use; the native build contains no service worker or web
manifest and does not download game code from GitHub Pages.

It also fixes the startup-recovery race found while testing build 3. Navigation
callbacks must match the current `WKNavigation`, so an old navigation's failure
or finish cannot change the state of a newer Retry. Existing load-generation
checks protect delayed readiness callbacks and timers. Cold startup has a
bounded 30-second watchdog. Genuine errors for the current navigation still
show the recovery screen.

Completed checks:

- 121 JavaScript tests and TypeScript passed for the bundled game source.
- Nine native tests passed: `ios/build/NativeTests-build4.xcresult`. Three new
  regressions cover stale navigation callbacks, old readiness completions after
  Retry, and current-navigation cancellation/failure handling.
- Simulator build, signed archive and local App Store export succeeded.
- All 19 bundled-resource hashes match in the archive and exported IPA.
- Strict code signature passed; Cloud Managed Apple Distribution, correct team,
  release entitlement `get-task-allow=false`, privacy manifest and
  non-exempt-encryption declaration present.
- iPad simulator: successful cold launch, classic dropping and merge for score 1,
  powers/new-round switch, and landscape layout and dropping were observed.
- iPhone simulator: successful cold launch, retained dark-mode and powers
  preferences, merging, current combo UI, switching to light mode and Inspect
  naming a Greengage were observed.
- No physical iPhone was connected. Physical tilt, permission denial, prolonged
  physical-device play and physical-device cold launch remain unverified.

## Local build 4 artifacts

| Artifact | Location |
| --- | --- |
| Signed archive | `ios/build/TumbleGrove-build4.xcarchive` |
| Exported IPA | `ios/build/AppStore-build4/Tumble Grove.ipa` |
| Export verification | `ios/build/AppStore-build4/verification.json` |
| Packaging evidence | `ios/build/AppStore-build4/DistributionSummary.plist`, `Packaging.log` |
| Native tests | `ios/build/NativeTests-build4.xcresult` |
| Successful upload log | `/private/tmp/tumble-ios-upload4.log` |

Exported IPA: **10,046,468 bytes**. SHA-256:
`0cd26ad5faae033745cdbf8ba91451b92004de76c101818b9de906fae4263051`.
Xcode uploads from the archive through a separate packaging step; this hash
identifies the local export.

## Listing, screenshots and privacy

The listing saved in App Store Connect describes all seven optional powers,
shared combos and the updated targeting accurately. Three new build-4 captures
are ready: iPhone powers, iPhone dark-mode Inspect with a Greengage, and iPad
landscape powers. All JPEGs were visually checked and have no alpha channel.
No screenshot upload has yet been confirmed in App Store Connect. Browser
access was restored after the owner confirmed sign-in. The visible Choose File
control now opens its supported file chooser, but attaching the prepared files
fails with “Not allowed”. The current blocker is the Chrome ChatGPT extension's
file-URL access. Owner permission has been requested to temporarily enable
“Allow access to file URLs” for this upload and turn it off afterwards; that
permission is still pending. Earlier chooser timeouts and “Debugger unattached”
errors are historical, not the current blocker. The saved metadata and build-4
selection remain valid. Capture provenance is in
[screenshots](screenshots/README.md). The old build-1 captures remain historical
evidence and should not be used for this release.

The privacy wording explicitly includes the locally stored Fruit powers on/off
preference. Source audit found no new off-device data flow from powers. The
public [privacy page](https://fran-mora.github.io/tumble-grove/privacy.html) and
service worker were deployed through GitHub Pages commit `1a989e5` and verified
byte-for-byte on 30 September. The same privacy page is bundled in build 4. The
game uses public GitHub Issues for support; no personal email address or phone
number is published by the support page.

The App Privacy publication dialog remains pending. The proposed answer is
“No, we do not collect data from this app”. Its final accuracy, compliance and
future-update attestation has not yet been confirmed or published.

## Submission preflight

Apple's Add for Review preflight was checked after browser access was restored.
It reported “Unable to Add for Review” and listed only the missing 13-inch iPad
screenshots, 6.5-inch iPhone screenshots, App Privacy information and price tier.
The selected build 4 and saved version/contact information were accepted by this
preflight. Private contact values are not recorded here. This validation attempt
did not submit the app for review.

The media manager explicitly states that its 6.9-inch screenshot group covers
6.5-inch, 6.7-inch and 6.9-inch iPhones. The prepared 1320 × 2868 images therefore
belong in that group even though the preflight describes the missing images as
6.5-inch screenshots. Their upload and processing still need verification.

## Remaining actions

1. Obtain the pending temporary file-URL-access permission, enable it for the
   screenshot upload, upload the prepared build-4 iPhone and iPad images, verify
   their processed previews and disable the permission afterwards.
2. Resolve three pending owner confirmations: free pricing; availability in 173
   eligible territories excluding mainland China and Vietnam, with future
   territories off; and Apple's final App Privacy accuracy, compliance and
   future-update attestation. No required game permits are recorded for the
   excluded territories. The earlier developer agreement was accepted on
   25 September; it is separate from this privacy attestation.
3. Save the confirmed pricing and availability choices and publish the verified
   privacy declaration.
4. Complete outstanding physical-device checks, verify the complete version
   form and release choice, then submit for review and record Apple's outcome.

The three pricing, territory and privacy confirmations above remain unanswered,
separately from the new temporary file-access permission request. Use the
supported screenshot file chooser once authorised. Do not use unrelated private
browser windows as an upload workaround.

## Earlier builds

Build 3 uploaded successfully on 30 September at **14:25:12 Europe/London**,
then simulator QA found the recovery race described above. A cold iPad WebKit
startup exceeded the old 15-second watchdog. On Retry, an old navigation's
policy-cancellation error (WebKit error 102) marked the new attempt failed,
even though the replacement navigation subsequently finished successfully.
Build 4 supersedes it. Do not submit build 3.

Build 3 passed six native tests and its original resource/signing checks before
that UI issue was discovered. Its artifacts are preserved at
`ios/build/TumbleGrove-build3.xcarchive`, `ios/build/AppStore-build3/` and
`ios/build/NativeTests-build3.xcresult`, with successful upload log
`/private/tmp/tumble-ios-upload3.log`. Its local IPA is **10,045,179 bytes**,
SHA-256 `9f968c52a6a8df11f512c78fdd49d8fcd3380e014e014d5944827a1d0f4fbdff`.
Mac memory pressure and slow simulator startup were observed during that QA;
these are not evidence of missing bundled resources. A later simulator
shutdown was requested when Device Hub quit, rather than a game crash.

Earlier saved account fields, build 2 evidence and historical approval details
are retained in [the previous release record](release-status-build2.md). They
are dated evidence, not a fresh verification of Apple's current account state.
