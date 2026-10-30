# Arihant Cars — inclusive employee and ecosystem experience

29 October 2026 · Required for the full release

## 1. Design baseline

Employees may have limited formal education, limited reading ability, little phone experience, or be comfortable with detailed interfaces. The same product must support them with dignity. Build essential staff workflows so they can be understood through pictures, short spoken instructions, familiar actions, and demonstrations, without long forms or mandatory typing.

Reading ability, language, inspection skill, and responsibility are different things. Do not label people by education in the product or infer job authority from a UI preference. Assign technical checks to appropriately trained staff and make the instructions understandable.

Use [W3C cognitive-usability guidance](https://www.w3.org/TR/coga-usable/) as a source for clear steps, familiar controls, understandable content, help, and avoiding memory-dependent journeys. Apply the patterns based on observed user needs rather than assuming a disability. Larger, well-spaced controls and sufficient contrast also follow [target-size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) guidance.

## 2. Employee home and car identification

Start with three prominent destinations: My work, Scan car, and Help. The work list contains the employee's current assignments, returned work, and next actions. Additional authorized duties remain reachable in context. Management views provide broader navigation; they do not add clutter to an employee's immediate task.

Each task card shows a real car thumbnail, registration/stock identity, component/task picture, next action, and deadline with a play button for spoken details. QR scanning opens a car confirmation screen with its picture and identity before evidence is added. Offer assigned-car selection when a QR is damaged. Similar-looking cars require identifier confirmation; appearance alone is not sufficient.

The employee's primary path is:

1. Open an assigned task or scan the car.
2. Confirm the car visually and with optional spoken identity.
3. Hear/see one instruction and an example of the required view.
4. Take the photo/video or record the required measurement.
5. Select the result and, if useful, speak a short note.
6. Review the picture/result and hear the proposed summary.
7. Send the work or save it on the phone when offline.

Returning to the app resumes the correct saved step. The employee can repeat the instruction, go back, retake, change a result, or ask for help without losing prior work.

## 3. One check at a time

Show the relevant car part or region, a real/example view, one short instruction, and one obvious primary action. A checklist is presented as guided steps grouped into sensible sections; it is not a wall of 151 tiny controls.

Proposed result choices, subject to real-user comprehension tests:

| Meaning | Display | Behaviour |
| --- | --- | --- |
| Check performed, no problem found | Check symbol + “OK” + spoken explanation | Requires applicable evidence/measurement |
| Problem found | Repair/problem symbol + “Problem” + spoken explanation | Collects evidence and creates/suggests the linked issue |
| Cannot perform/complete the check | Help symbol + “Need help” + spoken explanation | Saves work, records the limitation, and routes a follow-up |
| Check does not apply | Secondary guided option with explanation | Requires reason and the configured review |

Colour reinforces these meanings; it is never the only distinction. Icons are tested locally and accompanied by short labels/audio. A thumbs-up, green colour, or uploaded photo alone must not imply the inspection was performed and passed.

Show progress with completed step/section markers and optional spoken status. Keep “work captured,” “work sent,” and “supervisor accepted” visually distinct. Provide a visible unfinished list for supervisors and employees who prefer it.

## 4. Voice, language, and supported alternatives

- Let the user choose a language by hearing its name as well as seeing its native label. A supervisor can help with first-time setup.
- Provide approved recordings for core instructions, result meanings, confirmations, upload/offline states, and help. Package/download the selected language pack before field use so basic guidance works offline.
- Use short prompts that can be replayed, paused, and muted. Respect audio/privacy preferences and provide visual equivalents in noisy or shared environments.
- Voice input is push-to-talk with visible recording/playback controls. Let employees replay the recording and hear an AI draft before confirming it.
- Preserve the original recording/observation and distinguish it from a translated or cleaned-up draft. Clarify ambiguous parts, numbers, dates, and people.
- Offer picture choices, structured selections, a numeric keypad where necessary, and an optional typed route. A supervisor-assisted path is available when an employee cannot complete a field accurately.
- Use localized spoken readback for consequential amounts, units, car identity, and dates. Never rely on an unchecked transcription to confirm a payment, measurement, or approval.
- Core operation must remain usable when speech recognition or generative AI is unavailable: retain the spoken note, evidence, structured result, and a visible request for assistance/review.

Supported languages and offline speech recognition are distinct commitments. Verify each on the actual supported phone matrix; an offline instruction recording does not imply offline transcription works.

## 5. Simple product language and stable controls

Use familiar words in each supported language and validate them with staff. Technical states remain in the data model and management detail, while the employee gets the actionable explanation.

| Internal concept | Example employee wording |
| --- | --- |
| QC rejected; resubmission required | “Take this tyre photo again. The number is not clear.” |
| Local draft; upload pending | “Saved on this phone. It will send when internet returns.” |
| Media normalization in progress | “Preparing your video.” |
| Upload in progress | “Sending your work.” |
| Server received; reviewer pending | “Sent. Your supervisor will check it.” |
| AI extraction uncertain | “Please check this number.” |
| Invalid workflow transition | “Finish the brake check before handing over the car.” |

Keep the main action in a stable position, use a visible back control, and avoid hidden gestures, long-press-only actions, unfamiliar abbreviations, and unexplained error codes. Critical actions use a short understandable confirmation with the affected car/value shown and optional readback. Routine capture remains quick.

Provide save/undo/correction paths and prevent accidental double submission. Do not use timers or disappearing messages as the sole way to understand an error. A “Need help” action preserves the task and gives the supervisor the car, exact step, and optional recorded question.

## 6. Visual and accessibility targets

These are product design targets to validate, not a claim of achieved accessibility certification:

- Main employee controls have at least 56 × 56 logical-unit hit areas, generous separation, and clear labels; other controls meet applicable platform/accessibility requirements.
- Start with an approximately 18-unit body-text token and support system text-size changes; verify layouts through 200% text scaling without losing actions or required content.
- Use text contrast of at least 4.5:1 for ordinary text and 3:1 for qualifying large text; ensure visible controls and meaningful graphics have sufficient contrast.
- Pair states with shape/icon/text/audio as appropriate. Do not rely only on red/green, sound, motion, or a tiny badge.
- Provide screen-reader labels, correct focus order, language metadata, visible keyboard focus on web, and accessible names for capture/audio controls.
- Support reduced motion, outdoor lighting, one-handed use where practical, and portrait phone layouts with reachable primary actions.
- Validate camera examples, gestures, icon meanings, and translations with local staff. Do not assume an illustration is universally understood.

All photos/videos follow the fixed policy in [architecture ADR-04](ARCHITECTURE_DECISIONS.md#adr-04-fixed-mobile-media-policy). The phone prepares the media automatically. Employees are guided to a closer shot when a resized image is unreadable and are never asked to choose codecs, resolution, bitrate, or processing settings.

## 7. Owner and ecosystem experience

The owner has company-wide overview and direct operational actions. All business/My work/Awaiting my decision stays clear; owners can open the same guided inspection screen when working personally. More detailed reports and compact work boards are available without making the employee path more demanding.

Supervisors receive review cards containing the actual evidence, understandable employee notes/recordings, the requested check, and clear accept/recheck/help actions. They can return a specific step with a short spoken or written explanation. The employee receives that explanation at the same step.

Service coordinators record outside-workshop updates, parts, ETAs, quotes, and handovers. Workshops do not need a new app account to participate in this release. Work-order summaries use clear car identity, pictures of relevant faults, and specific requested work while excluding dealer margins and unrelated customer data.

Sales/accounts/documentation users receive the detail needed for their responsibilities, while common capture and confirmation patterns remain familiar. Customers/sellers benefit from clear condition/handover summaries, recorded commitments, warranty explanations, and explicit follow-ups through staff. Explain consequential acknowledgements in the person's chosen supported language where available; an audio explanation supports understanding but does not automatically establish a legal signature.

Each staff member keeps an individual identity, including on shared devices. Assisted enrollment/unlock and account switching must be understandable, with no need to share an owner's login. Supervisor help is attributed to the real person taking the action rather than silently altering another employee's work.

## 8. Real-user acceptance

Test the release candidate with people across reading ability, language, digital confidence, and job responsibilities. Include employees who need spoken/visual guidance, experienced staff, supervisors, and the owner. Observe actual completion rather than asking only whether the interface looks easy.

Required journeys:

- First-time language selection and assisted activation, then recognizing the correct signed-in identity.
- Finding assigned work and identifying the right car among similar cars.
- Following a photo-based/spoken check, selecting the correct result, and recording an issue.
- Taking a readable close-up within the Full HD cap and capturing a 720p clip without configuration work.
- Understanding a returned photo/recheck request and fixing the exact item.
- Resuming after app interruption and distinguishing saved-on-phone, sent, and accepted work.
- Completing a task when speech recognition is unavailable and requesting help without losing evidence.
- Hearing/checking a proposed number/date and correcting a bad transcription or OCR result.
- Owner delegation, review, takeover, and return to company-wide visibility.
- Supervisor/workshop/customer handover using the correct scoped summary and acknowledged next action.

Record completion without intervention, assistance needed, wrong-car/result selections, mistaken completion assumptions, missed confirmations, media retakes, and time/effort. Set comprehension/completion targets before acceptance. Resolve recurring critical misunderstandings and retest with representative users. A clean visual design alone does not complete this gate.


## Phone and tablet layouts

The same guided employee flow runs on iPhone, iPad, Android phones and Android tablets. Use the current window width so a tablet in split view behaves like a compact screen. On wide windows place the instruction/photo beside result and action controls. Keep controls large and keep each step in the same order. Longer checklists scroll through comfortably sized step buttons. Portrait, landscape and larger text must preserve the selected check, photo and unsent draft. Test rotation, keyboard overlap, safe areas and touch reach with staff on both phone and tablet hardware before acceptance.
