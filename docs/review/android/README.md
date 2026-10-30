# Android development review

Captured in Pixel_9a on 30 October 2026. Earlier images use Expo Go 58.0.5; native video/checklist/report images use com.arihantcars.operations, the custom development client.

- `garage-owner.png`, `night-drive.png`, `guided-check.png`: original owner foundation smoke checks.
- `intake-phone.png`: current intake flow at the emulator's original display size/density.
- `intake-tablet-portrait.png`: 1600 × 2560 px, density 240 (about 1067 × 1707 logical units).
- `intake-tablet-landscape.png`: 2560 × 1600 px, density 240 (about 1707 × 1067 logical units).
- `purchase-phone.png`, `purchase-tablet-portrait.png`, `purchase-tablet-landscape.png`: purchase valuation at the same phone/tablet viewports.
- `purchase-training-valuation.png`: filled training proposal, before saving through the mobile form.
- `purchase-review-phone.png`, `purchase-review-tablet-landscape.png`: saved sample proposal with the correct ₹65,000 forecast and inspection gate. Approval and payment were not performed on this sample; those commands have isolated PostgreSQL integration coverage.

The tablet images use temporary window overrides on the phone emulator to inspect responsive layouts. Display overrides were restored. Navigation restoration was verified after resize-triggered reloads. These are not iPad or actual Android tablet hardware tests. Expo Go's floating Tools control is development UI.

See the root development status for remaining platform, media and business acceptance work.

## Native media and current workspaces

- native-video-prepared.png / native-video-uploaded.png: 1920 × 1080 import prepared privately as 1280 × 720 H.264/AAC and then server verified. native-video-profile.json independently inspects the prepared file before upload.
- native-camera-prepared.png / native-camera-restored.png: camera/microphone clip prepared privately, retained after force-stop/reopen. native-camera-profile.json shows encoded 1280 × 720 with −90° rotation, displaying as portrait 720 × 1280. This clip remains an unsent training draft.
- native-final-video-profile.json / native-final-video-uploaded.png: another 1080p import after the final native threading changes, independently probed as 1280 × 720 H.264/AAC, 30 fps, 3.008 seconds, then server verified. Cancelling the replacement confirmation retained this prepared clip.
- native-recovery-check.json: synthetic partial-export cleanup after force-stop/reopen; existing source and prepared camera bytes remained unchanged.
- native-document-uploaded.png / native-document-profile.json: actual camera capture, local JPEG resizing and native multipart upload. Independent decoding/checksum verified 1080 × 1720; category Other, explicitly labelled training, unreviewed.
- reports-balances-phone.png: focused Stock / Costs / Payments / Balances workspace.
- checklists-phone.png: owner bilingual checklist review with fixed previous/next check actions.
- checklist-draft-v2.png: an unapproved training Delivery PDI version 2 saved through the owner mobile editor; draft survived an APK update/restart before saving.
- calendar-phone.png: date-only calendar with named months and accessible full-date day labels. Month navigation/selection and restoring the selected date in an unsubmitted local cost draft were exercised. No financial command was submitted.
- calendar-large-text.png / calendar-large-text-check.json: bundled calendar at 150% system font size, inspected visually with month/day controls present; original font setting restored.
- appointment-picker-phone.png / appointment-picker-check.json: bundled date/hour/minute selection in an unsubmitted draft. Synthetic contact was closed from follow-up; no real appointment or external message created.
- preview-launcher.png: actual Android launcher artwork derived from the existing website logo, with no new logo drawn.
- preview-camera-ready.png: final bundled preview's camera readiness/framing guide after removing unsupported CameraView nesting.
- build-manifest.json: final APK sizes/checksums and package/SDK metadata. Internal preview cold-launch and local API access succeeded with Metro forwarding removed; development APK was also refreshed.
- preview-offline-work.png / preview-owner-work.png / preview-offline-check.json: cached training work after a backend-disconnected cold launch, clear saved-work notice, then fresh work after API forwarding was restored. No business command submitted; full offline capture/upload acceptance remains open.
- preview-owner-garage.png: final owner overview, zero bookings, with only local API forwarding retained. training-fixture-correction.json records the audited correction of the old illustrative booking flag; no booking/financial record changed.
- checklists-tablet-portrait.png / checklists-tablet-landscape.png: responsive checklist list with side navigation in temporarily resized windows; original physical display configuration restored.

No real seller/customer document or operational inspection approval was created for these visual checks. iOS native compilation/hardware, real Android tablets and the complete media interruption/storage/thermal matrix are outstanding.
