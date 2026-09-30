# Native App Store screenshots

## Current build 4 captures

Captured from the running native version 1.0 (4) on 30 September 2026 using
Xcode Device Hub's Screenshot control. These captures are separate from the
historical build-1 images below.

| File | What it shows | Dimensions | Capture time (Europe/London) |
| --- | --- | --- | --- |
| `ipad-13-powers-build4.jpg` | Landscape basket with Fruit powers on, current controls and a dropped Huckleberry | 2752 × 2064 | 30 September 2026, 14:43:21 |
| `iphone-6.9-powers-build4.jpg` | Powers controls and an active basket round with score 11 | 1320 × 2868 | 30 September 2026, 14:52:42 |
| `iphone-6.9-dark-inspect-build4.jpg` | Dark-mode Inspect naming a Greengage, with score 11 | 1320 × 2868 | 30 September 2026, 14:53:42 |

The iPad simulator was **Tumble Grove iPad**, an **iPad Pro 13-inch (M5)**. Its
original capture is `Desktop/Screenshot Tumble Grove iPad 30-09-2026 at 14.43.21.png`.
`ipad-13-powers-build4.png` preserves the untouched PNG; the matching JPEG is a
quality-95 conversion with macOS `sips`, without an alpha channel. No gameplay
state, artwork, score or interface was composed or altered. The JPEG dimensions
and absence of alpha were checked on 30 September.

The iPhone originals were the Device Hub screenshots on the Desktop ending in
`30-09-2026 at 14.52.42.png` and `30-09-2026 at 14.53.42.png`, respectively.
The matching repository PNGs preserve those captures. Their JPEGs were converted
with macOS `sips` at quality 95; both are 1320 × 2868 with no alpha channel.
Both final JPEGs were visually checked: the controls are visible, and dark-mode
Inspect identifies the Greengage. No overlay or compositing was used.

No build-4 screenshot upload has yet been confirmed in App Store Connect. The
supported file-chooser attempt for the 6.9-inch group timed out. After resetting
the automation runtime and reconnecting Chrome, two attempts to attach to the
media-manager tab failed with “Debugger unattached”. The current blocker is the
browser automation connection; a past file-URL permission issue is not confirmed
to be the cause of this failure.

Once the connection is restored, upload the two iPhone JPEGs to the 6.9-inch
iPhone group and the iPad JPEG to the 13-inch iPad group, then verify the
processed previews. A local capture is not proof that Apple received or accepted
the image. The listing metadata and build-4 selection were saved successfully
before the connection failure.

## Historical build 1 captures

Captured on 25 September 2026 from the running Tumble Grove iPhone and iPad simulators
using Xcode Device Hub's Screenshot control. These are historical captures of
version 1.0 (1), not captures of the current build 4.

| File | What it shows | Dimensions |
| --- | --- | --- |
| `iphone-6.9-classic.jpg` | A real basket round and merge cascade | 1320 × 2868 |
| `iphone-6.9-dark-inspect.jpg` | Dark mode and the selected Mangosteen's name | 1320 × 2868 |
| `ipad-13-classic.jpg` | A real landscape basket round with score 12 | 2752 × 2064 |

The PNG files are the original captures. JPEG copies were made with macOS
`sips`, at quality 95, to remove the alpha channel for App Store upload. No
gameplay state, artwork, score or interface was composed or altered for these
images.

The iPad capture was taken at **14:46:07 Europe/London on 25 September 2026**
using Device Hub's Screenshot control. The task simulator was named
**Tumble Grove iPad**, an **iPad Pro 13-inch (M5)** running **iOS 26.5**, with
native build 1. The original file was
`Desktop/Screenshot Tumble Grove iPad 25-09-2026 at 14.46.07.png`.
`ipad-13-classic.png` preserves that capture; `ipad-13-classic.jpg` is its
quality-95 `sips` conversion. Both are 2752 × 2064, with no UI edits.

## Why the old images are being replaced

All three existing JPEGs were visually reviewed against the current game source
on 30 September 2026. Classic play, dark mode and Inspect still exist, and the
fruit artwork remains representative. However, every image shows the older
controls without the Fruit powers switch. The iPhone classic image also uses
the former "3-step cascade" wording. Do not present these files as current
build-4 UI captures or as evidence that build 4 was tested.

Replace them with genuine captures from the running build-4 native app before
uploading the new release's screenshots:

- A 6.9-inch iPhone classic round, with the current controls visible.
- A 6.9-inch iPhone dark-mode Inspect view showing a fruit's name.
- A 13-inch iPad round, using the current native layout.
- If practical, add an iPhone Fruit powers image with a naturally earned power
  or a real targeting preview. This is useful feature coverage, not a substitute
  for the classic-play screenshots.

Use the 6.9-inch iPhone and 13-inch iPad screenshot groups for the corresponding
new files. Preserve original PNG captures and record the build number, device,
capture date and any alpha-removal conversion. Do not composite gameplay or
invent a score. Capture and upload status is recorded above; do not infer an
upload from the presence of a local file.
