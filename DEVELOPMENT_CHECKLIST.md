# Arihant Cars — full-release development checklist

Version 1.4 · 30 October 2026 · Development and release tracker

Build one complete release covering dealership operations, owner participation, Android/iOS apps, the management web dashboard, offline evidence capture, and the lightweight AI features discussed. Development proceeds through internal milestones; all included modules must meet the release gates before production launch.

References: [operations plan](ARIHANT_OPERATIONS_PLAN.md) · [AI and mobile proposal](ARIHANT_AI_MODERNIZATION.md) · [architecture decisions](ARCHITECTURE_DECISIONS.md) · [inclusive UX specification](INCLUSIVE_UX.md)

## Scope and tracking rules

- Included: seller/buyer enquiries entered in this app; inspections; purchase; intake; repairs, workshops, and parts; QC/readiness; stock custody; costs/payments; sales/booking; delivery; transfer follow-up; warranty; owner/staff workflows; AI capture/review/query assistants; phone capabilities; production readiness.
- The owner has full company-wide business access and can perform manager, supervisor, inspector, coordinator, and sales work through the same account. Delegation and focused views preserve that visibility.
- Core employee tasks must work with minimal reading through visual examples, spoken guidance, large controls, voice/structured entry, and help. Validate this with actual staff across reading and digital-skill levels.
- Videos are exactly 720p and photos fit within Full HD, including portrait equivalents. Mobile normalization and output verification happen before upload; the server independently rejects violations. ADR-04 is the authoritative media policy.
- All eight AI capability groups are in this release: voice logging, scan-to-fill, guided evidence, owner briefs/questions, quote/invoice assistance, voice task creation, before/after review, and delivery/warranty briefs. Their build order does not move them to another release.
- Marketing-app exchange remains deferred. External workshop accounts, a public customer app, automated bank payments, and full accounting-system integration retain their previously proposed later scope. Staff coordinate external workshops in this release.
- Automated mechanical diagnosis, AI damage/valuation scoring, specialized sensor accessories, and autonomous agent workflows are outside the agreed lightweight direction.
- Checked items below have implementation/verification evidence in the progress register and linked status documents. Broad items stay open when only part is implemented. Keep IDs stable; planning documents alone do not establish completion.
- For implementation items, “done” means the backend and applicable screens work together, changes persist, permissions apply, errors/offline states are handled where relevant, and appropriate checks pass. A screen mockup or unconnected API is not sufficient.
- Record dependencies or missing business input beside the affected ID. Continue independent work while those inputs are resolved. Do not invent Arihant policies or mark unknown decisions complete.

## Internal milestones and dependencies

| Milestone | Main checklist groups | Depends on | Exit evidence |
| --- | --- | --- | --- |
| M1: Define release and screens | DEC, UX, ARC | Existing plans | Decision record, inclusive journeys, architecture, screen map, acceptance targets |
| M2: Establish working foundations | ENG, ARC, IAM, CAR, CAP | M1; capture/device feasibility can start early | Working mobile/web/API, owner/staff access, car record, on-phone 720p/Full-HD processing and durable evidence upload |
| M3: Complete inspection-to-readiness | INS, PUR, SRV, STK, FIN | Relevant M2 foundations | Car inspected, bought, repaired, costed, reviewed, and made ready |
| M4: Complete commercial and after-sales workflows | SAL, DEL, WAR, OWN | Relevant M2/M3 records | Booking through delivery and warranty, with owner visibility/actions |
| M5: Integrate all lightweight AI features | AI | CAP and relevant business records; provider evaluation starts during M2 | All eight assistant groups working in their real workflows |
| M6: Validate the complete release | QA, OPS | M2–M5; tests and operations work also run during implementation | Full acceptance evidence, device results, recovery rehearsal, staff walkthrough |
| M7: Launch | REL | Release gates passed | Signed builds, production deployment, verified operation, handover |

## 1. Business decisions and acceptance criteria — DEC

- [ ] DEC-01 Record the single-release scope above, screen/module inventory, explicit exclusions, and the change-decision process.
- [ ] DEC-02 Confirm branches, yards, staff, workshop network, stock volumes, concurrent users, and expected daily media volume.
- [x] DEC-03 Apply the confirmed two-tier family-business hierarchy: Owner/Supervisor and Employee. All work is logged; non-financial work continues during pending review; spending/financial commitments require one approval from owner or authorized supervisor. No separate manager tier or individual supervisor amount limits for now. Align reviewer assignment, UI and server permissions; see [company decisions](docs/COMPANY_DECISIONS.md).
- [ ] DEC-04 Use the current comprehensive checklist as the confirmed initial baseline (229 checks in the demonstrated configuration), with later refinement controlled by the owner. Complete owner configuration and stage-specific pre-purchase, intake, repair-QC and delivery-PDI templates/versioning. A separate existing Arihant SOP is not a prerequisite to continuing; see [company decisions](docs/COMPANY_DECISIONS.md).
- [ ] DEC-05 Define each checklist item's applicability, evidence type, measurements, severity, pass/fail rules, and not-applicable review requirements.
- [ ] DEC-06 Define supported acquisition/sale types, including whether consignment and wholesale are required; specify supported exchange, cancellation, return, and buyback handling.
- [ ] DEC-07 Use standard starter document checklists configurable by the owner (stage, items, applicability, required/optional status), bound to actual uploaded/reviewed evidence. Complete purchase handover, seller payment and outstanding-loan rules where applicable; see [company decisions](docs/COMPANY_DECISIONS.md).
- [ ] DEC-08 Define repair budget approval, quote revisions, extra work, QC acceptance, owner self-review attribution, and permitted non-safety exceptions.
- [ ] DEC-09 Define availability, reservation expiry, booking deposits, discounts, cancellations/refunds, pre-readiness booking, and customer promises.
- [ ] DEC-10 Define delivery clearance, required payment/document checks, ownership-transfer follow-up, and when outstanding obligations are closed.
- [ ] DEC-11 Record issued warranty terms. Confirmed: duration (initially 3, 6 or 12 months) and coverage/exclusions are configurable per car by Owner/Supervisor, retained in the sale's issued snapshot. Duration/coverage configuration and issued snapshots are implemented; confirm kilometre rules, provider/payer, claim review, goodwill, reimbursements and complaint escalation; see [company decisions](docs/COMPANY_DECISIONS.md).
- [ ] DEC-12 Agree cost categories, currency/rounding, taxes/charges, deposits/advances, contributions, warranty reserve treatment, and reconciliation with accounts.
- [ ] DEC-13 Support exactly Hindi, Marathi and English as confirmed. Complete Marathi UI/checklist editing and spoken/visual guidance alongside existing English/Hindi. Android phones/tablets and iPhone/iPad remain in scope; confirm minimum OS/hardware, browsers, offline audio packs and assisted enrollment; see [company decisions](docs/COMPANY_DECISIONS.md).
- [ ] DEC-14 Agree release acceptance targets for response time, upload reliability, AI correction rates/latency, low-reading task comprehension/completion, accessibility, recovery, expected load, and AI spending limits.
- [ ] DEC-15 Inventory records to migrate, document/media retention, initial users/vendors, production ownership, distribution accounts, and operating responsibilities.
- [ ] DEC-16 Record media profile details beyond the fixed resolution rules: duration, bitrate, file-size/page budgets, JPEG quality, low-detail import handling, normalized-master retention, and temporary-source cleanup.
- [ ] DEC-17 User says participation by one or two actual employees is possible. Confirm participants/devices/timing, arrange representative walkthroughs across Hindi/Marathi/English and reading/phone-skill levels, and record observable comprehension targets/results. Availability alone is not completed acceptance; see [company decisions](docs/COMPANY_DECISIONS.md).

## 2. Product design and usability — UX

- [ ] UX-01 Design owner Today with All business, My work, Awaiting my decision, visible filters, and an obvious return to the full business view.
- [ ] UX-02 Design employee Today, Cars, Tasks, Approvals, and More with permissions and current responsibilities reflected in content.
- [ ] UX-03 Design the car list/board, combined status display, search/QR entry, and car record tabs with next action, assignee, due date, and freshness.
- [ ] UX-04 Design inspection capture, per-item media, section progress, missing evidence, submitted/reviewed states, rechecks, and original/revised evidence.
- [ ] UX-05 Design purchase, service work orders, parts, quote approvals, invoice recording, QC, and workshop dispatch/receipt flows.
- [ ] UX-06 Design buyer enquiry/follow-up, test drive, booking, cancellation/refund, final PDI, delivery, transfer follow-up, and warranty workflows.
- [ ] UX-07 Design voice/OCR drafts, source-image/transcript review, unknown fields, clarification, confirmation, and stale-draft handling.
- [ ] UX-08 Design source-linked owner questions/briefs, voice task previews, paired repair evidence, and delivery/warranty summaries.
- [ ] UX-09 Define loading, empty, validation, denied access, stale data, offline, upload retry, AI unavailable, and conflict states across screens.
- [ ] UX-10 Validate large touch controls, outdoor readability, keyboard behaviour, text scaling, screen-reader labels, and supported languages on phone-sized layouts.
- [ ] UX-11 Walk through the complete clickable design with the owner acting as manager/supervisor and staff completing assigned work; record required corrections.
- [ ] UX-12 Implement the inclusive specification: employee My work/Scan car/Help entry points, task cards with car pictures, and one guided check/action per step.
- [ ] UX-13 Pair familiar visuals and short labels with replayable spoken prompts; test icon/result meanings locally and never rely on colour alone.
- [ ] UX-14 Design picture-based/spoken car confirmation, task instructions, result selection, review/readback, correction, and help without mandatory free-text typing.
- [ ] UX-15 Design first-time language selection with audio previews, assisted enrollment, individual identity confirmation, secure unlock, and understandable shared-device account switching.
- [ ] UX-16 Produce approved localized instructional audio/visual assets, offline language packs, glossary, fallback wording, and versioning tied to the correct checklist instructions.
- [ ] UX-17 Implement visible repeat/back/retake/undo/help actions, resumable steps, stable primary-action positions, and no essential hidden gesture.
- [ ] UX-18 Distinguish saved-on-phone, preparing media, sending, server-received, and supervisor-accepted through understandable visual and audio feedback.
- [ ] UX-19 Implement large touch targets, clear contrast, text scaling, screen-reader semantics, outdoor readability, audio controls, and alternatives for noisy/private settings.
- [ ] UX-20 Design understandable confirmations/readback for car identity, dates, money, units, and consequential decisions while keeping routine capture quick.
- [ ] UX-21 Design scoped workshop work orders and customer/seller handover explanations with useful pictures, clear promises, and no unnecessary internal financial exposure.
- [ ] UX-22 Observe representative staff completing core prototype tasks; resolve repeated wrong-car/result, lost-work, or false-completion misunderstandings before finalizing screens.
- [ ] UX-23 **Reframed by owner on 30 October:** integrate meaningful automotive interactions into actual inspection, service, review and owner workflows. The [data/spatial inspection plan](docs/SPATIAL_INSPECTION_PLAN.md) supersedes the standalone motion study. Review this direction before implementation; native performance/accessibility and device acceptance remain open.
- [ ] UX-24 Implement shared sedan/hatchback/SUV inspection models with stable component anchors, clustered zone pointers, direct view buttons, a complete synchronized check list and 2D fallback. Keep actual body classification and schematic rendering family separate.

## 3. Application and backend foundations — ENG

- [ ] ENG-01 Apply the architecture baseline: React Native/Expo mobile (Expo Go foundation), React/Vite web, Python/FastAPI API, PostgreSQL/SQLAlchemy/Alembic, private object storage, and supported native adapters; resolve environment/provider details.
- [x] ENG-02 Establish project structure for mobile, web, API, background jobs, shared contracts, migrations, fixtures, and developer documentation.
- [x] ENG-03 Configure formatting, linting, type checking, relevant tests, dependency checks, and CI build verification.
- [ ] ENG-04 Create isolated development, staging, and production configuration with server-held secrets and reproducible setup.
- [ ] ENG-05 Define the domain schema, company/branch scope, stable identifiers, references, money/time representations, and migration strategy.
- [ ] ENG-06 Implement authenticated, permission-checked APIs with validation, pagination, search/filtering, consistent errors, and conflict/version handling.
- [x] ENG-07 Implement transaction boundaries, duplicate-request protection, and retry-safe commands for approvals, purchases, bookings, costs, payments, delivery, and uploads.
- [ ] ENG-08 Create private media/document storage with authenticated upload/download, metadata, integrity checks, upload lifecycle, and failed/orphan upload cleanup.
- [ ] ENG-09 Implement background work for processing, scheduled reminders, retries, job status, and cancellation/staleness where needed.
- [x] ENG-10 Implement an attributable history of business changes, approvals, assignments, revisions, and owner self-review; prevent silent history replacement.
- [ ] ENG-11 Define backup/export compatibility, deletion/retention processing, and references so restored database and media records remain consistent.
- [ ] ENG-12 Build installable Android and iOS development versions early and verify camera, microphone, OCR/scanning, durable storage, 720p video normalization, Full-HD photo resizing, and upload feasibility on real devices.

### Architecture implementation — ARC

- [ ] ARC-01 Structure business feature modules with pure domain rules, application use cases, adapters, presentation, and explicit runtime composition.
- [ ] ARC-02 Define actual boundary contracts for repositories, identity, clock, media normalization/inspection, upload, speech, OCR, AI, and notifications.
- [ ] ARC-03 Share validated API/event contracts without exposing persistence models, native SDK objects, or provider SDKs to presentation/domain code.
- [x] ARC-04 Add import-boundary verification and meaningful domain/integration tests; keep simple CRUD free of unnecessary wrapper layers.
- [ ] ARC-05 Implement a versioned media profile and normalized-asset contract shared by mobile validation, upload admission, actual-byte inspection, and tests.
- [ ] ARC-06 Isolate native photo/video processing behind a small adapter; avoid full media-buffer transfers through JavaScript and keep processing off the UI thread.
- [ ] ARC-07 Model local normalization/upload states, recovery, integrity, source cleanup, and conflict rules explicitly in application use cases.
- [x] ARC-08 Keep owner/staff authorization, state transitions, approval versioning, booking constraints, and financial idempotency authoritative on the backend.
- [x] ARC-09 Implement jobs and transactional outbox using the chosen durable database infrastructure; publish notifications only after business commits.
- [ ] ARC-10 Centralize design tokens, localization/audio IDs, semantic result states, and UI adapters while keeping policy independent of language/layout.

## 4. Identity, owner authority, and staff permissions — IAM

- [ ] IAM-01 Implement owner onboarding, staff invitation/activation, sign-in, account recovery, session expiry/revocation, logout, and offboarding.
- [ ] IAM-02 Give the owner access to every company business record, field, media item, report, and operational action across branches and all lifecycle stages.
- [ ] IAM-03 Implement combinable permission templates for manager, supervisor/QC, inspector, coordinator, sales, accounts, and documentation work.
- [ ] IAM-04 Separate task responsibility, record visibility, branch scope, spend authority, QC authority, financial visibility, and staff administration permissions.
- [x] IAM-05 Allow the owner to assign work to themselves, review/complete it, delegate it, and take over another assignment without changing account or losing access.
- [ ] IAM-06 Record the real actor, responsibility performed, prior/new assignee, reason, and time; notify affected staff after reassignment or takeover.
- [x] IAM-07 Implement explicit owner self-review attribution and agreed staff self-review rules without representing one person as two independent reviewers.
- [x] IAM-08 Enforce approvals against the current record/version and invalidate an approval when the approved facts materially change.
- [x] IAM-09 Enforce access on API queries, actions, media, documents, exports, notifications, and AI retrieval, including direct-link requests.
- [ ] IAM-10 Implement secure device-session/cache handling, privileged-action authentication, and the agreed offline access policy; handle pending drafts during logout/offboarding deliberately.
- [ ] IAM-11 Verify technical administration does not automatically grant business-owner financial access.
- [x] IAM-12 Verify owner focus filters change the view only, while every other user's scope remains enforced on the server.

## 5. Car identity and operational record — CAR

- [ ] CAR-01 Implement permanent vehicle identity and separate acquisition/sale cycles, including a later reacquisition linked to earlier history.
- [ ] CAR-02 Implement stock numbers, QR generation/scanning, registration/VIN/chassis confirmation, duplicate suggestions, and traceable identifier corrections.
- [ ] CAR-03 Store specifications, powertrain, odometer observations/units, condition, equipment, keys, accessories, and role-restricted seller/buyer details.
- [ ] CAR-04 Implement independent acquisition, preparation, commercial, physical-custody, document, payment, and warranty states with validated transitions.
- [ ] CAR-05 Implement Overview, Inspections, Issues & Service, Costs, Documents, Sales & Delivery, Warranty, and History with linked source records.
- [ ] CAR-06 Show current assignee/reviewer, blocker, next action, due date, workshop forecast, customer promise, last update, and sync freshness.
- [ ] CAR-07 Support all-lifecycle search and filtering, including rejected/withdrawn enquiries, current stock, delivered cars, and after-sales visits.
- [ ] CAR-08 Keep readiness derived from the applicable required jobs, inspections, evidence, documents, and QC acceptance.
- [ ] CAR-09 Support holds, new faults after readiness, reopened work, and reassessment of affected bookings/delivery promises.
- [ ] CAR-10 Maintain linked documents and their review/expiry/follow-up states without exposing restricted files to unauthorized users.
- [ ] CAR-11 Build the India vehicle catalogue: makes, models, generations/facelifts, variant revisions, discontinued/import entries, body types, powertrain/equipment, aliases and field-level provenance. Publish staged, validated revisions and a coverage/gap report; do not claim completeness from provider record counts.
- [ ] CAR-12 Match actual cars to catalogue revisions with observed configuration/unknown features and approved provisional entries. Cache permitted catalogue/asset packs offline and preserve historical inspection configuration after catalogue updates.

## 6. Camera, sensors, evidence, and offline operation — CAP

- [ ] CAP-01 Implement durable local drafts and media storage with car/task/item context, capture/import origin, timestamps, and upload state.
- [ ] CAP-02 Implement photo/video/audio capture, camera permissions, orientation, torch where supported, previews, retakes, and accessible capture controls.
- [ ] CAP-03 Implement checklist-specific view instructions, framing guides, optional prior-image overlay, and haptic/spoken prompts with touch alternatives.
- [ ] CAP-04 Implement blur/exposure/readability checks and motion-assisted steadiness guidance with runtime hardware detection and evaluated thresholds.
- [x] CAP-05 Preserve the first verified mobile-normalized upload as the immutable evidence master; track derivatives/revisions against it and keep full-resolution source files local/temporary only.
- [ ] CAP-06 Implement bounded video capture, playback, extraction of selected frames, and item-specific timestamp/segment references.
- [ ] CAP-07 Implement resumable/retry-safe uploads, checksums or equivalent integrity validation, duplicate submission handling, and Pending/Uploading/Failed/Synced displays.
- [ ] CAP-08 Recover drafts/uploads after app termination, connection loss, token expiry, device restart, low storage, and processing failure.
- [ ] CAP-09 Handle platform background limits explicitly and resume reliably when the app returns; distinguish local capture from server-confirmed submission.
- [ ] CAP-10 Implement offline task/inspection capture plus visible conflicts; require online server confirmation for approvals, bookings, financial posting, and delivery release.
- [x] CAP-11 Block final inspection/release acceptance when mandatory media has not been uploaded and verified; show the missing items clearly.
- [ ] CAP-12 Implement optional event location with accuracy/time, selected workshop, car confirmation, and custodian acknowledgement at dispatch/receipt; label it as an event observation.
- [ ] CAP-13 Implement evidence version history and limited duplicate/similar-image flags for reviewer attention without automatically alleging misconduct.
- [ ] CAP-14 Define secure local retention and cleanup after successful upload, account changes, and retention expiry while protecting unsynced work from accidental loss.
- [ ] CAP-15 Configure and verify 720p capture; normalize every video locally to exactly 1280 × 720 or 720 × 1280 with the chosen MP4/H.264 profile and preserved content/orientation.
- [x] CAP-16 Resize every captured/imported photo and scanned page locally to the applicable 1920 × 1080 or 1080 × 1920 bounding box, preserving aspect ratio and avoiding upscaling.
- [ ] CAP-17 Handle 4K/1080p/HDR/HEVC inputs, portrait/rotated frames, nonstandard aspect ratios, audio synchronization, and low-detail sources under ADR-04 without an oversized-upload fallback.
- [ ] CAP-18 Persist and inspect normalized outputs before making them upload-ready; recover interrupted encodes and prevent partial or raw sources from entering the upload queue.
- [x] CAP-19 Inspect actual uploaded bytes on the server for dimensions/orientation, media type/codec, size/duration, integrity, and profile version; reject violations before evidence verification.
- [ ] CAP-20 Ensure camera, gallery, scanned document pages, optional web attachment entry, and AI payload routes all respect the same fixed media policy.
- [ ] CAP-21 Implement per-page close-up guidance when Full-HD evidence is unreadable; keep handover PDFs derived from accepted pages and define any original digital-document admission separately.
- [ ] CAP-22 Tune processing performance, output detail, encode concurrency, bitrate/JPEG quality, storage use, and temporary-file cleanup on ordinary supported phones.
- [ ] CAP-23 Present automatic media preparation with simple visual/audio status and retry/help actions; expose no resolution/codec controls to staff.

## 7. Enquiries, inspections, and review — INS

- [ ] INS-01 Implement seller enquiry, source, expected price, contact history, appointment, inspector assignment, and follow-up.
- [ ] INS-02 Implement versioned checklist administration and applicability by vehicle/powertrain and inspection stage.
- [x] INS-03 Store each inspection's template snapshot so later checklist changes do not rewrite prior inspections.
- [ ] INS-04 Implement item results, measurements/units, notes, severity, item-specific evidence, not-applicable reasons, and section progress.
- [x] INS-05 Keep pre-purchase, intake, repair-QC, and delivery-PDI instances distinct and linked to the relevant cycle/job.
- [x] INS-06 Implement draft, submit, review, return selected items, resubmit, and accept, retaining every submitted version and actual reviewer.
- [x] INS-07 Create linked issues from failed findings with evidence carried forward and duplicate-issue handling.
- [ ] INS-08 Record buy/negotiate/further-diagnosis/reject recommendations and their reasons, including rejected/withdrawn car history.
- [x] INS-09 Show the owner all inspection evidence and permit direct review, assignment, rechecks, and personally performed inspections through the same account.
- [ ] INS-10 Enforce required-item completion/evidence and the agreed critical-check rules at submission and acceptance.
- [ ] INS-11 Author the comprehensive component-based inspection library and reconcile Arihant's advertised 151-check standard with its approved SOP. Cover all required systems, repeated positions and equipment-specific modules; replace short training fixtures without claiming drafts are business-approved.
- [ ] INS-12 Resolve and snapshot complete applicable inspections from vehicle configuration and stage, including unknown-feature verification, measurements, proof policies, attributed exceptions and separate coverage/condition/review states. Support resolved sets beyond 200 items and check/zone-level parallel work without lost drafts or evidence.
- [ ] INS-13 Connect actual full inspections to shared 3D component anchors and complete list navigation, camera capture, evidence/result recording, owner review and downstream repair/QC/warranty history. Verify identical authoritative work in both views, offline recovery and physical phone/tablet accessibility/performance.

## 8. Valuation, purchase, and intake — PUR

- [x] PUR-01 Implement valuation with expected resale, repair estimate, direct expenses, expected contribution, and approval context.
- [ ] PUR-02 Implement purchase negotiation, approval, agreement, seller/ownership-document review, and changed-price reapproval.
- [ ] PUR-03 Track acquisition payment obligations, payments/references, advances, and outstanding-loan-resolution tasks where applicable.
- [ ] PUR-04 Record physical handover condition, odometer, fuel, keys, accessories, documents, custodian, and acknowledgements.
- [x] PUR-05 Separate physical receipt, purchase agreement/approval, payment completion, and document clearance states.
- [ ] PUR-06 Reconcile stock intake against pre-purchase findings and record new defects or transport damage.
- [ ] PUR-07 Establish the acquisition cycle's initial approved refurbishment budget and responsible staff.
- [ ] PUR-08 Implement the transaction variants confirmed in DEC-06, preserving ownership, commercial terms, liabilities, and links between related transactions.

## 9. Repairs, workshops, parts, and QC — SRV

- [ ] SRV-01 Implement issue severity, component/location, delivery impact, evidence, assignee, reviewer, due date, blocker, and next action.
- [ ] SRV-02 Implement diagnosis, estimate/quote, approval, assignment, work in progress, waiting, repair submitted, QC, closed, reopened, and cancelled states with reasons.
- [ ] SRV-03 Implement workshop/vendor records, contact details, work orders, job scope, dispatch, acknowledgement, custody, and expected return.
- [x] SRV-04 Implement concurrent jobs/workshops for one car and aggregate readiness without hiding each job's blockers.
- [x] SRV-05 Implement itemized quote versions for parts, labour, outside services, taxes/charges, total, approval, and agreed limits.
- [x] SRV-06 Require fresh authorization for applicable extra work or cost increases before commitment, including direct owner approval.
- [ ] SRV-07 Track part requirements, supplier, order/reference, ETA revisions, receipt, installation, returns, and related cost/invoice records.
- [ ] SRV-08 Track repair updates, before/after evidence, workshop promises, actual completion, and missing updates through the staff coordinator.
- [ ] SRV-09 Implement per-issue QC, measurements/road-test evidence where required, reviewer acceptance, failed QC, and rework history.
- [ ] SRV-10 Show waiting duration, vendor delays, overdue return/parts, and impact on customer delivery without resetting elapsed time silently.
- [ ] SRV-11 Link invoices, credits, vendor advances/payments, and warranty responsibility to their actual jobs and costs.
- [ ] SRV-12 Verify a new fault or failed QC removes readiness and triggers review of affected commitments.

## 10. Stock, custody, and readiness — STK

- [ ] STK-01 Track branch, yard/parking position, workshop, transit, and current custodian with movement history.
- [ ] STK-02 Track keys, spare keys, documents, accessories, dispatch/return commitments, and acknowledgements.
- [ ] STK-03 Record test-drive and other movements with authorized staff, departure/return, odometer/fuel, and condition exceptions.
- [ ] STK-04 Implement cleaning, detailing, vehicle photography, periodic stock checks, and related assignments.
- [ ] STK-05 Calculate total stock age, workshop time, and time ready/available for sale separately.
- [ ] STK-06 Implement an explainable readiness checklist showing every open requirement, responsible person, and underlying evidence.
- [ ] STK-07 Support early booking according to policy while keeping preparation and delivery clearance explicit.
- [ ] STK-08 Store approved selling price, specification, and condition disclosures internally without external publishing or marketing-sync dependencies.

## 11. Costs, payments, and operational reporting — FIN

- [ ] FIN-01 Implement a per-cycle cost ledger with the agreed purchase, transport, inspection, parts, labour, detailing, selling, and other categories.
- [ ] FIN-02 Keep estimates, budgets, approvals, commitments, incurred costs, invoices, and paid amounts distinct and linked.
- [ ] FIN-03 Implement seller payments, vendor advances/balances, buyer deposits/collections, refunds, credits, and reimbursements with references/evidence.
- [ ] FIN-04 Implement partial payments, allocation, cancellation/reversal/correction, duplicate protection, and reconciliation without double-counting expenses.
- [ ] FIN-05 Calculate operational contribution and updated forecast using approved accounting definitions, showing cash movements separately.
- [ ] FIN-06 Link actual after-sales/warranty costs to the service case and original sale, with reserve/reimbursement handling as agreed.
- [ ] FIN-07 Implement approval limits, overdue balances, budget overruns, and owner drill-down to source amounts and documents.
- [ ] FIN-08 Implement authorized exports and period/category/car/vendor/buyer filters with consistent rounding and totals.
- [ ] FIN-09 Verify owner financial visibility and restricted employee access on screen, APIs, AI, documents, and exports.

## 12. Sales, bookings, and customer commitments — SAL

- [ ] SAL-01 Implement direct buyer enquiry capture, preferences, salesperson assignment, next follow-up, and contact history.
- [ ] SAL-02 Implement appointments, test-drive feedback, negotiation, offers, and finance dependencies without banking integration.
- [ ] SAL-03 Implement approved selling-price history, discounts, special promises, and exception approval.
- [ ] SAL-04 Confirm bookings transactionally with agreed price, deposit/reference, hold expiry, customer promise, and expected delivery.
- [x] SAL-05 Enforce one active confirmed booking per acquisition cycle under concurrent requests, retries, and reconnecting offline requests.
- [x] SAL-06 Implement hold expiry, extension, booking release/cancellation, and refunds as separate traceable obligations.
- [ ] SAL-07 Show preparation forecast and delivery risk while retaining independent booked/service/location/document/payment states.
- [ ] SAL-08 Implement supported exchange, return, and buyback flows from DEC-06 using linked transactions and fresh condition checks.
- [ ] SAL-09 Keep all customer commitments assigned and visible through delivery and after-sales closure.

## 13. Final PDI, delivery, and documents — DEL

- [ ] DEL-01 Create delivery preparation tasks for final PDI, repairs, cleaning, documents, accessories, payment verification, and walkthrough.
- [ ] DEL-02 Implement final-PDI review and require applicable critical checks, accepted repair QC, verified media, and agreed clearance rules before release.
- [ ] DEL-03 Show and resolve missing delivery requirements with authorized exceptions only where policy permits.
- [x] DEL-04 Record delivered condition, odometer, keys/accessories, acknowledgements, customer promises, date/time, and the real person completing handover.
- [x] DEL-05 Store the issued warranty/provider/policy version and customer acknowledgement as part of the delivery record.
- [ ] DEL-06 Track ownership-transfer submission, missing paperwork, responsible person, follow-ups, completion evidence, and remaining obligations after delivery.
- [ ] DEL-07 Create a permission-controlled handover pack and AI-assisted draft brief from accepted records, with human review before finalization.
- [ ] DEL-08 Keep delivery history and open financial/document obligations intact when a transaction later changes.

## 14. Warranty and post-sale support — WAR

- [ ] WAR-01 Implement warranty policy versions, issued snapshots, start event/date, duration, kilometre rules, coverage, exclusions, limits, and provider/payer.
- [ ] WAR-02 Implement customer complaint capture with symptoms, media, reported odometer, urgency, contact history, and assigned next action.
- [x] WAR-03 Evaluate recorded date/km conditions while representing missing current odometer or ambiguous coverage as needing review.
- [ ] WAR-04 Implement approved/rejected/referred claims, recorded reasons, goodwill classification, customer response, and permitted reimbursements.
- [ ] WAR-05 Create linked service visits/jobs with diagnosis, estimates, parts, costs, QC, and customer updates.
- [x] WAR-06 Keep a delivered car commercially sold when it returns for service; track its physical presence independently.
- [ ] WAR-07 Implement repeat-fault visibility, complaint escalation, customer resolution acknowledgement, follow-up, and closure.
- [ ] WAR-08 Provide an AI-assisted source-linked case brief and coverage-clause summary, with the authorized person making the decision.

## 15. Owner oversight, tasks, and notifications — OWN

- [ ] OWN-01 Build all-business overview, My work, Awaiting my decision, visible scope filters, and reset-to-all on mobile and web.
- [ ] OWN-02 Show all cars by concurrent states, location, assignee, next action, blocker, age, delivery promise, and latest update.
- [ ] OWN-03 Make each dashboard count open the exact matching list, then the car/job/checklist/evidence; preserve visible filter context.
- [ ] OWN-04 Show staff/workshop workload, unassigned tasks, pending reviews/approvals, stale updates, and missing evidence/documents/invoices.
- [ ] OWN-05 Support direct owner assignment, takeover, review, recheck, approval/rejection, hold, reopening, and operational completion from the relevant record.
- [ ] OWN-06 Display costs, capital committed, balances, stock ageing, contribution, cycle times, warranty cases, vendor delays, and rework with source drill-down.
- [ ] OWN-07 Implement a complete activity history, “changed since my last review,” comments, linked questions, and optional car watchlists.
- [ ] OWN-08 Implement in-app attention queues, reminder/escalation rules, backup approvers, and push notifications linking to permission-checked records.
- [ ] OWN-09 Separate urgent exceptions from routine activity; implement notification preferences, deduplication, read state, and delivery failure handling.
- [ ] OWN-10 Display stale/server-confirmed data accurately; show known missing submissions without claiming to see captures still isolated on an offline phone.
- [ ] OWN-11 Provide owner morning/evening briefs and a manual refresh with data cutoff and source links.

## 16. Lightweight AI and document understanding — AI

- [ ] AI-01 Create a representative, labelled evaluation set for actual inspection photos, documents, bills, speech, owner questions, and workflow changes; protect personal data in development.
- [ ] AI-02 Evaluate/select the small-model tier, speech route, OCR libraries, optional vision route, and supported language/device combinations against DEC-14 targets.
- [x] AI-03 Implement server-side AI credentials, permission-scoped context retrieval, structured outputs, bounded jobs/retries, usage tracking, and provider-outage handling.
- [ ] AI-04 Implement push-to-talk transcription with original audio/transcript references, mixed workshop vocabulary, glossary support, language selection/detection, and evaluated fallback paths.
- [ ] AI-05 Turn dictated findings/updates into editable car/task-aware drafts; preserve negation, unknown fields, units, amounts, and dates; clarify ambiguity and leave unmentioned checks unanswered.
- [ ] AI-06 Implement OCR/scanning for vehicle identifiers, odometer/units, relevant document fields, tyre markings, and selected visible indicators with source crops and user confirmation.
- [ ] AI-07 Implement quote/invoice extraction, original-to-revised comparison, additional-work flags, duplicate suggestions, and deterministic totals/budget checks.
- [ ] AI-08 Add evaluated saved-image view/relevance suggestions and evidence-completeness guidance to capture/review; keep original media and explicit inspector results.
- [ ] AI-09 Implement source-linked review briefs with unresolved findings, missing evidence, changes, and contradictions between recorded results and notes.
- [ ] AI-10 Implement supported owner natural-language questions using bounded filters/queries; compute facts in code and link material claims to current source records.
- [ ] AI-11 Implement daily owner summaries and “what changed” explanations with scope, data cutoff, missing-data handling, and refresh/invalidation.
- [ ] AI-12 Implement voice-created tasks/reassignments with car/person/date resolution, visible preview, explicit confirmation, server authorization, and actual-owner attribution.
- [ ] AI-13 Implement paired before/after repair views and evaluated advisory descriptions linked to car, issue, image, and capture time; preserve supervisor QC decisions.
- [ ] AI-14 Implement reviewable delivery summaries and warranty case/coverage briefs tied to accepted records and issued policy clauses.
- [ ] AI-15 Provide approved checklist guidance, example views, and supported translated/rephrased instructions with original meaning and source retained.
- [x] AI-16 Validate generated fields/source references; enforce normal approval/readiness/payment rules and treat document/transcript contents as untrusted data rather than executable instructions.
- [ ] AI-17 Record source versions, model/prompt versions, corrections, confirmation, and usage; prevent stale results from overwriting newer work.
- [x] AI-18 Bound payload sizes, output, concurrency, daily usage, retries, and cost; reuse results only while their inputs remain unchanged.
- [ ] AI-19 Detect optional on-device model features at runtime and supply the agreed cloud/manual paths; verify all committed AI workflows on the declared supported devices.
- [ ] AI-20 Prove the eight included capability groups meet their targets in the actual app; a manual fallback preserves operations but does not count an unimplemented AI feature as complete.
- [ ] AI-21 Provide spoken/visual review and clarification of AI drafts so reading the transcript is optional; retain source audio and route unsupported/uncertain input for help without losing work.
- [ ] AI-22 Send only policy-compliant normalized media to cloud processing; verify required OCR detail after normalization and guide close-ups rather than uploading higher-resolution originals.

## 17. Operations, deployment, and production support — OPS

- [ ] OPS-01 Provision environments, domains/networking, encrypted transport, private storage, credentials, and least-privilege service access.
- [ ] OPS-02 Automate builds/deployment and database migrations with staging rehearsal, documented rollback/roll-forward, and compatibility handling for installed mobile versions.
- [ ] OPS-03 Implement monitoring for API errors/latency, upload backlog, job failures, database/storage health, push failures, AI availability, usage, and cost.
- [ ] OPS-04 Ensure logs and diagnostics avoid unnecessary documents, personal data, transcripts, tokens, and sensitive financial content.
- [ ] OPS-05 Configure backups, retention, recovery objectives, media/database consistency checks, and alerts on failed backups.
- [x] OPS-06 Rehearse restoring the database and media references into an isolated environment and verify representative car/evidence/payment histories.
- [ ] OPS-07 Implement production configuration, audit access, maintenance procedures, and incident/recovery runbooks with named operating responsibility.
- [ ] OPS-08 Rehearse importing initial users, vehicles, balances, document/media links, vendors, and relevant history with reconciliation and duplicate handling.
- [ ] OPS-09 Prepare privacy/permission explanations, retention/export processes, support contact, and distribution-channel disclosures appropriate to the actual app features.
- [ ] OPS-10 Document local setup, architecture, state rules, permissions, API/AI configuration, deployment, backups, and routine support.

## 18. Integrated acceptance and device validation — QA

- [ ] QA-01 Exercise a complete seller enquiry → inspection → purchase → intake → repairs/parts → QC → ready → booking → final PDI → delivery → transfer → warranty journey with persisted records.
- [ ] QA-02 Exercise the owner doing manager/supervisor/employee work in one account, reviewing their own work with accurate attribution, delegating/taking over, and seeing all other business records throughout.
- [ ] QA-03 Exercise a booked car at multiple workshops, one delayed part, parallel work, failed QC/rework, changed ETA, and threatened customer promise.
- [ ] QA-04 Verify required checks/media and critical defects block readiness/delivery; inspect accepted/rejected evidence and revision history.
- [ ] QA-05 Verify purchase/quote/discount/refund/claim approval limits, changed facts invalidating approvals, and retry-safe actual transactions.
- [ ] QA-06 Race concurrent bookings and financial submissions; verify single booking confirmation, correct balances, and no duplicate commitments/payments/delivery.
- [ ] QA-07 Exercise cancellation, hold expiry, exchange/return/buyback variants in scope, refunds, credits, partial payments, and outstanding document obligations.
- [ ] QA-08 Exercise warranty date/km ambiguity, provider referral, goodwill, repeat complaint, reimbursement, and a sold car physically back at a workshop.
- [ ] QA-09 Verify object/field/branch/action/media/export/AI permissions with direct requests; validate logout/offboarding, expired sessions, and sensitive-data boundaries.
- [ ] QA-10 Capture inspections/media offline, terminate/restart the app, reconnect, retry failed uploads, reconcile edits, and verify no lost or duplicated evidence.
- [ ] QA-11 Test permission denial, low storage, weak network, long upload, background suspension, unsupported sensor/model, provider outage, and AI spending-limit behaviour.
- [ ] QA-12 Evaluate voice/OCR accuracy, unknown/ambiguous inputs, negation, missing evidence, source-linked answers, stale drafts, corrected amounts, and hallucination handling against agreed targets.
- [ ] QA-13 Confirm owner dashboard/report totals match underlying lists and ledgers, all filters remain visible, and stored briefs display their cutoff.
- [ ] QA-14 Validate the complete app on the declared iPhone, iPad, Android phone and Android tablet device matrix and supported desktop browsers, including camera/audio/sensors/native modules and small-screen accessibility.
- [ ] QA-15 Measure response time, evidence throughput, relevant concurrency, battery/thermal impact, AI latency, and actual per-workflow cost against agreed targets.
- [ ] QA-16 Run staff/owner walkthroughs using real or representative car histories and every included AI feature; resolve material usability/workflow defects.
- [ ] QA-17 Complete the required automated checks/builds, targeted security/dependency review, migration/recovery rehearsals, and regression checks after material fixes.
- [ ] QA-18 Record remaining defects with impact and disposition; resolve all release-blocking issues and attach acceptance evidence to the release gates.
- [ ] QA-19 Verify actual encoded dimensions/format on Android and iOS for every capture/import route; exercise interrupted processing, rotation, nonstandard ratios, high-resolution inputs, low storage, and no raw-source leakage.
- [ ] QA-20 Verify direct/bypassed upload attempts with oversized or misdeclared files are rejected server-side and cannot satisfy inspection evidence requirements.
- [ ] QA-21 Observe employees across reading/digital-skill levels completing car identification, guided check, result/evidence capture, correction, help, and submission without relying on long text or typing.
- [ ] QA-22 Verify spoken prompts offline, supported language packs, audio-off/noisy-setting alternatives, interrupted-step recovery, and correct saved/sent/accepted comprehension.
- [ ] QA-23 Test misunderstood icons, transcription/OCR number errors, wrong-car selection, accidental taps, shared-device identity, and consequential confirmation/readback with representative staff.
- [ ] QA-24 Resolve critical comprehension errors and retest against the agreed completion/assistance targets; provide the owner with the observed results.
- [ ] QA-25 Validate portrait/landscape, iPad and Android tablet windows, tablet multitasking, keyboard/safe areas, large text, two-panel reflow and draft retention through rotation.

## 19. Build distribution, launch, and handover — REL

- [ ] REL-01 Confirm application identity, branding/icons, versioning, production signing ownership, Android package, and iOS bundle configuration.
- [ ] REL-02 Produce signed Android APK and the production Android distribution artifact required by the chosen channel; verify installation and updates.
- [ ] REL-03 Produce signed iOS builds and complete the chosen employee distribution/testing route with the required developer-account setup.
- [ ] REL-04 Verify production API/storage/notifications/AI configuration, permissions, network settings, migration state, and installed-app compatibility on both platforms.
- [ ] REL-05 Complete applicable distribution metadata, privacy declarations, review requirements, and organization-owned credential handover.
- [ ] REL-06 Reconcile migrated stock, customer/vendor balances, users, documents, and media; establish the agreed cutover point and recovery procedure.
- [ ] REL-07 Provide owner/staff training, role-specific quick guides, evidence/AI confirmation examples, and support/escalation instructions.
- [ ] REL-08 Demonstrate every release gate below using the production-candidate build and record business acceptance of workflows and configured policies.
- [ ] REL-09 Complete any deployment/distribution authorization required by the actual environment, then deploy the accepted candidate and verify installation/access.
- [ ] REL-10 Perform production smoke checks for owner/staff access, car/evidence capture, review/approval, booking protection, AI drafts/source links, and monitoring without creating unexplained live financial records.
- [ ] REL-11 Verify dashboards, background jobs, backup scheduling, cost alerts, support ownership, and recovery information after launch.
- [ ] REL-12 Deliver release notes, build/deployment references, acceptance evidence, known nonblocking limitations, and the operational handover.

## Full-release gates

These are the final completion conditions. Check them against working release-candidate builds; the individual tasks above provide traceability.

- [ ] GATE-01 Business rules, the real inspection templates, warranty terms, device/language support, and measurable acceptance targets are recorded and applied; unresolved critical inputs are closed.
- [ ] GATE-02 The complete acquisition-to-warranty journey works across mobile/web/API with all required records, media, costs, and obligations linked.
- [ ] GATE-03 The owner can see every business record and act in every operational responsibility through one account; staff permissions remain enforced everywhere.
- [ ] GATE-04 Offline drafts/evidence survive interruptions and reconcile reliably; authoritative approvals/bookings/financial posting/delivery remain server-confirmed.
- [ ] GATE-05 All eight included AI capability groups work within the app, preserve source evidence, meet agreed quality/cost targets, and respect permissions and normal workflow controls.
- [ ] GATE-06 Concurrent bookings, changed approvals, financial retries, repair-QC failures, cancellations/returns, and warranty visits preserve correct state and history.
- [ ] GATE-07 Supported Android/iOS builds and the management web app pass the device, accessibility, performance, and end-to-end acceptance matrix.
- [ ] GATE-08 Deployment/migrations, reconciled initial data, backup restoration, monitoring, incident procedures, and operational ownership are verified.
- [ ] GATE-09 Release-blocking defects are resolved, remaining limitations documented, staff trained, and the production candidate accepted for the selected distribution channels.
- [ ] GATE-10 Production deployment/distribution and smoke checks are complete, with support and recovery arrangements active. Marketing integration has not become a launch dependency.
- [ ] GATE-11 All videos are verified 720p and all photos/scanned pages are Full HD or smaller under ADR-04; normalization happens on the phone before upload, raw sources cannot bypass it, and the server independently enforces the profile.
- [ ] GATE-12 The core employee journeys meet measured comprehension/completion targets across reading levels and supported languages using visual/audio guidance, usable controls, correction, and help.

## Progress register

30 October 2026 · Evidence-backed development review. No full-release gate is complete. See [working features, evidence and precise gaps](DEVELOPMENT_STATUS.md), [verification record](docs/review/VERIFICATION.md), and [source architecture](ARCHITECTURE_DECISIONS.md).

| IDs | Status and evidence |
| --- | --- |
| ENG-02/03 | Done: mobile/web/API/worker/shared contracts, 21 migrations, reproducible commands, formatting/lint/type checks, automated suite and CI configuration. Hosted CI passed for the initial repository and company configuration commits; review follow-ups need their own run. |
| ENG-07/10, ARC-04/08/09 | Done for implemented commands: domain/import tests, PostgreSQL transactions/locks/constraints, durable receipts, current-version decisions, append-only history, transactional outbox/worker. |
| IAM-05/07/08/09/12 | Done: one-account owner actions, explicit self-review, current-fact approvals, server-side object/action/media/document/export/AI/inbox scope; tests in identity, roles, integration, commercial, documents, assistant and reports. |
| CAP-05/11/16/19 | Done: immutable normalized masters, required-photo/result gates, mobile JPEG normalization including document pages, actual-byte photo/video admission. Android native video evidence is linked in status. Cross-platform hardware and retention acceptance remain open. |
| INS-03/05/06/07/09 | Done: owner-authored immutable checklist revisions/approval (migration 0019), immutable stage/template snapshots, linked failed findings deduplicated by item, selected-item return with reason and fresh evidence, owner direct work/review. See test_integration.py and domain policies. |
| PUR-01/05 | Done: exact-paise valuation/forecast and independent approval/agreement/payment/document/physical-receipt facts. Reviewed pages now bind to versioned owner rules and gate acquisition; loan-resolution/allocation remain open. |
| SRV-04/05/06 | Done: parallel jobs/readiness, itemized quote revisions, latest exact-version approval and fresh approval for revised work. See test_service_finance.py and service-finance mobile workspace. |
| SAL-05/06 | Done: concurrent one-active-booking protection, durable retries, extension/expiry/cancellation and distinct bounded refund obligations. See test_commercial.py and notification worker tests. |
| DEL-04/05 | Done: immutable delivered condition/odometer/keys/accessories/promises/actor and issued warranty/acknowledgement snapshot. Versioned document evidence policy and completion gates are implemented; complete delivery preparation and the handover pack remain open. |
| WAR-03/06 | Done: date/km ambiguity and explicit missing-mileage review; warranty service preserves commercially sold state. Policy administration/referrals/reimbursements/closure remain open. |
| AI-03/16/18 | Done foundation: permission-scoped structured drafts, source/field validation, durable jobs/failures, bounded context/output/concurrency/request budgets. Text smoke works; image quality failed. These checks do not complete any of the eight capability groups or AI-20. |
| OPS-06 | Done local restore rehearsal: isolated synthetic purchase/payment/delivery/warranty-snapshot/document history, 18 table digests and 32 private media files matched after restore. Production scheduling/retention/RTO remain open. |
| UX, CAR, OWN | In progress: focused tabs, Records entry points, all-business/work/decision views, consistent decision counts, custody, stock ageing and money reports. Business/payment dates use an English/Hindi calendar, including a 150% text layout check; appointments use date/hour/minute choices. Staff comprehension/device acceptance, complete reporting and web action parity remain open. |
| IAM-01/03/04/10/11 | In progress: individual identity, reset/revocation/offboarding and Employee/Supervisor working levels and owner-only company/account policy. Recovery, privileged reauthentication and cache policy remain open; no extra working tier or per-supervisor spending limits are required for the initial family-business setup. |
| CAP-15/17/18/22, ENG-12 | In progress: Android native 720p import/camera preparation, actual video/document upload, force-stop restoration and partial-output cleanup verified. Branded development/bundled-preview APKs built; preview cold-launched without Metro. iOS source exists but full Xcode/native compilation and physical-device matrix are outstanding. |
| FIN-01–09 | In progress: immutable costs, seller/vendor/buyer payments and corrections, owner scoped totals/export, no double-counting invoice/payments or netting unrelated job advances. Tax/contribution definitions, allocations/credits/reimbursements and period/vendor filters remain open. |
| DEC, QA, OPS, REL, GATE | Open inputs/acceptance: real templates and policies, staff/device/language/quality targets, representative full journeys, production infrastructure, signed distribution and business acceptance. |
| UX-23/24, CAR-11/12, INS-11/12/13 | First implementation: 96 makes/1,857 model-name references (32 source-linked India references, no verified variants); 246 proposed bilingual pre-purchase definitions; configuration resolution and immutable snapshots above 200 items; measurements, unknown-feature confirmations, N/A/cannot-inspect rules, actual photo/required-clip gates and fresh-proof rechecks. Mobile sections/parts, complete searchable list and generic CC0 sedan/hatchback/SUV models share the same task and proof flow. Drag rotation and red dots/nearby-part groups are implemented. Qualified SOP approval, stage completeness, verified India variants, parallel zone assignment, richer offline packs and physical-device/performance/accessibility acceptance remain open. Marketing exchange remains deferred. |

Continue independent implementation while business/device inputs are collected. Do not substitute training templates, simulated tablet windows, text-only AI smoke checks or a debug APK for the full-release gates.


### 30 October — responsive review and check media

Implemented shared content-aware action wrapping, field/card reflow, content-sized tabs, short-screen dialogs, camera control reflow and compact inspection navigation. Photo and Video entry now appears for each check, with required proof and read-only access preserved. Follow-up review corrected narrow-screen footer crowding and the stacked identity banner. Emulator/browser evidence and the decoded synthetic photo/video check are in [the responsive review](docs/review/responsive/README.md). This does not close whole-device accessibility/staff acceptance or full-release gates.

### 30 October — confirmed company rules implementation

Implemented the two-tier hierarchy, supervisor financial approvals, non-financial
work continuation, rich owner inspection rules/order/Marathi fields, owner-versioned
document requirements with actual review-based gates, and per-sale 3/6/12-month
coverage configuration with immutable issued terms. New company document rules
must be reviewed/published; version-0 starters are not automatically enforced.
Marathi core copy/preferences/date support is implemented; full screen/checklist
translation, voice coverage and staff acceptance remain open. See the
[implementation and verification record](docs/review/company-configuration/README.md).
