# Home and navigation review — 9 November 2026

The owner approved fixing the end-user review findings: nested car menus,
setup-first staff pages, oversized totals/cards, misleading routine/help links
and an unreliable way back to Home.

## Current layout

| Role | Primary navigation and entry |
| --- | --- |
| Owner / supervisor | Home · Cars · Work · Staff · Review; direct car list, named staff work/attendance/pay and personal work without changing accounts |
| Employee | Home · My work · Me; compact attendance, the next real assignment, actual routine/review filters, personal pay/leave/history and a consistently labelled Help action |

The primary bar remains available on ordinary details and becomes a left rail on
wide windows. Keyboard entry uses the available screen space; camera modals and
scanning retain focused capture controls. Home returns directly from nested
records. Existing navigation and user-authored inspection/form drafts retain
separate storage; no app data or demo records were cleared for this review.

Owner Home uses a search field, actionable booking/repair/presence counts,
waiting requests, explicit car next actions and personal work. It no longer
labels all historical cars as a showroom stock total. Staff names and search
precede setup. A named person's Work page retains their identity and links to
their attendance/pay. Owner-only account/policy controls remain scoped.

Employee cards show the car/registration, a plain inspection-stage description,
remaining work or review state, and one action. Pay, leave, routine history,
language/account and updates live under Me. Daily routines selects routines and
To do; sent-for-review selects that list. Work also retains service jobs and
personal portions of shared inspections.

Help opens a real car/check form, preserves context from the inspection, offers
only the person's mutable checks and requires an explicit send. Reassignment,
submission, acceptance and fresh rechecks have client guard coverage; the server
retains authoritative allocation/version checks. No help request was posted
merely by opening the page. General assistance still means speaking with the
owner/supervisor; this does not invent a general support-ticket service.

Buying, seller/buyer enquiries, purchases, bookings/delivery and after-sales
remain in permission-scoped Cars actions and the actual car records. Workshops,
routines, reports, assistant and company/checklist settings remain accessible.
The optional moving-car journey now filters the car list directly. Generic 3D
inspection assets, per-check proof, 720p video and Full-HD photo admission remain
unchanged. Management-web layout was outside this mobile navigation batch.

## Automated checks

- `npm run check`: lint/types, 14 Python domain/architecture checks and **25 mobile logic tests** passed.
- New navigation cases cover direct destinations, explicit Home state, named staff context and role-dependent detail selection.
- New Help cases cover ownership, accepted/submitted checks, reassignment and returned-check eligibility with the current assignment revision.
- Formatting and Android/iOS JavaScript exports passed; the native bundled Android preview built successfully.
- The last complete backend integration run remains **127 passed**; no API, schema or business-rule implementation changed in this batch.

The [implementation checklist](../../NAVIGATION_CHECKLIST.md) records scope and
remaining representative staff / physical-device acceptance. Emulator and
source checks do not establish native iOS/iPad, physical phone/tablet, audio
comprehension or full-release acceptance.

## Final simulator evidence

The final preview is installed on separate Owner and Ravi emulators, retaining
the existing accounts, demo data and drafts. Reviewed:

- [Owner Home](owner-home-final.png), [direct car list](owner-cars.png),
  [named staff search](owner-find-ravi.png), [Ravi's work](owner-ravi-work.png)
  and [review queue](owner-review.png).
- [Employee Home](employee-home-final.png), [compact work queue](employee-work.png),
  [Me](employee-me.png), [actual routine filter](employee-routines-filter.png)
  and [contextual Help](employee-contextual-help.png).
- [Owner tablet landscape](owner-home-tablet-landscape.png),
  [employee tablet portrait](employee-home-tablet-portrait.png),
  [owner large text](owner-home-large-text.png) and
  [employee large text](employee-home-large-text.png).
- [Hindi owner](owner-home-hi.png), [Marathi owner](owner-home-mr.png),
  [Hindi employee](employee-home-hi.png) and [Marathi employee](employee-home-mr.png).

[Journey checks](journey-verification.json),
[check-linked Help](help-verification.json) and
[layout/language checks](layout-verification.json) passed. Both devices were
restored to English, original display size/density and font scale 1.0. Ordinary
detail screens retain their selected primary section, and a named staff work
view retains Staff context. No work, approval, money or help command was posted
during this interface review.

The [source comparison](bundled-source-verification.json) verifies all **101**
bundled app/shared-package runtime sources. [Installed APK checksums](installed-apk-verification.json)
match the [final artifact manifest](../android/build-manifest.json). The preview
uses the development signing key and local API; these results are not production
distribution or physical-device acceptance.
