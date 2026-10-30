# Arihant motion study

Historical standalone prototype for UX-23. **Superseded by the owner's correction on 30 October 2026:** see [the data/spatial inspection plan](../../docs/SPATIAL_INSPECTION_PLAN.md). Production mobile and web screens were not changed by this prototype; these concepts are not the current approval request.

Open `preview.html` directly for the self-contained offline version, or serve **this directory only** and open `index.html`. The current review server is http://127.0.0.1:5180. Never serve the repository root: it contains private development configuration.

Try each numbered concept:

1. **Stay with the car:** open either car and go back. Its photograph connects the card and workspace. Escape also goes back; focus returns to the selected car.
2. **At your fingertips:** switch Inspection, Repairs and Handover. Add the sample photo and switch away/back. Evidence persists within this demo until Reset; attaching it does not pass the inspection.
3. **A moment to remember:** preview a confirmed delivery and replay the brief light signature. The record is usable immediately. No actual delivery is created.

Compare Phone/Tablet and Less motion. The operating system's reduced-motion setting always takes precedence. Arrow keys, Home and End navigate the two tab groups. All essential demo actions have visible buttons; no gesture is required. Motion has no sound, autoplay loop, external asset fetch or dependency on a business account. The device is a scaled visual study, not a native accessibility acceptance build.

All data and evidence are samples. There are no API calls, real camera access, uploads, microphone access, actual approvals or data writes. The original website logo, red/black identity, existing sample car photos and locally licensed Plus Jakarta Sans are reused. This preview is English only; production language and large-text verification remain part of implementation acceptance.

Sources and proposed native architecture: [../../docs/MOTION_PROPOSALS.md](../../docs/MOTION_PROPOSALS.md).

Edit `index.html`, `style.css`, `motion.js`; run `python3 build-preview.py` to regenerate the offline file. Browser verification evidence lives under `docs/review/motion/` at the repository root. Native iOS/Android performance, screen-reader behavior, haptics and device acceptance are **not** established by this HTML prototype.
