# Tumble Grove for iPhone and iPad

This SwiftUI app includes the complete game in a `WKWebView`, with no remote
game-code downloads. It is separate from the Safari Home Screen app. See the
[release status](../docs/app-store/release-status.md) for completed checks and
remaining submission work; an exported IPA does not mean an App Store release.

## Build the bundled game and Xcode project

Run these commands from the repository root. Requirements: macOS, a current
Xcode with an iOS SDK and installed simulator runtime, Node 22.13 or newer,
and XcodeGen 2.42 or newer. The local build was checked with Xcode 27 and an
iOS 26.5 simulator. Choose the full Xcode developer directory rather than
Command Line Tools when building iOS.

```sh
export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
npm ci
npm test
npx tsc --noEmit
npm run build:ios
npm run ios:project
```

`npm run build:ios` compiles for Safari 17, generates licence notices, copies the
app icon, and writes the complete game to `ios/TumbleGrove/Web/`. It removes the
service worker and web manifest, and records resource hashes in
`bundle-manifest.json`. It does not overwrite the GitHub Pages build.
`TumbleGrove/Web/` is a folder resource: retain its subdirectories intact.

Run `build:ios` after any game or public-resource change, and `ios:project` after
changing `project.yml`. Generated web resources, derived build output, archives,
IPAs and personal Xcode state are ignored by Git.

`project.yml` is the source of truth for XcodeGen. The app target is
`TumbleGrove`, deployment target iOS 17, bundle ID `com.franmora.tumblegrove`,
version 1.0 / build 1. Signing uses automatic provisioning for team 8XX87M89M2.
The signing identity and App Store app record must match before distribution.
Increase `CURRENT_PROJECT_VERSION` before uploading another build after Apple
has accepted a previous build with the same version and build number.

## Run and test in Simulator

List available simulators, then use the UDID of the desired iPhone or iPad:

```sh
xcrun simctl list devices available
export TUMBLE_SIMULATOR_ID="REPLACE_WITH_AVAILABLE_SIMULATOR_UDID"
xcodebuild \
  -project ios/TumbleGrove.xcodeproj -scheme TumbleGrove \
  -configuration Debug -destination "id=$TUMBLE_SIMULATOR_ID" \
  -derivedDataPath ios/build/DerivedData \
  CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "$TUMBLE_SIMULATOR_ID"
xcrun simctl bootstatus "$TUMBLE_SIMULATOR_ID" -b
xcrun simctl install "$TUMBLE_SIMULATOR_ID" \
  ios/build/DerivedData/Build/Products/Debug-iphonesimulator/TumbleGrove.app
xcrun simctl launch "$TUMBLE_SIMULATOR_ID" com.franmora.tumblegrove
```

Skip `simctl boot` if the selected simulator is already booted. Open Simulator
to interact with the app, or open `ios/TumbleGrove.xcodeproj` in Xcode and Run.

Run the native regression tests with a new results path each time:

```sh
export TUMBLE_TEST_RESULTS="ios/build/NativeTests-$(date +%Y%m%d-%H%M%S).xcresult"
xcodebuild \
  -project ios/TumbleGrove.xcodeproj -scheme TumbleGrove \
  -configuration Debug -destination "id=$TUMBLE_SIMULATOR_ID" \
  -derivedDataPath ios/build/DerivedData \
  -resultBundlePath "$TUMBLE_TEST_RESULTS" \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO test
```

The six tests cover gravity transforms, flat-device readings, safe bundle paths,
ordinary web-link routing, and symlink rejection. Test on a physical device for
motion permission and all tilt directions; Simulator has no motion sensor.
Also check offline first launch, background/foreground without losing a round,
portrait/landscape layouts, Help sheets, dark mode and sustained play.

## Archive and export

Xcode must be signed in to an Apple developer account that can provision this
team and bundle ID. These commands create a signed archive and **local** IPA;
they do not upload or submit anything. Rebuild the bundled web game first when
its source has changed.

```sh
xcodebuild \
  -project ios/TumbleGrove.xcodeproj -scheme TumbleGrove \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build/ArchiveData \
  -archivePath ios/build/TumbleGrove.xcarchive \
  -allowProvisioningUpdates archive
```

Create the ignored local export-options file:

```sh
cat > ios/ExportOptions.local.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>teamID</key><string>8XX87M89M2</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>stripSwiftSymbols</key><true/>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST
xcodebuild -exportArchive \
  -archivePath ios/build/TumbleGrove.xcarchive \
  -exportOptionsPlist ios/ExportOptions.local.plist \
  -exportPath ios/build/AppStore \
  -allowProvisioningUpdates
```

The exported file is `ios/build/AppStore/Tumble Grove.ipa`. Inspect the generated
`DistributionSummary.plist` and `Packaging.log` before uploading through Xcode
Organizer or Transporter. Upload, Apple processing, version selection, review
submission, approval and public release are separate steps. Follow the
[App Store checklist](../docs/app-store/submission-checklist.md) and verify all
account facts and the final binary rather than treating local export as approval.

## Offline and navigation architecture

The `tumblegrove://game/` scheme handler only reads immutable bundled files.
It validates the origin, rejects traversal and every in-bundle symlink, serves correct
module MIME types, and prevents remote subresources through a content security
policy. The main game does not navigate to web pages. Bundled reference pages
open in a separate sheet with Back and Done controls and no native bridge or
JavaScript. User-activated HTTP/HTTPS reference links open in the system browser;
arbitrary URL schemes are rejected. Credits and fruit-size references are
bundled. Privacy and support pages remain drafts and are not yet linked in Help;
complete those before submission.

There is no native service-worker registration, web install status, or web update
prompt. App Store updates replace bundled resources; the GitHub Pages release
path remains independent. A first launch requires no game download.

## Motion and lifecycle bridge

The native bridge implements the contract in `app/native.ts`: `beginTilt` and
`endTilt` commands; `tumblegrove:tilt`, `tumblegrove:tilt-error`, and
`tumblegrove:lifecycle` events. Only the trusted main game frame can send
commands. Core Motion runs only after opt-in, stops while inactive or while a
document sheet is open, and resumes only if the player had enabled it. Gravity
is transformed using the current interface orientation, respecting rotation
lock. Returning to the app does not reload the current round. The first valid
motion sample acknowledges a successful Gravity-mode request. Unavailable
sensors or errors return `tumblegrove:tilt-error`, preserving Classic play.

If WebKit's process is terminated, a recovery screen explicitly offers a new
round instead of silently erasing the board. Stored best scores remain intact;
the current round is not persisted across a process restart.

## Local data and privacy

Best scores, appearance and lineup history use WebKit local storage. The native
shell does not directly use UserDefaults or any required-reason API, collect
data, track users, or send motion readings off the device. Its privacy manifest
therefore declares no tracking, collection, or accessed API categories. Re-audit
this declaration when adding native APIs or third-party SDKs. A reference website
opened in the system browser is subject to that site's policies. Do not commit
credentials, signing private keys or private App Review contact information.
