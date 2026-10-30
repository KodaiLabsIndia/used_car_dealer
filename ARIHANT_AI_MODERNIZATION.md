# Arihant Cars — lightweight AI and mobile capabilities

Full-release scope · 29 October 2026 · Companion to [the operations plan](ARIHANT_OPERATIONS_PLAN.md)

All eight capability groups below are included in the same full release. Their order is an internal implementation dependency, not a separate-release plan. [The checklist](DEVELOPMENT_CHECKLIST.md) tracks implementation. [Architecture ADR-04](ARCHITECTURE_DECISIONS.md#adr-04-fixed-mobile-media-policy) governs mobile preparation of 720p videos and Full-HD-or-smaller photos; [the inclusive UX specification](INCLUSIVE_UX.md) makes spoken/visual operation essential for staff who need it.

## 1. Direction

Make the app easier to operate while improving the quality and accessibility of the business record. Employees should be able to scan, speak, photograph, confirm, and continue. The owner should be able to ask what is happening, inspect the supporting records, and act from the same screen.

Treat “Luna kind” as a small, fast, economical model tier. The exact provider is open. Some features need only ordinary application logic or existing mobile ML; occasional image understanding requires a model with vision capability. A text-only small model can still organize OCR output, transcribed speech, and structured business records.

Validate the included features against Arihant's actual phones, documents, language mix, workshop noise, inspection photos, and reading/digital-skill levels. Core instructions, structured choices, and help must work with visual/audio support even when model processing is unavailable. No marketing-app exchange is included.

## 2. Highest-value features

| Feature | Employee/owner experience | Lightweight approach | Internal build order |
| --- | --- | --- | --- |
| Speak to log work | Employee dictates findings or a workshop update; the app drafts the right fields and linked issues | Short speech transcription plus constrained extraction using current car/task context | First |
| Scan to fill fields | Scan registration, VIN/chassis, odometer, documents, quotes, and invoices | On-device OCR first; small model organizes difficult layouts; user confirms identifiers and amounts | First |
| Guided evidence capture | Camera prompts for the required view and flags unusable captures | Overlays, focus/exposure/shake checks, OCR readability; selective vision check on saved images | First |
| Owner brief and questions | Owner asks what is stuck, why, who must act, or what needs review | Application retrieves permitted records and computes facts; small model explains with links | First |
| Quote and invoice assistant | Scan a quote, attach it to a job, and see changed or extra items | OCR/extraction plus deterministic comparisons and arithmetic | First, extending scan-to-fill |
| Voice task creation | Owner dictates an instruction and confirms a structured task or reassignment | Fixed action types, name/date resolution, permission checks, preview before saving | After task/permission foundations, same release |
| Before/after repair review | Reviewer opens paired evidence and a short account of what changed | Match by car/issue/view; show accepted evidence masters side by side; advisory vision summary | After repair/evidence foundations, same release |
| Delivery and warranty brief | Generate a handover summary or complaint chronology from accepted records | Short grounded summaries using the issued warranty and actual transaction records | After delivery/warranty foundations, same release |

### A. Speak to log work

Example employee statement: “Front-left door has a scratch. AC cooling is weak. Workshop says compressor diagnosis tomorrow. Quote not received.”

Draft result:

- Body issue: front-left door scratch, photo needed.
- AC issue: weak cooling, diagnosis pending.
- Next action: obtain diagnosis from the selected workshop tomorrow.
- Quote: pending, with no invented amount.

The employee sees the draft alongside the original transcript and can hear it through supported spoken readback, replay the original note, correct it, or ask for help before confirming. Reading the transcript is optional. Only the checks actually mentioned get proposed answers. All unmentioned checklist items remain unanswered, and each required item still needs its evidence. The app clarifies ambiguous car, panel, assignee, amount, or date through understandable spoken/visual choices.

Test English, Hindi, Marathi, and mixed workshop vocabulary. Preserve the original observation when creating a translated display version. Use a glossary for model names, parts, workshops, and staff. Do not promise identical offline speech recognition for every language or phone: Google's current [on-device speech documentation](https://developers.google.com/ml-kit/genai/speech-recognition/android) lists language/device restrictions, including beta Hindi support, and does not explicitly list Marathi in its language table. Provide cloud transcription where supported, plus typed entry and queued recordings as fallbacks.

Prefer short push-to-talk notes in the current car or task screen. Continuous conversation and automatic ambient recording are unnecessary for this workflow.

### B. Scan to fill fields

Use the camera to propose registration and VIN/chassis text, odometer reading and unit, tyre date markings, document fields, quote line items, invoice numbers, amounts, and dates. Treat dashboard symbols as a recorded visible observation requiring confirmation, not a mechanical diagnosis.

Each proposed value should link to the original image and, where possible, its bounding box. Mark missing or unreadable values as unknown. Check identifiers against the selected vehicle and flag changes in readings for review, considering units, capture date, and previous extraction errors. Extracting document text does not verify authenticity or official status.

[ML Kit text recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2) supports iOS/Android and Latin/Devanagari scripts. Its [document scanner](https://developers.google.com/ml-kit/vision/doc-scanner) supplies an on-device Android scan flow; iOS needs an appropriate native scanning path. These are building blocks; registration formats, odometer screens, glossy documents, and handwritten workshop bills need their own evaluation.

The phone first prepares photos/scanned pages within Full HD and videos at 720p under ADR-04. Preserve the first accepted normalized file as the evidence master; keep higher-resolution input temporary and local. Source crops/frames reference that master, and cloud OCR/AI payloads respect the same media limits. If detail is unreadable after normalization, request a closer shot. Any OCR viewing adjustment must not replace evidence or erase defects, marks, or other relevant details.

### C. Guided evidence capture

Show checklist-specific instructions such as “Include the complete tyre sidewall and date marking” or “Capture the dashboard with odometer visible.” Use an outline/angle guide and optional previous-image overlay for repeat views.

Start with cheap checks for blur, exposure, motion, empty frames, and whether required text is readable. Suggest a retake before the employee leaves the car. Actual sharpness and legibility must be checked in the image; a stable phone alone does not establish either.

Selective vision calls can suggest that the picture appears to show a cabin rather than the requested engine bay, or that an expected part is obscured. Those suggestions require validation and must not auto-pass a safety check. Exact hashes and simple similarity checks can flag reused images; reuse is a review question, not proof of misconduct.

For short videos, use the mobile-normalized 720p clip and selected frames with timestamp links. Preserve that accepted video master. A clip mapped to several checklist items still needs item-specific segments and reviewer acceptance. Process selected saved frames rather than sending a continuous camera stream to the cloud.

### D. Owner brief and questions

Examples:

- “Which booked cars may miss their delivery date, and why?”
- “Show cars waiting for parts for more than three days.”
- “What changed on this car since I last reviewed it?”
- “Show repair quotes above the approved budget.”
- “Has this car had an earlier AC complaint?”

The application uses approved filters and queries to find relevant records. It computes amounts, counts, deadlines, and readiness using business rules. The small model explains the returned facts and cites the car, job, invoice, or checklist record for each material statement. Start with a short menu of supported questions and filters; open-ended analysis can remain outside the first release.

Example answer: “Car AC-024 has a Saturday delivery commitment. Brake pads are due Friday, and repair QC is still pending. Service coordinator Ravi owns the next action.” Each finding opens the underlying record. If dates or evidence are missing, show that gap instead of predicting completion.

Owner access spans the business, including costs and staff work. Employee answers remain within their permissions. The owner's My work view remains a focus filter; they can choose a clearly labelled company-wide question scope. Answers show their data cutoff and missing updates. Fresh questions re-read the database; a saved summary is not current status.

For routine morning and evening briefs, rules identify exceptions first and the model groups them into a short explanation: delivery risk, approvals, delayed parts, cost changes, and missing updates. No predictive-model training is needed for this.

### E. Quote and invoice assistant

Extract the selected job, vendor, reference number, parts, labour, taxes/charges, total, and promised dates into a draft. Compare the current quote with the approved version. Highlight additional work, quantity changes, changed unit prices, missing references, or a possible duplicate invoice.

All arithmetic, budget checks, and duplicate-record checks are application logic. Language models help interpret layout and differing part descriptions. Missing prices remain unknown, and an unapproved invoice does not silently create an approved cost or payment. Similar historical bills can be shown as context when available, with their dates and scope; do not describe them as current market pricing.

### F. Remaining included capabilities

- Owner voice actions: “Assign the brake recheck on AC-024 to Ravi tomorrow morning.” Resolve the people/car/date, show a preview, then save the confirmed task under the real owner's identity. Use the existing approval screen for financial decisions.
- Before/after review: pair evidence by car, defect, view, and capture time. An optional description can flag a visible difference; it cannot establish internal mechanical repair quality. The reviewer records acceptance.
- Delivery brief: assemble accepted inspection findings, completed repairs, customer promises, handover items, and issued warranty terms into a reviewable summary.
- Warranty brief: organize the complaint timeline, prior repairs, issued coverage clauses, and missing information. The authorized person records the coverage decision and customer response.
- Staff guidance: show the approved checklist instruction, example photo, or a short translation for the current task. An LLM may rephrase the instruction while preserving its meaning and source; it should not invent a repair procedure.

## 3. Practical use of phone hardware

| Hardware/capability | Proposed use | Product boundary |
| --- | --- | --- |
| Camera | Item evidence, OCR, document capture, QR identification, paired repair views | Preserve originals; validate extracted information |
| Microphone | Short findings, service updates, complaint notes; optional engine-sound recording for a mechanic to review | Recording sound is useful evidence; automated fault diagnosis is outside the lightweight release |
| Gyroscope/accelerometer | “Hold steady” guidance, orientation cues, steadier repeated captures | Measures phone movement; does not establish vehicle mechanical condition |
| Location | Capture location, accuracy, and time when a user records a dispatch, receipt, or handover | Identifies the phone's position at that event, not a continuously tracked car |
| QR scanning | Open the correct stock record and link an inspection or movement to it | Show car identity for confirmation; a copied QR is not proof of physical custody |
| Torch, haptics, speech output | Lighting assistance, capture confirmation, spoken checklist prompts | Use capabilities available on the phone, with visible/touch alternatives |

The [Android sensor framework](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview) supports motion/orientation data and runtime capability detection; actual hardware varies. Use camera-image brightness for cross-platform lighting guidance rather than assuming access to an ambient-light sensor.

For workshop receipt, combine the user's selected workshop, QR/car confirmation, condition photos, timestamp, custodian acknowledgement, and optional event location. Display this as a recorded handover with supporting evidence. Indoor location accuracy and phone identity limit what location alone can establish.

No special phone hardware is required for the proposed core. LiDAR, thermal attachments, OBD accessories, continuous route tracking, and sensor-based engine/brake/tyre-health scoring are outside this lightweight scope.

## 4. Simple AI architecture

1. Capture and store locally: photo/video/audio, car/task context, timestamps, and processing/upload state.
2. Prepare compliant media locally: normalize videos to 720p and photos/scanned pages within Full HD, inspect output, then perform QR/OCR/quality checks and supported speech/model processing.
3. Send the smallest necessary payload to one backend AI endpoint when model processing is useful.
4. Return a constrained draft or explanation with source references and unknown fields.
5. Validate types, identifiers, permissions, workflow rules, amounts, and source references in application code.
6. Let the employee or owner confirm a proposed business-record change through the normal app flow.

Use one small model tier initially, short prompts, fixed output fields, and bounded calls. No autonomous multi-agent workflow, custom model training, separate vector database, or unrestricted generated SQL is needed. Car/issue links, ordinary search, and structured queries cover the first features.

The API can support [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), but schema conformity is only a format guarantee; factual correctness still needs validation. Treat text in invoices, documents, and transcripts as source data, not authority to issue commands or change permissions. Model-proposed writes remain drafts until confirmed and accepted by the same server rules as manual entry.

Use core phone ML plus a cloud fallback as the common baseline. On capable devices, optional [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels) and [Android ML Kit GenAI](https://developers.google.com/ml-kit/genai) can perform selected local tasks. Their availability depends on device, OS/model configuration, and language; detect support at runtime. Test the native integrations on both platforms before making an offline AI promise. Ordinary capture and manual operations must continue when model processing is unavailable.

A current cloud candidate is [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), documented as a low-latency multimodal model supporting structured output. It is a candidate to compare with the intended Luna-class model on Arihant examples, not a claim of superior automotive accuracy. Use a vision-capable route only for tasks requiring images.

AI jobs record their source record/version, model/prompt version, generated fields, user corrections, and final confirmation. If the source changes during processing, identify the draft as stale and refresh before applying it. Do not overwrite a staff member's newer edit. Apply the same business permissions to AI requests, source retrieval, stored summaries, and media access.

## 5. Keep running costs small

- Run checks, reminders, arithmetic, readiness rules, and date comparisons in application code.
- Process a completed capture or note once; do not invoke an LLM on every keystroke, camera frame, or checklist tap.
- Give the model only the selected car/task and relevant records.
- Use OCR text before sending a full document image where sufficient; retain an image fallback for layout or reading ambiguity.
- Reuse results for unchanged source versions; invalidate summaries when their inputs change.
- Enforce mobile-side 720p video and Full-HD photo/page limits before uploads or cloud-AI calls; bound clip length, generated output, retries, and per-user/day usage. Preserve the accepted normalized evidence master and guide close-ups when needed.
- Prefer a predictable queued result over chains of model calls. Set provider-spend alerts and keep capture available when a limit or outage occurs.

Illustrative token calculation, not an operating-budget estimate: current [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite) lists standard Flash-Lite at $0.30 per million input tokens and $2.50 per million output tokens. Assuming 2,000 input and 300 total billable output tokens per text task, 10,000 tasks cost approximately $13.50 in model tokens. Speech recognition, extra image/video tokens, retries, storage, network, and infrastructure add separately. Measure cost per completed workflow during internal validation before quoting monthly spend.

## 6. Build sequence and full-release evaluation

Prototype one coherent assistant flow:

1. Employee scans the car QR and confirms the car.
2. Captures the requested image with quality guidance.
3. Dictates findings; OCR supplies visible fields where relevant.
4. Reviews the extracted draft, supplies missing evidence, and submits it.
5. Owner opens a concise review brief, inspects original evidence, requests a recheck or approves through the existing workflow.

Add quote/invoice extraction using the same scanning and draft-confirmation pattern. Add a small set of source-linked owner questions using existing database filters. This gives the first release useful AI without creating a separate complicated subsystem.

Evaluate with real examples before accepting a feature:

- Speech: accents, mixed languages, workshop noise, part names, negation, amounts, and dates. Confirm that unmentioned checklist checks stay unanswered.
- OCR: glare, blurred photos, digital/analogue displays, identifier confusion, units, handwritten bills, and multi-page invoices. Report correction rates by field type.
- Evidence guidance: whether prompts improve usable captures, how often good photos are incorrectly rejected, and whether distinct items remain individually verifiable.
- Owner answers: correct counts/amounts, source links for material claims, current versus stale data, missing-data behaviour, and employee access restrictions.
- Proposed actions: ambiguous cars/names/dates, stale drafts, cancellation, double submission, and real-actor attribution.
- Reliability: basic Android and iPhone operation, offline capture, queued AI processing, provider outage, latency, battery/thermal behaviour, and measured end-to-end costs.

Track staff correction effort, task comprehension, and time to finish the workflow, not just whether a model produces an answer. Set acceptance thresholds after a labelled baseline exists. Build before/after comments, voice task actions, and delivery/warranty briefs on the capture, record, and permission foundations, then validate all eight groups before the same full release. A fallback preserves operation during failure but does not mark an unimplemented AI feature complete.
