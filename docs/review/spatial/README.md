# Spatial inspection development review

30 October 2026. Synthetic training data only; not business or physical-device acceptance.

Open **AC3DTRAINING** from My work. Its diesel/automatic SUV configuration
resolves 229 checks from the 246-definition unapproved pre-purchase library.
Older short training tasks are preserved. Sections are the default entry;
each section groups checks by part. The 3D car, complete searchable list,
camera, result and owner review use the same task/item IDs.

## Verified paths

- The installed bundled Android preview renders the replacement CC0 car asset.
  Drag changes actual camera orientation without opening a check. Front resets
  it after a manual drag, including when Front was already the selected preset.
- Red dots use native touch targets. Overlapping points form a numbered group;
  the part picker retains every linked component. Choosing Bonnet opened its
  actual scoped body check. See [part picker](nearby-part-picker.png),
  [linked check](part-checks-phone.png) and
  [interaction record](native-interaction-verification.json).
- A drag beginning directly on a red group also rotates without opening the
  picker. Native point targets stay mounted during the gesture; their visuals
  hide until release, then refresh at their new projected positions. Front
  returns to the starting view. The current app process has no recorded
  AndroidRuntime or ReactNativeJS errors in [runtime review](runtime-errors.json).
- Searching the complete list reached check 66, front-left measured tread.
  The emulator captured a synthetic image, normalized it on the phone and saved
  a **4.2 mm test reading** with an explicit synthetic note. Independent download
  confirmed a **1080 × 1720 JPEG**. Only one training answer was saved; the
  inspection was not submitted. See [proof record](mobile-proof-verification.json).
- Section/part progress reflected that answer as 1/229 overall, 1/32 Wheels
  and 1/7 front-left wheel. See [sections](sections-final-phone.png) and
  [part checks](section-parts-phone.png).
- The management website opened all 229 checks, searched to the measured item
  and fit desktop/tablet/phone widths. See [browser record](web-verification.json).

## Implementation and acceptance limits

The source and deterministic asset conversion are in `data/inspection-models/`.
These are generic body families, not a Kia Sonet model or manufacturer geometry.
Internal systems use schematic anchors. Pinch controls exist but have not been
accepted on physical hardware. TalkBack, VoiceOver, staff comprehension, actual
iPhone/iPad/Android tablet performance and complete interruption acceptance are
still open. Android/iOS JavaScript exports do not establish native iOS support;
full Xcode is absent from this Mac.

The renderer loads only in the active foreground map and renders on demand.
Direct view buttons and the sectioned list offer alternatives to gestures.
An orientation review found a stale Expo GL drawing buffer; the renderer now
recreates its context from measured viewport dimensions after layout changes.
Final portrait/landscape screenshots and restoration status are recorded in
`layout-verification.json`. Window overrides are not physical tablet tests.

`car-map-initial.png` and `car-map-front.png` show the rejected procedural
prototype. They are historical evidence, not the replacement model.
`orientation-bug-landscape.png` reproduces the subsequently corrected resize
failure and is also historical. Source
matching for the installed preview is in `bundled-source-verification.json`;
APK fingerprints are in `../android/build-manifest.json`.

The catalogue has 96 makes, 1,857 model-name references, 32 source-linked India
references and zero verified variants. Qualified SOP approval, verified India
variant/equipment coverage, complete stage templates, parallel zone assignments
and full-release gates remain open.
