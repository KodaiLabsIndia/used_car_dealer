# Arihant Cars — architecture decisions

30 October 2026 · Baseline for the full release

This document records implementation direction, including the user's fixed media rules. [The development checklist](DEVELOPMENT_CHECKLIST.md) tracks completion; [the inclusive UX specification](INCLUSIVE_UX.md) defines the user experience. These are design decisions, not a claim that software has already been implemented.

The first spatial inspection implementation keeps semantic checklist/part IDs,
configuration resolution and proof gates in the Python domain. PostgreSQL stores
immutable resolved task/configuration snapshots. A shared pure TypeScript
projection drives mobile/web coverage counts; it grants no permission and the
server still decides submission. The renderer receives navigation/status data
and never owns answers, evidence or applicability. Its bundled CC0 body meshes
load only on the active map and stop in the background or camera flow. Rendering
runs on demand; user drag/pinch controls the camera. Red dots project semantic
anchors into native touch targets, grouping nearby parts without dropping IDs.
Direct view buttons, reduced motion, section/part navigation and the complete
list remain available. Recreate the Expo GL scene when window dimensions change
so its drawing buffer and projected touch positions use the same viewport.
Catalogue source data is pinned and attributed separately from observed vehicle
equipment; its coverage endpoint explicitly reports incomplete variant data.

## ADR-01: One product, one operational backend

Build the Android/iOS app and management web dashboard against one permission-checked API and operational database. All included operations and lightweight AI features ship in the same production release. Internal milestones organize development and validation.

Use a modular monolith: one API application with clear business modules and a worker entry point from the same codebase for asynchronous jobs. Start with PostgreSQL-backed jobs/outbox and private object storage. This keeps transactions, deployment, and support manageable. Introduce additional infrastructure only for a demonstrated need.

Baseline technology choices:

| Area | Decision |
| --- | --- |
| Mobile | React Native, Expo, TypeScript; Expo Go for the working foundation; native development builds for later platform media/ML integrations |
| Management web | React, TypeScript, Vite; same API and business rules as mobile |
| API | Python/FastAPI with domain policies, application use cases, and adapters |
| Database | PostgreSQL; SQLAlchemy persistence adapters, Alembic and reviewed SQL migrations |
| Mobile drafts | Persistent SQLite records plus protected app-private files; platform secure storage for credentials |
| Evidence storage | Private S3-compatible object storage with short-lived, authorized upload/download access |
| Background work | Durable PostgreSQL jobs and transactional outbox; separate worker process when useful |
| Identity | Individual company-code/username/password accounts behind an identity adapter; operator-assisted owner bootstrap, owner-assisted staff enrollment, salted hashes and revocable sessions; production recovery/privileged unlock remain release work |
| AI | One backend gateway with small-model, speech, OCR, and optional vision adapters; per-task budgets and structured results |

Library versions are locked in package-lock.json and apps/api/uv.lock. Python is the backend language; TypeScript is used by the Expo app and client contracts. FastAPI publishes OpenAPI, from which TypeScript API types are generated; compile-time checks compare those types with mobile runtime validators. Deployment vendor, identity provider, and exact model remain environment/procurement decisions and do not change the application boundaries.

The owner selected the third UI direction, **Garage**. Use the original Arihant logo, red/black/white palette, and Plus Jakarta Sans. Automotive motion supports fleet navigation and car journeys; the optional owner Night Drive gesture never hides an operational action. Respect reduced-motion settings.

The build supports individual accounts alongside development-only training identities. Local private evidence storage and reference checklists remain development adapters/fixtures. Production object storage, identity hardening/recovery and Arihant-approved inspection templates remain release dependencies. See [implementation status](DEVELOPMENT_STATUS.md).

## ADR-02: Dependency direction and feature boundaries

Organize by business feature, such as inventory, inspections, acquisition, service, sales, delivery, warranty, finance, identity, and media. Within features, use these responsibilities:

| Layer | Responsibility | Boundary |
| --- | --- | --- |
| Domain | States, policy rules, value objects, readiness, approval validity | Python server policies and independent mobile utilities; no React, HTTP, database, platform, or model SDK dependency in policies |
| Application | Use cases such as submit inspection, approve quote, book car, release delivery | Coordinates domain rules and required ports; no SDK-specific code |
| Adapters | HTTP controllers, repositories, storage, device media, AI providers, notifications | Implements the contracts required by use cases |
| Presentation | Screens, guided steps, audio/visual prompts, view state | Calls use cases/client gateways; contains no direct SQL, provider keys, or authoritative business transitions |
| Composition | Runtime wiring and configuration | Selects real adapters for mobile, API, worker, and tests |

Define interfaces where a real boundary exists: repositories, media normalization/inspection, upload, identity, clock, speech, OCR, and AI. Keep straightforward CRUD straightforward. Do not create empty wrapper layers or generic base repositories for every table.

API schemas originate in Python; generated OpenAPI types and mobile runtime validators live in packages/contracts. Database models and server adapters are not imported into screens. Native SDK objects stop at their adapter. The backend enforces business rules even if a client has cached validation or a simplified interface.

Enforce import boundaries in CI and test meaningful policies independently from SDKs. Verify real adapter behaviour with integration/device tests.

Suggested repository layout:

```text
apps/
  mobile/                 # guided UI, local use cases, device adapters, draft queue
  web/                    # management UI and API client
  api/                    # business modules: domain/application/adapters
  worker/                 # durable jobs using the same business modules
packages/
  contracts/              # validated API/event payloads; no database imports
  design-tokens/          # colour, spacing, typography, touch-target tokens
  localization/           # approved text, prompt IDs, audio manifest
modules/
  media-processing/       # platform implementations behind a small TS contract
```

## ADR-03: Owner authority and transactional correctness

The owner has all business capabilities across the company. Manager, supervisor, inspector, and coordinator are combinable responsibilities. All business/My work/Awaiting my decision are views, not identity changes or permission switches. Assignment tracks accountability; it does not restrict owner access.

Keep the actual actor on every action, including owner self-review, reassignment, correction, and takeover. Corrections append traceable revisions. Staff scope and sensitive fields are enforced in repositories/use cases and all API/media/AI routes.

Use database transactions and constraints for critical invariants, including one confirmed active booking per acquisition cycle. Commands have idempotency keys and current-version checks. An approval applies to the version and amount reviewed. Outbox notifications follow committed changes; a failed notification cannot reverse or duplicate a financial action.

Server state is authoritative for approvals, confirmed bookings, financial posting, readiness acceptance, and delivery release. Offline capture is provisional until synchronized and accepted. Store timestamps in UTC with explicit timezone/local-date handling; device times remain supporting metadata.

## ADR-04: Fixed mobile media policy

**User requirement: videos are always 720p; photos are at most Full HD; processing happens on the mobile device before upload.** This applies to camera captures, gallery imports, and scanned photo/document pages. No quality picker or oversized-original upload path is exposed to staff.

| Asset | Landscape output | Portrait output | Additional rules |
| --- | --- | --- | --- |
| Video | Exactly 1280 × 720 | Exactly 720 × 1280 | MP4/H.264, standard SDR, AAC if audio exists; target 30 fps and cap higher-rate inputs at 30 fps without changing playback speed |
| Photo/document-page image | Fit within 1920 × 1080 | Fit within 1080 × 1920 | JPEG/sRGB, correct visual orientation, preserve aspect ratio, no upscaling |

Full HD is a bounding box, not a forced stretch. A 4:3 landscape photo becomes at most 1440 × 1080; a square photo becomes at most 1080 × 1080. Smaller photos remain smaller. Video capture uses 16:9 or 9:16. Other imported aspect ratios fit the target 720p frame using padding, preserving visible content rather than silently cropping or stretching it. Validate displayed dimensions after orientation handling.

Capture video at 720p where supported and inspect the actual output. Transcode incompatible captures/imports locally. Already compliant files can be validated without another lossy encode. If an imported video has insufficient source detail, prompt for a new capture; enlarging it must not be presented as better evidence. A failed processing operation remains local for retry/help and never falls back to uploading the oversized source.

Resolution is not a byte-size guarantee. Configure duration, bitrate, JPEG quality, file-size, and page-count budgets after actual-device/evidence tests. Keep enough detail to read the intended item. If a normalized image is unreadable, guide a closer shot or separate close-ups within the same limit; do not bypass the cap.

Use a versioned `MediaProfile` policy shared by mobile validation, upload admission, server inspection, and acceptance tests. Store actual dimensions, orientation, codec/container, duration where relevant, bytes, checksum, profile version, source type, and task/item links. Do not trust filename, MIME declaration, or client metadata alone.

Scanned documents are uploaded as normalized page images. Handover PDFs are generated from verified pages and structured records. Any added PDF-import flow must normalize its scanned/raster pages on the phone before uploading those evidence images; direct PDF import is not a hidden oversized-photo route. Original digital-document support, if required, needs a separately specified admission rule before it is enabled.

The immutable server evidence master is the **mobile-normalized uploaded file**. Thumbnails, OCR crops, video frames, and viewing copies reference that master. Previous mentions of preserving originals mean preserving this first accepted master and its revisions. Full-resolution camera/gallery source files are temporary local processing inputs and are not uploaded. No AI retouching, defect removal, or generative cleanup is permitted in evidence normalization.

## ADR-05: Durable media pipeline and adapters

```mermaid
flowchart LR
    A[Capture or import on phone] --> B[Persist local source and task context]
    B --> C[Resize or transcode on phone]
    C --> D[Inspect normalized output]
    D --> E[Persist upload-ready file]
    E --> F[Authorized private upload]
    F --> G[Server inspects actual bytes]
    G --> H[Verified evidence linked to item]
```

Model capture/processing/upload states explicitly: Source saved → Preparing → Ready to upload → Uploading → Verifying → Synced, with separate recoverable failures. The uploader only accepts a locally verified normalized asset. Screens use the understandable labels in the UX specification.

Photo resizing can use [Expo ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/). Use a narrow native media-processing adapter for video: [Android Media3 Transformer](https://developer.android.com/media/media3/transformer/transformations) and iOS AVFoundation export/composition. [Expo Modules](https://docs.expo.dev/modules/overview/) supports Swift/Kotlin adapters. Native presets and encoder fallbacks must be checked against actual output; no API's requested setting alone establishes compliance.

Expo Go supports photo workflows. Custom video preparation uses the local arihant-media Expo module and a development client. Android import, camera/microphone, 720p preparation, private upload and prepared-draft restoration were verified in Pixel_9a; the API admits verified 720p clips. iOS AVFoundation source exists, but native compilation/device verification and the wider media matrix remain release dependencies. No raw-source upload fallback is allowed.

Persist source files in protected staging until normalization is durably completed and verified locally. Recover or restart interrupted processing after app termination; partial output is never upload-ready. Once the normalized file is safe locally, release temporary large inputs according to cleanup policy. Retain the normalized file until server verification succeeds and the agreed local-cache conditions permit removal. Clean orphan staging files through a recovery-aware process.

Process bounded work away from the UI thread, limit concurrent encodes, report progress/cancellation, and account for low storage, battery/thermal limits, and OS background suspension. Do not transfer full video buffers through JavaScript. Resume tasks when the app returns if the platform suspended them.

The server checks actual asset type, dimensions, orientation/display size, video codec/profile, duration/size policy, and integrity before marking evidence verified. Reject noncompliant objects; do not repair a 4K source on the server as the normal upload route. Uploads are private/unverified until accepted. Web evidence entry, if enabled, must obey the same profile before upload; direct mobile capture is the primary employee workflow.

## ADR-06: Local-first capture and network synchronization

Use SQLite for draft/task/media state and app-private files for assets. Show saved-on-phone versus server-confirmed work distinctly. Sync uses explicit records, resumable/retry-safe uploads, current versions, and idempotent commands. A local success indication never implies a purchase/booking/payment/delivery has been accepted centrally.

Critical workflow submission requires required media to be verified. Conflicting inspection answers, prices, assignments, and approvals return for reconciliation rather than silent last-write-wins updates. Sync and processing queues expose actionable progress without asking employees to understand technical terminology.

## ADR-07: UI usable with little or no reading

The default employee journey is visual and guided: identify car → listen/see the check → capture → choose result → speak if needed → review → send. Standard instructions and core status messages have approved short text, visual cues, and offline-capable recorded prompts in supported languages. AI-generated content can help explain a draft but is not required to hear basic instructions.

Language, audio, text size, and assistance preferences are individual choices, not education-based account types. Permissions and technical training still determine assigned work. Owners and experienced staff can use compact views while retaining access to guided steps.

Centralize the design tokens, stable action positions, task/result vocabulary, accessibility semantics, and localization/audio IDs. Keep business policies out of translation strings and screen branching. Validate this architecture through the real-task user tests in [INCLUSIVE_UX.md](INCLUSIVE_UX.md).

## ADR-08: Small AI gateway and auditable drafts

Keep model providers behind adapters for transcription, structured extraction, optional image interpretation, and grounded explanations. Use the same authorization, source records, and domain use cases as manual work. LLM output cannot directly write database rows, run generated SQL, approve spending, or pass a check.

Model jobs reference source versions and produce draft fields/briefs with source IDs and unknown values. Confirmed changes pass normal validation. Record corrections, prompt/model versions, latency, and cost. Use bounded payloads and concurrency, source-version caching, spend limits, and retry limits. Typed/manual/recorded-note fallback preserves operations during outages; all included AI features must still pass their own release acceptance tests.

Optional on-device generative support is selected at runtime and never makes supported ordinary phones unusable. Exact offline-language promises follow measured device support. Marketing connections, model training, autonomous agents, and a separate vector database are not needed for this release.

## ADR-09: Verification and operating boundaries

Use focused domain tests for important policies; integration tests for persistence, authorization, transactions, jobs, and upload admission; device tests for normalization/offline recovery; and end-to-end tests for the complete business journey. Keep import-boundary checks in CI.

Test real encoded 720p output and Full-HD-or-smaller photos on both platforms, including orientation, imported 4K media, nonstandard aspect ratios, interrupted processing, HDR inputs, audio synchronization, duplicate retries, and unreadable close-ups. Never mark the media requirement complete based only on requested camera settings.

Release requires measured usability with staff across reading/digital-skill levels, all-business owner visibility, the complete operations/AI workflows, signed builds, backup restore, migration reconciliation, monitoring, and support ownership. The checklist is the release tracker; these decisions are the implementation baseline.


## ADR-10: Phones and tablets share adaptive workspaces

Support iPhone, iPad, Android phones and Android tablets in portrait and landscape. Expo declares tablet support and permits orientation changes; iPad does not require full screen. Choose layouts by available logical window width and text scale, including tablet multitasking windows, rather than device names. Keep content centered with a maximum width, constrain forms and sign-in controls, and use two panels for car intake, car overview/work, inspection photo/actions, and repair details/actions when enough width remains. Large text falls back to one panel. Reflow must retain the same screen state and local drafts.

Safe areas apply around the application and camera modal. Forms avoid the iOS keyboard; controls retain comfortable touch sizes on either platform. Inspection steps scroll horizontally instead of shrinking as a checklist grows. Business rules and API contracts remain identical across layouts. Verify on actual iPhone/iPad and Android phone/tablet hardware before release; exported bundles and resized Android emulator windows are useful development checks, not hardware acceptance.

## Implemented workflow slice

Car intake, draft template assignment, workshop registration, issue creation, repair assignment and parts/QC commands use parameterized SQL adapters, typed contracts, version checks, actual-actor audit/outbox events and durable command receipts in one PostgreSQL transaction. Pure task/repair policies decide allowed transitions; application services invoke them through adapter ports. Stock-cycle locking precedes task/repair locking to avoid cross-workflow lock-order cycles. Registration identity ignores case, spacing and punctuation, enforced by a company-scoped database index. A stock cycle records a new acquisition without discarding earlier vehicle cycles.

Task creation snapshots the selected template and version. Each submission and each owner decision is append-only; a recheck retains the earlier snapshot and requires new evidence IDs. Submitted work cannot be reassigned until reviewed or returned, preserving the actual submitter. Repair QC is linked to its job, cannot pass with a reported problem, and closes the issue only on acceptance. Reopening keeps the completed QC history. Repair/parts work never changes commercial booking status or silently declares a car ready for sale or delivery.

## ADR-11: Purchase commitments and cash records have separate facts

Purchase application services call pure approval/payment/handover policies through a purchase-store port. The PostgreSQL adapter locks the stock cycle before the purchase, and commits the command receipt, business changes, audit and outbox together. One purchase belongs to one company stock cycle. Every saved terms version, approval, payment and payment correction is immutable. Approval snapshots retain the terms, inspection versions, actual actor and self-review flag. Changing terms invalidates approval; changing pre-purchase inspections invalidates an uncommitted approval. Once the agreement is recorded, the approved commitment remains payable; new findings use intake/service work rather than changing its historical inspection approval.

Store INR amounts as integer paise, enforce strict integers and input bounds on the server, and parse user-entered rupees without floating-point multiplication. Expected contribution is resale minus purchase price, repair budget and direct-expense estimate. It remains a forecast; the implemented actual-cost ledger and cash records do not establish accounting profit without approved definitions. Purchase proposals are accessible on assigned cars; financial authorization, company-wide financial history and reports belong to Owner/Supervisor. Generic employee timelines omit privileged financial details.

A payment records an external transaction already completed. It does not initiate a transfer. Serialize writes per purchase, reject amounts above the outstanding balance, and reserve company/method/reference combinations under an advisory lock to prevent concurrent duplicate entries across cars. A mistaken-entry correction retains the original transaction, records its actor/reason, updates the net balance and releases the reference for a corrected entry. It is not a refund. Idempotent replays return the original receipt instead of appending another payment.

Keep document clearance, signed agreement, recorded payment completion and physical receipt independent. Acquiring requires accepted inspection, current approval, recorded seller/registration/ownership checks, resolved loan-check state and an agreement reference. Physical handover records location, odometer, fuel, keys, condition and a reference, assigns an intake checklist to the selected person (including the owner), and optionally raises an open arrival issue. It moves the car into refurbishment while preserving booking state; it cannot declare readiness. Private normalized document pages can now be uploaded and reviewed; published company document requirements now bind to accepted pages; checkboxes/references alone cannot satisfy a required page. Draft checklist acknowledgement is allowed only in development/test, with explicit owner acknowledgement; production business approval requires approved checklists.

## ADR-12: Native uploads and management reports

The shared API client owns HTTP contracts and authentication/error handling. Platform media upload is an adapter: mobile streams app-private normalized files with Expo FileSystem multipart upload and a bounded cancellation timeout; web upload entry is disabled. No React Native file object is passed to a browser-style FormData implementation, and no complete video buffer crosses JavaScript. Draft state keys and resource-cache keys use separate namespaces.

Owner reports use one repeatable-read database snapshot for matching stock, aggregate totals and cutoff. Monetary values remain integer paise. Invoices determine incurred operating cost; vendor payments determine cash movement and must not add that invoice cost again. Per-job outstanding balances/advances are calculated before aggregation so an advance on one job does not erase another job's debt. Corrections exclude their original entries without deleting history. CSV export is authenticated, private/no-store, bounded and formula-escaped. Financial totals are operational records rather than an unapproved accounting-profit calculation.


## ADR-13: Company policy, work progress and issued terms have separate lifetimes

Owner/Supervisor and Employee are the operational levels. New staff commands
accept one of those working responsibilities; historical roles remain readable.
A legacy manager is interpreted as supervisor, rather than adding a manager tier.
Owner-only policy and identity administration remain explicit. API policies enforce
authority independently of UI visibility; mobile/web share the capability mapping.
Assigned employees can prepare proposals, request quotes and log private evidence
without acquiring financial approval authority. Progress while a quote is pending
does not approve the quote or its spending. The existing version, exact-quote,
budget, transaction-locking, audit and command-receipt guards remain in force.

Document rules are owner-published immutable company versions. A stage receives an
immutable requirements snapshot, with separate sale scopes for each booking.
Append-only links refer to real private documents; review state determines
completion. Finalized bindings cannot be relinked. Starter version 0 is explicitly
unpublished: it supports configuration without pretending to be approved company
policy. Publication applies to new assignments and does not rewrite old ones.
Applicability notes are instructions, not an automatic clearance or waiver.

A car's current sale has a configurable warranty draft. Delivery issues a snapshot
of that configuration, calculating 3/6/12 calendar months with month-end clamping
from the persisted delivery timestamp. Reconfiguration is rejected for a closed
booking. Later resales have independent sale records. Customer complaints are
assessed against the original issued terms rather than today's defaults.

Language is an individual preference, scoped to the authenticated user on the
device. Stable check IDs and assigned evidence stay independent of display language.
Marathi content fields are additive so historical bilingual snapshots remain
readable. Missing translations are a release gap, not synthesized company facts.
