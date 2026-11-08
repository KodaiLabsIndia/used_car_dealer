# Reusable demo and single-company login — 8 November 2026

The local runnable seed now replaces the prior training business records with a
connected, fictional Arihant demo. [Commands, accounts and scenario walkthrough](../../DEMO_DATA.md).
The old minimal fixture remains isolated under API tests.

## Local data verification

Loaded with `--as-of 2026-11-08`: **11 vehicles, six people, 26 inspections,
2,419 check answers/photos, 80 clips, 27 documents, 240 attendance sessions and
seven salary statements**. The Seltos has 229 applicable checks. The data includes
partial/team/recheck work, purchase approval and seller balances, service/parts/
quote/QC, ready/booked/sold stock, receipts/refunds/corrections, delivery, transfer,
3/6/12-month warranty histories, staff routines, attendance exceptions, leave,
advances and source-calculated salary states.

[Live API verification](live-verification.json) reads all six owner detail pages
for every vehicle, employee financial privacy, supervisor versus owner authority,
allocated office documents, own payroll, source-linked inspection proof and the
zero-token assistant sample. The sample is a fixture, not a provider call.
A downloaded JPEG checksum matches its stored source; seeded clips pass actual
720p admission during construction. [Reference verification](reference-verification.json)
finds no prior sample cars/reference tasks and retains 96 makes/1,857 model-name
references. Verified variants remain absent; these are name references.

An unchanged CLI replay returned `unchanged: true` with the same generation and
counts. Integration cases reanchor to leap day and the first day of a year,
retire previous IDs/media, preserve unchanged edits/sessions, and roll back failed
builds. A post-commit old-file deletion failure preserves the committed data and
new media and emits a warning.

Before local replacement the database snapshot and media were archived privately
under `.data/backups/before-demo-20261108T105901.042897Z/`. The dump and all six
archived media checksums were verified. That archive and generated login secrets
are ignored by Git and are not included here.

## Sign-in

Staff and the owner enter **username and password** on mobile/web. There is no
dealer-code input, alternate training-login toggle or staff-management code panel. The API resolves its single
company and refuses an ambiguous multi-company setup, rather than guessing an
account. Password hashing, failed-attempt throttling, first-change rules, owner
reset/offboarding and revocation remain covered by the identity tests. Internal
database workspace keys are not sign-in inputs. OTP is deferred.

## Automated checks

- Full PostgreSQL integration suite: **127 passed**.
- `npm run check`: lint/types, **14 Python domain/architecture** and **19 mobile logic** checks passed.
- Formatting, web build and Android/iOS JavaScript exports passed.
- Bundled Android preview built; native iOS compilation remains unverified.

## Scope

The demo is local development data and does not transfer money, send external
messages or approve Arihant's real SOP. Media uses clearly synthetic sample cards
and test-pattern clips. Native iOS/iPad builds, physical devices and full-release
acceptance remain open.

## Simulator walkthrough

The two running emulators use the same bundled Android preview. The owner sees
11 cars and ten pending decisions. Reviewed [Today](owner-today.png),
[People](owner-people.png), [Decisions](owner-decisions.png),
[Dealership](owner-dealership.png), [inventory](owner-inventory.png),
[preparation](owner-preparation.png) and [inspection work](owner-inspections.png).

Ravi's [pay](employee-my-pay.png), [work queue](employee-my-work.png) and
[allocated inspection](employee-inspection.png) display their linked demo
records. His portion has **69 of 229** checks, with 12 accepted and four ready to
submit; other employees' portions remain on the master inspection. No check,
payment, approval or routine was posted during this read-only review.

[Simulator check record](simulator-verification.json) records role navigation,
final two-field sign-in and absence of fatal JavaScript/Android errors. The
[blank login](owner-login.png) contains no dealer-code or training-login option.
Old demo app data was cleared before fresh sign-in. Both simulators are left
signed in to their respective Owner/Ravi accounts. The
[bundled source comparison](bundled-source-verification.json) verifies all 95
bundled app/shared-package runtime sources; the [artifact manifest](../android/build-manifest.json)
records the matching APK. These are emulator checks, not physical-device or native
iOS/iPad acceptance.

## Showroom terminology

App labels, Hindi/Marathi wording, new-car defaults, attendance location warnings
and the reusable demo now use **Showroom**. The current demo's five showroom
location labels were updated, and the opening routine received a new named
revision. Existing started routine snapshots, work events and finances remain
intact. The internal custody identifier retains its compatible value; its visible
label is Showroom. Lint/types/unit checks and the existing attendance-location
integration test passed.
