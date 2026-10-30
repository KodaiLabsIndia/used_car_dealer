# Arihant in motion · Three app directions

Open [preview.html](preview.html) in a browser. It is self-contained and needs no server, installation, or network connection. Browser speech playback depends on available system voices; the core preview works without it.

| Direction | Visual and interaction approach |
| --- | --- |
| 01 · The Drive | Photo-led work cards, connected car records, large owner stock summary |
| 02 · Pit Lane | Spoken next-step control, generous task actions, owner briefing and follow-up work |
| 03 · Garage | Carbon inspection workspace, camera framing, clear step numbers, vehicle and decision view |

All three use the original website logo, website red (#C72128), black (#070707), white, and Plus Jakarta Sans. See [BRAND_REFERENCE.md](BRAND_REFERENCE.md) for source assets and treatment rules. The moving red car is also the original asset from Arihant’s website.

Scroll through the opening road to explore inspection, purchase, refurbishment, final checks, and delivery/warranty. Five stage buttons and arrow keys offer direct navigation. Reduced-motion mode uses the stage buttons without automatically moving the car during scrolling. This is a preview of the workflow: exploring the road never updates operational car status.

All three employee/owner home screens have been redesigned. Functional controls retain icons and labels; decorative artwork never carries required instructions. Content scrolls inside each phone. At tablet and phone widths, the gallery stacks the concepts for comparison; expand a direction using its arrow button to view it alone.

Try these interactions:

- Switch between Employee and Owner using the controls above the phones.
- Switch phone labels between English and Hindi.
- Open a car check, add a demo photo, choose a result, and send it for review.
- Choose Need help without completing the check; work is retained in the sample flow.
- Open a car, inspect its parallel statuses, and take over a task as owner.
- Switch All business/My work/Decisions without losing owner access.
- Open the business assistant, choose a sample question, and follow the source record.
- Review a sample repair quote, preview a voice note, or try the sample QR identification flow.
- Choose a direction; the selection is saved in this browser. Tell us the chosen number/name in chat.

This is an isolated design prototype using sample operational data. Camera capture, voice transcription, AI responses, uploads, approvals, and business updates are simulated. Optional spoken prompts use browser speech synthesis on user action. No production account, external business API, marketing integration, or file upload is connected.

The editable sources are index.html, brand-tokens.css, styles.css, collection.css, app.js, and drive-story.js. Website identity tokens live in brand-tokens.css, shared components in styles.css, visual treatments in collection.css, application mock interactions in app.js, and the scroll exploration in drive-story.js. Internal concept IDs remain everyday/saathi/focus so existing saved choices and preview URLs still work. Run `python3 build-preview.py` after edits to regenerate the self-contained preview. The optional `npm run dev` serves the editable version at port 5173 in environments permitting a local server; it is not needed to review the file.

Car photos are sourced from the dealer's public [Arihant Cars website](https://www.arihantcars.com/) for this private mockup. Presentation copies remove black image margins and remain below Full HD. Their sample work assignments and operational states are fictional. The media-processing policy in the production plan is not implemented by this design demo.

Plus Jakarta Sans is bundled for offline presentation. Its Open Font License is included under assets.

Validation passed: JavaScript syntax; all three inspection flows; required photo/result gating; help without a photo; QR/car confirmation; sample voice notes; owner scopes/takeover; source-linked answers; quote review; Hindi switching; concept filters; selection persistence; and embedded assets. Additional checks verify the byte-identical original logo in the packaged gallery and all phone headers, its correct 196:126 aspect ratio, five road stages, scroll geometry, keyboard controls, reduced-motion mode, and the separation of scroll position from operational status. These checks used a DOM environment; the logo was also inspected as an image at its intended display sizes. Browser-rendered screenshots/device-layout acceptance remain to be verified because the current sandbox blocks browser execution. This design preview does not mark the production implementation checklist complete.
