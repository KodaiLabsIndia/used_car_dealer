# Company configuration implementation — 30 October 2026

This is an internal development build, not full-release acceptance.

Implemented from the [confirmed company decisions](../../COMPANY_DECISIONS.md):

- Owner/Supervisor and Employee are the working levels. New staff inputs accept
  Employee or Supervisor only. Historical manager records retain supervisor
  authority without rewriting old actors. Company policy, inspection publication
  and account administration remain owner-only.
- A supervisor can see operational financial records and the combined decision
  queue and make the one required financial decision. Competing quote approvals
  commit only one result, with the actual approver recorded.
- Assigned employees can request itemized repair quotes, prepare purchase proposals
  and upload document pages. Money approval/payment/correction actions remain
  protected. Non-financial repair progress can continue with a quote pending;
  a declared spending commitment requires the current approved quote. Invoices
  and vendor payments retain their approval/budget guards. Inspection submission,
  independent staff review and QC safeguards are retained.
- Owner inspection editing includes order, sections, 3D part mapping, methods,
  criticality, required clips, measurement units, fuel/transmission/equipment
  applicability and English/Hindi/Marathi wording fields. One wording language
  and one rule group are shown at a time. Published revisions do not rewrite
  assigned inspections.
- Owner document rules have versioned, immutable publication, editable starter
  rules for purchase/intake/sale/delivery and stable assigned snapshots. Rules
  include wording in all three languages, order, required/optional flags and
  applicability instructions. Applicability notes do not automatically waive a
  required document; conditional documents must be configured appropriately.
- Document requirement state comes from the actual linked page and its review:
  missing, pending, rejected or accepted. Links and versions are append-only;
  final stage bindings are locked. Replays recheck assigned-work visibility;
  catalogue-only access cannot expose private documents or purchase records. Sale-specific
  requirements retain their booking identity. Existing transactions retain their
  assigned rules across publication changes.
- **Starter version 0 is unpublished.** The owner must review and publish company
  rules to activate documentary completion gates for new transactions. Existing
  assigned starters are not silently replaced or retroactively enforced.
  Published required pages gate acquisition, intake receipt and delivery; stock
  readiness includes applicable purchase/intake document clearance.
- A booked car has configurable 3/6/12-month warranty duration, named covered
  components, exclusions, written notes, provider/reference and optional odometer
  limit. Delivery calculates expiry in calendar months from its actual database
  timestamp and stores an immutable sale snapshot. Later configuration cannot
  rewrite issued terms. No-warranty handover requires explicit acknowledgement.
- English, Hindi and Marathi are selectable, with preferences saved per user.
  Core copy, date formatting, new company-document UI and Marathi inspection
  fields/assistant request language are connected. **Full Marathi translation is
  unfinished:** the 246-definition library and existing bilingual screens,
  validation and spoken guidance still need translation/voice/staff review.
  Older inspections use their assigned content and can fall back to English.

Verification:

- Full PostgreSQL suite: **77 passed**, including catalogue-only versus assigned
  work access, concurrent approval, immutable rule snapshots, reviewed-document
  gates and warranty issuance.
- `npm run check`: lint/types and **14 Python + 13 mobile tests** passed.
- Shared OpenAPI/client contracts regenerated; migration **0021** applied locally.
- Android and iOS JavaScript exports, web build and format checks passed.
- Updated Android preview installed on Pixel_9a, retaining session and saved work.
  Screen evidence and bundled-source fingerprints are recorded in this directory.
- iOS native compilation and physical-device/staff acceptance remain open. The
  emulator is not evidence of complete tablet, camera, voice or accessibility
  acceptance. Media resolution/normalization policies are unchanged.

Layout review evidence:

- [Owner Company controls](phone-settings-company.png).
- [Inspection mapping rules](phone-inspection-rule-mapping.png),
  [required proof rules](phone-inspection-proof-rules.png), and
  [applicability rules](phone-inspection-applicability.png).
- [Document editor at 320 dp / 200% system text](phone320-font200-editor-final.png)
  and [landscape tablet window](tablet-landscape-editor-final.png).
- [Marathi Account screen](phone-marathi-account-final.png).

The compact section chooser omits a redundant caption to leave room for labels.
Hindi/Marathi use native script fonts. A trailing Android text space works around
the upstream [last-word rendering issue](https://github.com/facebook/react-native/issues/57110);
this is contained in the shared Text component. Font scale, display size/density
and account language are restored after review. Native tablet/iOS and employee
acceptance remain open.

[Layout review metadata](layout-review.json) records the restored display profile.
The global emulator error log retains an earlier UIAutomator registration conflict
from overlapping inspection tools; it contains no Arihant application fatal trace.
The app-process runtime error log is recorded separately.
