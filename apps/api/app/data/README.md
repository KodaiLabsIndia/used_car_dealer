# Inspection library

`inspection-library-v1.json` contains 246 proposed, bilingual, individually
addressable check definitions. It is an **unapproved draft** authored for this
app, not Arihant's advertised 151-point SOP or a manufacturer procedure.
Instructions need qualified inspection and language review, illustrations and
vehicle-specific methods before production acceptance. Numeric pass/fail limits
are deliberately not invented.

Each definition carries a stable item ID, order, inspection zone, semantic part
ID, method, criticality, required photo/video/measurement and applicability.
Repeated positions such as each wheel and belt have independent evidence.
The initial comprehensive template is for pre-purchase inspections. Intake,
repair QC and delivery still have their own earlier draft templates.

The server resolves checks from the supplied observed vehicle configuration.
Known incompatible fuel/transmission/equipment is excluded. Unknown equipment
retains its checks and requires an explicit fitted confirmation or a reasoned,
photographed N/A for supervisor review. Cannot-inspect remains unfinished.
No automatic mechanical diagnosis or certification is implied by a 3D pointer.

Task creation snapshots the resolved checks and configuration. Catalogue updates
and later checklist revisions cannot rewrite existing work. The existing short
training tasks stay intact; select “Vehicle inspection · comprehensive draft”
to start a full draft inspection. Owner approval uses the existing attributed
checklist approval process.

Shared sedan/hatchback/SUV models use bundled, CC0 Quaternius meshes with
drag/pinch orbit controls and red component pointers. Nearby pointers group
into a part picker so none is hidden behind another touch target. They are
generic navigation schematics, not OEM geometry or a digital twin. Provenance
and reproducible conversion are in `data/inspection-models/`. Actual MPV/van/other body classification
remains in the configuration even when a generic SUV schematic is used. Both
map navigation and the complete searchable list open the same authoritative task
item, proof capture, result, issue and review record.
