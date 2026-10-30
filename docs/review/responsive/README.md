# Responsive layouts and check media

30 October 2026. Internal development verification; production acceptance remains open.

Shared action rows now wrap whole controls at their intrinsic label widths. Short Photo/Video/Gallery labels retain descriptive accessibility labels. Narrow-screen footers flow with the task, and car identities keep a compact row; enlarged text gets the width released by hiding the decorative thumbnail. Proof/result pages are bounded to 800 dp on tablets.

Paired fields stack when the width or system text size needs more room. Car cards reflow their image/details, tabs size from their label content, and cramped workspaces use a section selector. Short or large-text windows keep context and actions in the content scroll. Calendar, catalogue and check-search dialogs retain scroll access, and camera controls move beside the preview in landscape.

Inspection proof exposes Photo and Video for each check. Camera/gallery entry, check-specific required video rules, the mandatory photo/result gates, local draft retention and preparation-before-upload remain in effect. Read-only tasks retain review access. The check navigator uses compact hierarchy rather than an oversized generic button; instructions expand on request and can be heard directly. Shared text line spacing follows its font size.

`media-verification.json` records an emulator camera clip added to **AC3DTRAINING**, check `front_left-tread`. The existing photo/4.2 mm synthetic answer remains; no real car was inspected and the task is unsubmitted. The downloaded file independently decodes as H.264 1280×720 with a −90° display matrix (720×1280 presentation). Its variable-timestamp average is about 29.2 fps; the container's nominal `r_frame_rate` is not its average.

`web-matrix.json` records all ten management navigation pages at 320, 360, 768, 1024 and 1440 CSS pixel widths, plus a 320 px/200% CSS zoom stress case. Tables intentionally scroll inside their containers. These browser simulations do not establish physical device acceptance.

`mobile-matrix.json` records the initial six profiles; `mobile-final-recheck.json` repeats the final 320 dp normal/200% layouts after the footer/banner correction. Matching screenshots record Android emulator window/font overrides. Original 1080×2424, density 420 and font scale 1.0 must be restored. Native iOS/iPad builds, physical Android phone/tablet testing, keyboard/screen-reader acceptance and staff walkthroughs remain release gates.

The final preview was also reviewed through Settings, Reports, People & access, English/Hindi proof and filters, work cards, intake, and the catalogue with its keyboard open. These passes changed no business records. The six-profile check navigation/filter/camera matrix and final 320 dp correction checks are separate from these representative screen reviews.

Final content-sized tabs were rechecked after the earlier measured-width implementation was removed: all four report tabs share one row, and the compact Hindi proof tab is visible, with Photo and Video as separate actions inside. `final-visual-review.json` records the final screen checks and restoration.
