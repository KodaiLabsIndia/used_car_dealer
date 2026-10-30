# Development verification — 30 October 2026

These are local development results, not full-release acceptance. The initial repository and company configuration commits passed hosted CI. The review follow-up has local verification; no production deployment or physical iOS/tablet acceptance has occurred.

| Check | Latest result |
| --- | --- |
| npm run check | Passed: Ruff, native literal-text placement lint, TypeScript in all client workspaces, 14 Python domain/architecture tests and 13 mobile logic tests |
| npm run test:integration | **80 passed** against real PostgreSQL in isolated random schemas; includes configuration-resolved comprehensive snapshots, measurements, reasoned exceptions, fresh required clips, urgent critical findings and catalogue import/search |
| Contracts | Python OpenAPI regenerated; shared validators/generated types pass compile-time parity |
| Android native | Development and bundled internal-preview APKs built/installed; local Media3 module compiles; camera/mic/import/720p preparation, native document upload and verified video upload exercised |
| iOS source | Swift syntax parses; no native compile/device run because full Xcode is absent |
| JavaScript/web bundles | Android/iOS Expo exports and Vite build passed, including final mobile source changes |
| Migration | Local Alembic schema is at 0021; clean-schema integration tests apply all 21 SQL migrations |
| Restore rehearsal | Source left intact; isolated restored DB dropped; 18 table content digests and 32 referenced private files matched |
| Dependency advisory check | 8 findings: 5 low, 3 high, through Expo/development tooling; none critical; no forced incompatible override applied |

## Media evidence

See [Android review notes](android/README.md), actual [import profile](android/native-video-profile.json), [final encoder rerun](android/native-final-video-profile.json) and [portrait camera profile](android/native-camera-profile.json). A 1080p source became verified 720p before upload. Camera/microphone recording and a prepared draft surviving force-stop were checked. API tests use real encoded clips and reject oversized/wrong-codec/corrupt media and unauthorized access. A supplemental clip cannot replace a required photo/result.

The native Android encoder now reserves one operation before inspecting, reads input/output metadata on a bounded worker, confines Transformer to its required looper and invalidates cancelled-operation callbacks. A [restart rehearsal](android/native-recovery-check.json) removed a synthetic incomplete export while the original and prepared camera draft remained byte-for-byte unchanged. Complete interruption/storage/HDR/device acceptance remains open.

An actual camera page passed on-device JPEG normalization, native multipart upload and API admission. Independent decoding found 1080 × 1720; the server checksum matched and the synthetic page remains unreviewed. See [document evidence](android/native-document-profile.json). It is labelled “Training capture QA - not a real document”, category Other.

Two resource-cache regression tests exercise switching record identity during a delayed local read and cancelling a late network response. Responses use a versioned cache namespace separate from user-authored drafts; retiring old caches does not discard drafts.

## Interface review

- Web stock, inspection and report screens: 1600 px desktop, 1024 px tablet and 430 px phone windows; no horizontal overflow or runtime errors in the reviewed paths.
- Web checklist versions/review: same three widths, four starter versions visible, no runtime errors/overflow; no checklist approved during visual review.
- Android checklist list/review and focused report tabs: phone plus temporarily resized tablet portrait/landscape windows. Original display settings restored. These are layout checks, not actual tablet hardware acceptance.
- An owner created an unapproved Delivery PDI revision 2 through the mobile editor after its local draft survived an APK update/restart. Training changes were not accepted as business approvals.
- Date-only business/payment forms use an English/Hindi calendar. Android month navigation and selecting 29 October, closing and reopening the cost draft retained the date without posting a cost. See [calendar](android/calendar-phone.png).
- Appointment forms now use calendar/hour/minute choices, retaining the existing local-clock/ISO conversion and server validation. The bundled app selected 31 October, 9 am, minute 15 in a draft. No appointment was submitted; the clearly synthetic contact was closed to prevent follow-up reminders. See [picker](android/appointment-picker-phone.png) and [check record](android/appointment-picker-check.json).
- The bundled-preview calendar was inspected at 150% system text size: month/day controls remained accessible and readable; the original system font setting was restored. See [large text](android/calendar-large-text.png) and [check record](android/calendar-large-text-check.json). This does not complete accessibility or staff comprehension acceptance.
- Runtime review found and fixed a stray text child in the sales workspace and moved the camera framing overlay beside the native CameraView, which does not support child views. The mobile JSX audit found no other explicit string children outside Text components.
- The optional Night Drive and system reduced-motion support remain. A standalone motion study was browser-checked but subsequently superseded by the owner's request for complete data-led spatial inspections. Its [browser evidence](motion/browser-verification.json) is historical prototype evidence only. The [current plan](../SPATIAL_INSPECTION_PLAN.md) now has an initial data/3D implementation; it does not establish business or physical-device acceptance.
- Synthetic **AC3DTRAINING** has 229 resolved draft checks, separate from the older short training tasks. Mobile uses section cards, part groups and a complete searchable sectioned list. Generic car assets are bundled CC0 Quaternius meshes, with conversion/provenance in `data/inspection-models/`. Drag rotation and single-part red-dot navigation were exercised on Pixel_9a; nearby-point grouping and view-reset verification are recorded with the final spatial screenshots. Historic `car-map-initial.png` and `car-map-front.png` show the rejected procedural renderer and are not evidence of the replacement design.
- Management-web review of the 229-check task passed at 1440 × 1040, 1024 × 768 and 430 × 932. All check buttons were reachable, the measurement search found the intended check and no horizontal overflow or runtime errors appeared. See [browser check](spatial/web-verification.json).
- The final spatial preview passed portrait → landscape → portrait window changes after fixing a stale native GL drawing buffer. Car geometry stayed inside the measured canvas and a landscape rear-wheel dot opened its seven scoped checks. The 150% text section grid reflows to two columns. Original 1080 × 2424 / density 420 / font scale 1.0 settings were restored. See [layout record](spatial/layout-verification.json); these remain emulator checks.
- An actual emulator camera capture on AC3DTRAINING's measured tread check was normalized on-device, uploaded and saved with a synthetic 4.2 mm reading and explicit QA note. Download/decode verified a 1080 × 1720 JPEG. Overall/section/part counts changed to 1/229, 1/32 and 1/7 respectively. The inspection remains unsubmitted; no real tyre was measured. See [proof record](spatial/mobile-proof-verification.json) and [spatial review](spatial/README.md).

## Installable Android artifacts

The [internal preview](../../artifacts/ArihantCars-internal-preview.apk) includes bundled JavaScript and is installed for review. The separate [development client](../../artifacts/ArihantCars-development.apk) requires Metro; artifact currency is recorded in the manifest. The installed preview cold-launched and reached the local API with only port 4100 reversed; Metro port 8081 forwarding was removed. The ordinary launcher entry uses the existing website logo. Its signature verifies as the Android Debug certificate, not an organization-owned production certificate.

Native spatial integration exposed two compatibility defects that were corrected: Metro now resolves Three's browser ESM entry instead of its Node-oriented CommonJS entry, and a reproducible Expo config plugin keeps Expo GL's native constructors in optimized Android builds. R8 remains enabled. These fixes were exercised in an installed bundled preview; a JavaScript-only export would not catch the constructor failure.

Both APKs now include the native Expo GL library. The preview bundles the current inspection source and generic model assets; the development client loads JavaScript through Metro. See [source comparison](spatial/bundled-source-verification.json) and [artifact fingerprints](android/build-manifest.json).

The selected date survived a development-to-preview APK update. [Build manifest](android/build-manifest.json) records artifact size, SHA-256, package/version, ARM64 architecture and minimum/target SDK. The [launcher](android/preview-launcher.png) and [corrected ready camera](android/preview-camera-ready.png) were checked in the installed preview. These APKs still need the configured development backend.

A bundled-preview owner work-list restart with emulator API forwarding removed retained cached training work and displayed “Showing saved work. Refresh when connected.” Restoring forwarding and reopening refreshed the work list and removed the notice. See [offline screenshot](android/preview-offline-work.png), [online screenshot](android/preview-owner-work.png) and [check record](android/preview-offline-check.json). No business command was submitted. This is a cached-read/restart check, not full offline media/upload acceptance.

The original foundation seed marked Sonet booked without a booking record. Fresh seeds now start available; rerunning seed still preserves later progress. The known existing training row was corrected only after checking the training company and zero booking history, with an append-only system event. No booking or financial record changed. See [correction record](android/training-fixture-correction.json); the final [Garage overview](android/preview-owner-garage.png) shows zero booked cars.

## AI evidence

[Real API text smoke](ai/app-smoke.json) completed English/Hindi synthetic reports with negation and unknown cause retained; operational answers were unchanged. [Vision smoke](ai/local-smoke.json) failed with incomplete model output. Other model smoke files document exploratory runs, not an accepted quality benchmark. Representative inspection/document/speech evaluation across all eight groups remains required.

## Limits and release dependencies

Real business templates/policies, staff comprehension and language acceptance, the physical device matrix, production storage/identity/recovery, retention, signed organization-owned builds, deployment and all full-release gates remain open. A debug-signed development/internal preview APK is not a production distribution artifact. Manual fallbacks and synthetic tests do not complete missing AI or business workflows.

The Python suite emits one installed Starlette/httpx test-client deprecation warning. Android builds emit upstream Gradle deprecations. Expo Doctor reports 19/20 checks: the remaining generated-native/app-config warning is addressed operationally by the build script always running Expo prebuild; it is not represented as a passed doctor check.


## 30 October: responsive layouts and per-check media

Shared mobile actions, paired fields, car cards, tabs, modal lists, calendar headings and capture controls now reflow with available width and system text. Inspection Photo/Video entry is visible on each check. The follow-up review replaced oversized check navigation, shortened media labels with descriptive accessibility labels, bounded tablet proof content, and moved narrow/large-text footers into the content scroll. Instructions expand and remain directly available through speech.

[Responsive review evidence](responsive/README.md) includes the six-profile Android emulator matrix, final narrow-phone rechecks, all-ten-page web viewport/zoom matrix, and decoded synthetic clip verification. The existing Full-HD-limited photo and the new 720p clip coexist on AC3DTRAINING check `front_left-tread`; the inspection remains unsubmitted. Final lint, TypeScript, unit tests, formatting, Android/iOS JS exports, web build and Android preview build passed. Physical phone/tablet, native iOS/iPad, accessibility and staff acceptance are still open.


## Company configuration batch

See [the implementation review](company-configuration/README.md) for two-tier
financial authority, continuation during pending review, richer owner inspection
rules, reviewed-document policy snapshots and per-sale warranty duration/coverage.
The final full integration suite passed 80 tests, including the private-work
access guard and three finalized/open legacy-stage regressions. Local lint/types, 14 Python tests,
13 mobile tests, both platform JavaScript exports and web/native Android builds
passed. Marathi remains partial and physical-device/staff acceptance remains open.
