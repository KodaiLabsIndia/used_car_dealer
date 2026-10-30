# Arihant · Four ways to work

Open [preview.html](preview.html) in a browser. The file works offline and embeds the original Arihant logo, existing dealer photographs, Plus Jakarta Sans, styles, and interactions. Select a workspace on the left and use **Phone / Tablet** to compare its arrangements. On narrow browser windows, the concept selector moves above the preview. A tablet canvas viewed on a phone can be panned horizontally.

These four complementary workspaces extend the selected Garage identity. This directory is a separate design study. It has no connection to the Expo app, backend, database, marketing app, or real business records. Production app implementation remains subject to review.

| Workspace | Arrangement | Try |
| --- | --- | --- |
| 01 · The Collection | Vehicle photograph and a compact operational sheet; tablet adds side-by-side detail and a vehicle selector. | Change car, inspect the next action, work as supervisor while retaining owner access. |
| 02 · Inspection Studio | Numbered photographic areas, section tabs, one instruction, evidence and result controls. Tablet places the task beside the photograph. | Add sample evidence, choose a result, save and advance, revisit a check, switch EN/HI, hear an instruction. |
| 03 · Deal Desk | Persistent purchase forecast with Seller / Value / Documents / Approval panels. Tablet uses a financial sidebar. | Adjust estimates, review missing documents, inspect the approval requirements. |
| 04 · Service Wall | Phones show a selected work category. Tablets show In bay / Waiting / Quality check columns. | Open a job, receive a sample part, preview QC sign-off, review shift handover. |

The layouts use Arihant's original red `#C72128`, black, charcoal, white, logo and font. Warm neutral task surfaces support the brand. Status colour is accompanied by text and icons. No moving-car road animation is repeated in these workspaces. Brand provenance is in [BRAND_REFERENCE.md](../BRAND_REFERENCE.md).

## References and interpretation

These official automotive websites informed composition and interaction ideas. The operational workspaces are our proposed adaptations; the referenced brands do not supply these dealer workflows.

- [Porsche](https://www.porsche.com/usa/): vehicle photography and model discovery → Collection.
- [Lamborghini Revuelto](https://www.lamborghini.com/en-en/models/revuelto-models/revuelto): exploration by vehicle component → Inspection Studio.
- [Polestar](https://www.polestar.com/us/): focused selection and shopping workspaces → Deal Desk.
- [Aston Martin Vanquish](https://www.astonmartin.com/en/models/vanquish): separate engineering subjects → Service Wall.

## Scope of the simulation

All operational identities, money, check results, jobs and statuses are sample data. Each workspace is an independent vignette; the incoming purchase example and the stocked Collection example are different workflow moments. Inspection contains ten illustrative checks, not Arihant's official inspection specification. Saved samples last only in the open preview session. Reloading resets the data.

Camera, evidence, help, approvals, document storage, QC and parts updates are simulations. No camera permission is requested, no upload occurs, no message is sent, and no approval or payment is executed. The proposed phone-side Full HD photo / 720p video policy is not implemented here. Optional instruction playback uses browser speech synthesis and depends on installed voices; text remains visible. Hindi is demonstrated for inspection instructions and primary inspection controls; this is not a fully translated app.

## Review artifacts and validation

- [Four phone concepts together](review/four-workspaces.png)
- [Four tablet concepts together](review/four-tablets.png)
- [Full concept board](review/01-collection-board.png)
- [Collection tablet](review/collection-tablet.png)
- [Inspection tablet](review/studio-tablet.png)
- [Deal tablet](review/deal-tablet.png)
- [Workshop tablet](review/service-tablet.png)

Chrome rendered the packaged offline file, and screenshots were visually inspected. Thirty-four browser checks passed: sample car selection; owner role access; photo and result requirements; saved check revisiting; Hindi instructions; simulated help; forecast calculation; missing document and approval requirements; parts movement; QC state; horizontal fit at 360, 390 and 430 px; visible primary actions; tablet concept navigation; three-column workshop; and initial bay jobs fitting in their column. No browser runtime exceptions were observed. At the captured baseline sizes, all four main workspaces fit without whole-workspace scrolling. Longer tab content and growing job columns can scroll locally.

This is a browser prototype. Native iPhone, iPad, Android phone/tablet, large-text, screen-reader, camera, keyboard and production workflow acceptance remain part of implementation. The HTML preview does not certify those requirements.

## Editing

Edit `index.html`, `concepts.css`, and `concepts.js`, then run:

```sh
node --check concepts.js
python3 build.py
```

The standalone artifact is `preview.html`. Existing earlier concepts remain in the parent directory and are preserved.

`make-comparison.py` composes the saved browser screenshots into the two comparison sheets and requires Pillow. It does not capture or alter the app.
