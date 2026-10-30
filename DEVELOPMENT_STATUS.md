# Development status

30 October 2026 · Internal development build · Production release gates remain open

The selected **03 Garage** design uses Arihant's website logo, artwork, red/black/white palette and Plus Jakarta Sans. The product has a Python/FastAPI backend, PostgreSQL, adaptive Expo mobile and a React management website. Marketing integration remains excluded. The [spatial inspection plan](docs/SPATIAL_INSPECTION_PLAN.md) now has a working first implementation: vehicle-name search, a comprehensive unapproved inspection draft, section/part navigation and bundled generic 3D cars with drag rotation and red inspection points. Qualified SOP approval, verified India variants and physical-device acceptance remain open.

The responsive review now covers shared actions, forms, cards, tabs, full-check search, calendar/catalogue dialogs and camera controls. Check proof shows Photo and Video together; video opens directly in add mode. The inspection navigator is compact, instructions expand on demand with speech still directly accessible, and custom text sizes receive matching line spacing. [Review evidence](docs/review/responsive/README.md) distinguishes emulator/browser checks from outstanding physical Android/iOS acceptance.

## Working implementation

The [company configuration batch](docs/review/company-configuration/README.md) adds the confirmed two-tier approval policy, rich owner checklist rules, reviewed-document requirements and per-sale warranty configuration. Marathi foundations are connected; complete translation and voice/staff acceptance remain open.

The user has confirmed the current comprehensive checklist as the initial working baseline, to be refined later by the owner. The demonstrated car has 229 applicable checks; this is not a fixed count for every configuration. Owner versioning and rich rule editing are implemented; complete stage-specific template content and acceptance remain pending. See [company decisions](docs/COMPANY_DECISIONS.md).

| Area | Implemented and connected |
| --- | --- |
| Owner workspace | All business / My work / Decisions, stock search, linked attention queue, assignment to self or staff, takeover, explicitly attributed self-review; one owner account throughout |
| Staff identity | Individual company-code/username/password sign-in, salted hashes, login throttling, required first password change, session rotation/revocation, owner-managed reset/offboarding; Employee / Supervisor selection; legacy manager records map to supervisor authority, with owner-only company/account configuration |
| Car and intake | Normalized registration uniqueness, company stock numbers, acquisition cycles, transactional car/checklist creation, QR entry, independent preparation/commercial/custody states, activity history; searchable imported make/model references, manual fallback and observed body/fuel/transmission configuration |
| Inspections | Owner checklist editor with three-language wording fields, ordering, sections/part mapping, proof/measurement/applicability/criticality controls, immutable revisions and explicit approval; four starters plus a 246-definition comprehensive unapproved pre-purchase library; configuration-resolved snapshots, section/part navigation, searchable complete list, generic rotatable sedan/hatchback/SUV schematics with red part dots, measurements, fitted confirmations, reasoned N/A/cannot-inspect states, photo/clip submission gates, replayable speech, help and selected-item fresh-proof rechecks |
| Purchase | Seller/valuation, expected contribution, inspection-linked approval, changed-terms reapproval, checked documents/loan state, agreement reference, exact-paise partial seller payments/corrections, physical receipt creating intake and optional arrival issue |
| Workshops and service | Manual/inspection issues, parallel jobs, workshop/person assignment, requested/received parts, waiting/resume, quote versions and exact-version approval, itemized invoices, vendor payments/advances/corrections, linked photo QC/rework/reopening |
| Readiness and custody | Explainable inspection/purchase/receipt/document/job/hold/custody gates, authorized readiness acceptance, holds, yard/workshop/test-drive/customer movements, custodian acknowledgement, odometer/keys/fuel records |
| Enquiries | Seller/buyer records, assignee, contact history, calendar follow-ups, inspection/viewing/test-drive appointments with date/hour/minute choices, licence acknowledgement, negotiation, won/lost/reopen; no automated external contact |
| Booking and sales | Transactional single active booking, explicit pre-readiness acknowledgement, expiry/extension/cancellation, buyer collections, bounded partial refunds and outstanding refund obligations |
| Delivery and transfer | Final-PDI/payment/document/hold clearance, odometer, signed handover reference, keys/accessories/promises acknowledgement, immutable delivery and issued warranty snapshot, transfer due/follow-up/completion |
| Warranty | Per-sale configurable 3/6/12-month duration, covered components/exclusions/notes and immutable calendar-based issued terms; date/km assessment including unknown mileage, owner/supervisor claim review, explicit goodwill, budget-linked repair/QC, source sale retained; a warranty visit keeps the car commercially sold |
| Documents | Company-private normalized JPEG pages on accessible cars, supervised review, immutable masters/replacements, owner-published document rules, assigned transaction snapshots and actual page/review-based completion gates |
| Money and reports | Immutable integer-paise operating ledger, original-preserving corrections, separate commitments/costs/cash, owner/supervisor stock ageing and balances, totals across all pages, source-car links, authorized CSV export |
| Notifications | Permission-scoped in-app inbox/read state, transactional outbox, durable retries/dead-letter, deduplication, reassignment notices, overdue work/transfer reminders, automatic booking expiry |
| AI foundation | Eight draft capability types, scoped source snapshots/private images, durable bounded jobs, structured fields/source validation, freshness, human accept/reject, English/Hindi spoken review and manual fallback |
| Management website | Stock/dashboard/decisions, inspection evidence review/recheck/takeover, workshop/enquiry/sales/support views, documents, inbox, checklist version review/approval, stock/money reports/export; many operational detail views are currently read-only |
| Mobile reliability | SQLite drafts/cache with separate namespaces and stale-response guards, SecureStore session token, durable command IDs, conflict/version handling, saved navigation/sections, safe areas, keyboard avoidance, focused tabs, English/Hindi calendar date selection, width-based phone/tablet panels and fewer columns at large text sizes |

Training data includes the original two cars, a workshop/repair/part and draft templates. A separate synthetic car, **AC3DTRAINING**, exercises the new comprehensive draft (229 resolved checks for its diesel/automatic configuration). Existing short tasks and recorded progress are preserved. The shared database is not a real dealership ledger. Draft checklists require Arihant approval; development acknowledgements cannot establish production clearance. Financial commands record external payments and do not transfer money.

The catalogue import contains 96 makes and 1,857 model-name references, including 32 source-linked India references. It contains **zero verified variant revisions** and explicitly reports incomplete coverage. It cannot infer a particular car's equipment, year or mechanical limits. See [catalogue provenance](data/vehicle-catalogue/README.md) and [model provenance](data/inspection-models/README.md). The 3D geometry is a generic navigation aid; the checklist and proof records remain authoritative. Other inspection stages retain their earlier draft templates.

Fresh seed cars start commercially available. The original Sonet example had an illustrative booked flag with no booking history; that known training row was corrected with a system event, leaving booking and financial records untouched. Seed consistency and preserving later progress have integration coverage.

## Media implementation and evidence

Photos and scanned pages are normalized **on the mobile device** to JPEG within 1920 × 1080 / 1080 × 1920, preserving aspect ratio without upscaling. Private server admission independently decodes/checks dimensions, orientation, integrity and hashes. Accepted masters remain unchanged.

The local arihant-media Expo module implements Android Media3 and iOS AVFoundation normalization. Videos are prepared on the phone as MP4/H.264, exactly 1280 × 720 or 720 × 1280 **displayed dimensions**, at most 30 fps, maximum 30 seconds / 32 MB. Other aspect ratios are padded; low-detail sources are rejected. The server probes and fully decodes actual bytes before verification. Clips supplement the required per-item photo and answer.

Expo Go supports ordinary photo workflows. Custom video preparation requires the **development client**, built and installed on Pixel_9a. The native multipart uploader streams app-private files without moving full video buffers through JavaScript.

- An actual 1920 × 1080 imported clip was prepared on Android as **1280 × 720 H.264/AAC, 30 fps**, independently inspected before upload, then accepted by the real API. See [prepared](docs/review/android/native-video-prepared.png), [server-verified](docs/review/android/native-video-uploaded.png), [profile](docs/review/android/native-video-profile.json).
- Camera/microphone capture produced a valid portrait 720p clip. Its encoded frame is 1280 × 720 with −90° rotation, giving a displayed frame of 720 × 1280. The private prepared draft survived force-stop/reopen. See [capture](docs/review/android/native-camera-prepared.png), [restored draft](docs/review/android/native-camera-restored.png), [profile](docs/review/android/native-camera-profile.json). This second clip remains an unsent training draft.
- The final encoder rerun again produced 1280 × 720 H.264/AAC at 30 fps, then passed server admission on another training check. Cancelling replacement preserved its draft. A synthetic incomplete-export restart check removed only the partial output and retained saved camera bytes. Explicit stop/replacement/removal controls distinguish preparation from upload.
- Actual document camera capture, on-device JPEG resizing, native multipart upload and server admission passed. Independent decoding/checksum verified **1080 × 1720**. The page is clearly labelled training, category Other and unreviewed. See [evidence](docs/review/android/native-document-profile.json).
- Swift source syntax parses, but **iOS native compilation/device verification have not run**: this Mac has Command Line Tools rather than full Xcode. Android success does not establish iOS encoder, HDR, audio, memory or interruption acceptance.
- General orphan/source retention, full interrupted-encode recovery, low-storage/thermal behaviour and the complete hardware matrix remain open. The current duration/byte limits are development settings awaiting acceptance.

## AI evidence and limits

The local private worker uses qwen3.5:4b through isolated Ollama. AI is disabled in fresh configuration. Output creates reviewable drafts; it cannot approve, post money, pass checks, change stock or execute generated queries. Accepted inspection-note text still needs the normal explicit save action.

Real API checks completed English and Hindi synthetic finding drafts while retaining negation and unknown cause. See [app smoke results](docs/review/ai/app-smoke.json). Image extraction **failed its synthetic quality check** and remains experimental. Typed input and keyboard dictation work, but original-audio push-to-talk/transcription, native OCR/source crops, confirmed task-action previews and representative evaluations across all eight groups remain unfinished. Manual fallback does not complete AI-20.

## Verification and review

Automated coverage includes domain/import boundaries and real PostgreSQL cases for permissions, individual sessions, concurrent bookings/payments/intake, approval versions, inspection snapshots/rechecks, service quotes/invoices/corrections, readiness/holds/custody, delivery/warranty, enquiries, documents, notifications, AI drafts, media admission and report reconciliation. See [verification record](docs/review/VERIFICATION.md) for current results.

Web stock/inspection/report layouts were inspected at desktop/tablet/phone widths without horizontal overflow. See [stock report](docs/review/web/reports-stock-desktop.png), [money desktop](docs/review/web/reports-money-desktop.png), [tablet](docs/review/web/reports-money-tablet.png), [phone](docs/review/web/reports-money-phone.png). Android phone and resized phone-emulator tablet layouts are development checks; **actual iPhone/iPad and Android tablet acceptance remains pending**.

The branded ARM64 internal-preview APK includes JavaScript, cold-launches without Metro and remains installed on Pixel_9a. Its local API connection was checked with port 4100 reversed. [Artifact manifest](docs/review/android/build-manifest.json) records artifact sizes/checksums, currency and package metadata. These builds use the Android Debug signing key. Calendar selection/draft restoration and its 150% text layout were reviewed; original emulator display/font settings were restored.

An offline cold launch retained cached training work and clearly labelled it as saved data. Restoring the emulator API connection and reopening refreshed the work list and removed the notice. See [offline evidence](docs/review/android/preview-offline-check.json). This does not complete offline capture/upload, device restart or token-expiry acceptance.

An isolated restore rehearsal rebuilt representative purchase/payment/delivery/warranty/document histories, restored a PostgreSQL dump into a new temporary database, compared 18 table content digests and verified all 32 referenced media files. It did not overwrite the source database. See [restore evidence](docs/review/restore-rehearsal.json). Scheduled production backups, retention and recovery objectives remain unconfigured.

## Remaining work before full release

- Complete stage coverage and acceptance for the user-accepted initial checklist; refine it later through owner-managed versions. The initial hierarchy, approval policy, per-car warranty options, configurable documents and three languages are confirmed. Acquisition variants, operating volumes and measurable staff/AI/performance targets remain open.
- Complete parts installation/returns/credits/supplier ordering and ETA history; stock cleaning/detailing/periodic assignments; richer workshop and delivery-risk timelines.
- Finish loan-resolution/payment allocations, document expiry, detailed intake reconciliation and approved selling-price/discount/promise handling. Reviewed-document completion gates are implemented for published rules.
- Complete warranty referral/reimbursement/repeat-complaint/customer-resolution flows and confirmed exchange/return/buyback variants. Per-sale duration/coverage administration is implemented.
- Finish management-web action parity, paged operational lists, accounting-definition-based contribution and period/vendor/category reports.
- Finish all eight AI groups/evaluations, accessible audio/visual review, offline instruction packs and staff comprehension testing. Business/payment dates now use a calendar; appointment dates/hours/minutes use choices instead of technical typed formats.
- Complete production identity/recovery/privileged reauthentication, protected cache/retention, object storage, push/preferences/escalation, observability, deployment/migration rollback, scheduled backups and support ownership.
- Verify native media, offline/process/background recovery and accessibility on the agreed physical devices, then produce signed distribution builds and obtain business acceptance.

Production startup is deliberately locked. There is no hosted deployment, signed production release or completed full-release gate. Hosted CI passed for the initial repository and company configuration commits. The configuration review follow-up has local verification; its hosted run is tracked separately. Dependency advisories and test deprecations are recorded in the verification notes.
