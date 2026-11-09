# Owner and employee UX review

9 November 2026. This pass covers the 36 Expo screen files, including Owner/Employee Home, shared Work, and enquiry list/detail variants. The owner should see the next decision and actual progress quickly. Employees should see their assigned work, a clear next action, and whether it is saved or sent.

The changes include compact section navigation, fewer duplicate/empty owner cards, a live review count, searchable operational lists, persistent field guidance, visible password controls, reviewable form values, saved-draft recovery, and feedback after successful actions. Inspection continuation respects assignment, accepted checks, returned work, unsent edits and required media. Photo/video preparation and financial authority remain in their existing application/backend layers.

Native inspection exposed and corrected three shared layout problems: nested form-row inputs could collapse behind buttons; confirmations could cover a footer action; and keyboard-driven layout changes could remount a focused search field. Android keyboard avoidance, stable input placement and a separate feedback area address these cases.

## Evidence

- [Screen coverage](screen-coverage.json): 36 screen files matched to native XML and recognisable labels. This is a screen smoke review, not exhaustive coverage of every branch.
- [Owner display/language checks](owner-layout-verification.json) and [employee display/language checks](employee-layout-verification.json): 150% text, tablet landscape/portrait, English/Hindi/Marathi navigation; original display settings and English restored.
- [Enquiry Back destination](navigation-back-check.json): returns to the enquiry list; sales search input has usable height.
- [Keyboard sign-in](keyboard-sign-in.json): individual credentials accepted, keyboard Go signs in, credentials unchanged. Username Next also focused Password during the native walkthrough.
- [Bundled sources](bundled-source-verification.json): app and shared-package runtime sources compared with the final Android bundle.
- [Installed APK checksums](installed-apk-verification.json), [keyboard search](keyboard-search-verification.json), [offline/reconnect](offline-verification.json) and [final device state](final-device-state.json) passed.

Screen captures were collected during the implementation pass. The final shared fixes were rechecked through the relevant owner/employee journeys; the source and APK checks identify the final installed preview.

## Validation

`npm run check`: 30 mobile tests and 14 Python unit/architecture checks passed, with workspace type checks, Ruff and native-text lint. `npm run format:check` passed. Android native preview packaging and Android/iOS JavaScript exports passed. Native iOS was not compiled in this pass.

The walkthrough checked existing purchase, service, document, custody, booking, delivery, warranty, attendance, payroll and routine views without submitting business or financial commands. The `UXQA` enquiry test was a local-only draft: save, reopen, review, discard. It created no server enquiry. Camera/video options were inspected without uploading new inspection evidence. Demo business records and credentials were retained.

## Human acceptance still required

Representative owner and employee usability sessions, physical phones/tablets, native iPhone/iPad verification, and native-speaker review remain open. Common interface wording was extended to Marathi; older domain wording and configured/stored checklist content still need linguistic review. Stored names, templates, notes and historical facts were not silently translated.

## Selected views

[Owner Home](owner-home-final.png) · [Employee Home](employee-home-final.png) · [Form review](owner-enquiry-form-review.png) · [Draft confirmation](owner-enquiry-draft-cleared.png) · [Owner tablet](owner-pay-tablet.png) · [Employee tablet](employee-inspection-tablet.png) · [Keyboard search](owner-sales-search-keyboard.png) · [Offline work](employee-offline.png)
