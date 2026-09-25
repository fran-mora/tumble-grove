# iOS release status

Status recorded 25 September 2026. **Version 1.0, build 2 uploaded successfully
and is selected and saved on the App Store version. The app remains in Prepare
for Submission; it has not been submitted for review, approved, or published on
the App Store.**

## Current build and validation

- The SwiftUI/WKWebView app bundles the complete game, artwork, fruit research,
  credits, licences, privacy policy and support page. Help links to both new
  information pages. Native motion and lifecycle events implement the web
  bridge; bundled reference pages use a separate sheet, and ordinary external
  web links open in the system browser.
- Build 2 includes the symlink-containment fix and native safe-area CSS
  correction. All **19 bundled-resource hashes** match in its exported IPA, and
  strict code-signature verification passed. The package contains no service
  worker or web manifest; its runtime assets are bundled. The privacy manifest
  and non-exempt-encryption declaration are present.
- `npm run build:ios`, `npm run build:pages`, `npm run ios:project` and the offline
  check passed for this update. TypeScript and static policy-page link checks
  passed during the integration.
- Earlier automated evidence remains **78 JavaScript tests passed** and **six
  native tests passed**. These counts are prior test results, not a claim that
  those full suites were rerun for build 2. Native report:
  `ios/build/NativeTests-fixed.xcresult`; it covers gravity projection, safe paths,
  symlink rejection, ordinary-file controls and external URL restrictions.
- Actual iPhone simulator gameplay, drops and a merge were manually verified.
  iPad simulator portrait and landscape play were checked, including two drops
  merging for score 1. Opening the bundled fruit-size page from Help and closing
  its native sheet with Done preserved the game. Gravity mode immediately
  reported missing simulator motion sensors, verifying the native bridge.
- The first iPad launch timed out during concurrent simulator boot and test-build
  work; Retry loaded promptly. Physical-device tilt, permission denial,
  interruptions, cold-launch performance and prolonged play remain unverified.
  Simulator results are not evidence of physical-iPhone motion behaviour.
- The build 2 upload succeeded at **14:49:53 Europe/London on 25 September 2026**.
  Local log: `/private/tmp/tumble-ios-upload2.log`. Apple's Add Build dialog then
  offered build 2, which was selected and saved on the version. This is not a
  review submission or approval.
- Historical build 1 uploaded at 11:09:28 Europe/London on the same day. TestFlight
  later showed upload Complete and Ready to Submit with a 90-day expiry. Its
  upload and processing evidence is superseded by build 2 for the current release.

Signing uses automatic provisioning for team `8XX87M89M2`, bundle ID
`com.franmora.tumblegrove`, version 1.0, build 2. Private signing keys and account
credentials are not part of the repository.

The current local exported IPA is **10,033,977 bytes**. SHA-256:
`027753c8e2c19d19697cb215a2eb95f4c74c41e43dd49682d93f7425f20130de`.
This identifies the local export; Xcode uploads from the archive through its
separate upload-packaging step. Any further native or bundled-web change needs
a higher build number, another archive/export/upload, and an updated fingerprint.

Local artifacts are ignored by Git:

| Artifact | Location |
| --- | --- |
| Current Xcode archive | `ios/build/TumbleGrove-build2.xcarchive` |
| Current exported IPA | `ios/build/AppStore-build2/Tumble Grove.ipa` |
| Current export audit | `ios/build/AppStore-build2/DistributionSummary.plist` and `Packaging.log` |
| Passing native-test report | `ios/build/NativeTests-fixed.xcresult` |

## Public information and screenshots

- [Privacy](https://fran-mora.github.io/tumble-grove/privacy.html) and
  [support](https://fran-mora.github.io/tumble-grove/support.html) are live on
  GitHub Pages from `gh-pages` commit `486446d`. Both returned HTTP 200 and their
  downloaded contents matched the build. Build 2 includes the same pages for
  offline reading.
- Final browser verification of the live GitHub Pages game showed both Privacy
  Policy and Support links in Help. The support page was visually checked as
  readable and contained no email address. The new pages' presence in native
  build 2 is verified by packaging; a native UI check of these two pages is not
  claimed here.
- The owner chose public GitHub Issues as the support route. The pages explain
  that posting needs a GitHub account, posts and attachments are public, and
  personal or sensitive information must not be submitted. The dedicated-mailbox
  plan was cancelled: **no mailbox was created and no personal contact address
  was published**. The shipped pages contain no contact placeholders.
- An old browser service worker initially displayed the game when the support
  URL was first opened. Refreshing once loaded the correct new support page.
  Fresh HTTP checks matched the deployed content.
- Three authentic native screenshots have been captured and visually checked:
  two 6.9-inch iPhone images (classic cascade and dark-mode Mangosteen inspection)
  and one 13-inch iPad landscape image (classic gameplay, score 12). PNG originals,
  opaque JPEG upload copies and capture provenance are in
  [screenshots](screenshots/README.md). **None has been uploaded to App Store
  Connect.**
- The browser file-upload attempt failed with “Not allowed” because the extension
  lacked AllowFileURLs. User permission to enable the file-URL extension setting
  is pending. A generic native Chrome upload fallback was rejected by automatic
  approval review because of the risk of interacting with an unrelated private
  browser window. No upload through that fallback occurred.

## Saved App Store information

- App record **6816024635** exists for `com.franmora.tumblegrove`. The main version
  form has saved promotional text, description, keywords, marketing URL,
  copyright, sign-in-not-required, Support URL and updated App Review Notes.
- The owner authorized use of existing Apple account contact details strictly
  for private App Review. Name, email and phone were entered into Apple only,
  saved, and verified in a screenshot after reload with Save disabled. No private
  contact values are in this repository. Accessibility/DOM snapshots and element
  `.value` readings misleadingly omitted telephone/email values despite the
  screenshot showing them filled; verify the rendered screenshot before treating
  those fields as missing.
- App Information saved the subtitle “A colourful fruit puzzle” and categories
  Games / Puzzle / Casual. The age questionnaire used all listed content absent
  or No, calculated **4+**, and selected Not Applicable rather than Made for Kids.
  Content rights was set to Yes for licensed third-party content. The parent
  form's Saved indicator confirmed these choices persisted.
- The existing per-app Non-Trader status was visible; no new trader declaration
  was made. The availability wizard selected **173 of 175 regions**, excluding
  mainland China and Vietnam, but **this selection has not been saved**. The
  attempt to disable automatic availability in future markets and click Next
  was rejected by automatic approval review because the earlier worldwide-if-
  possible request did not explicitly approve that narrower scope. The future-
  markets option is **not confirmed off**. Explicit approval for the 173 regions
  and future markets off is now pending. Apple's
  [App Information reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information),
  verified 25 September 2026, requires a game approval number for mainland China
  and a game-release licence for Vietnam; no such permits are recorded here.
- The privacy-policy URL and No data collected questionnaire are saved. The
  preview shows **Data Not Collected**. The final Publish confirmation, including
  the legal accuracy/update attestation, awaits explicit owner approval. **App
  Privacy has not been published.**
- With the owner's explicit authorization, developer agreement **XG8DNV4HYY**,
  issued 18 August 2026, was accepted. After reload, Apple showed **Accepted
  25 September 2026** and the update banner was gone.
- The pricing wizard was prepared with UK as the base region, GBP £0.00 and zero
  prices across all 174 comparison currencies. Final Confirm was rejected by
  automatic approval review because the earlier publishing authorization did
  not explicitly specify free pricing. Explicit approval for a free app with
  no ads or in-app purchases is pending. **Pricing has not been saved.**

## Remaining actions

1. Obtain the four pending approvals: free pricing, the browser extension's
   file-URL upload permission, publishing the saved privacy declaration, and
   availability in the 173 proposed regions with automatic future markets off.
2. Upload the three existing screenshots through a permitted file-selection
   path and verify their device-family placement in App Store Connect.
3. Confirm pricing, finish eligible territories and the release choice, publish
   the privacy declaration, and verify the complete version form with build 2.
4. Complete the outstanding physical-device checks. Both task-created test
   simulators are shut down; no user applications were stopped.
5. Submit the completed version for review and record Apple's actual outcome.
   Uploading, selecting a build and publishing privacy details do not constitute
   review submission or public release.

The [submission checklist](submission-checklist.md) retains the earlier audit
and Apple references. This status record supplies newer implementation and test
evidence; assess remaining items against the actual submitted binary.
