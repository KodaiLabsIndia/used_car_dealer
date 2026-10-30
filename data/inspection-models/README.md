# Generic inspection model assets

The rejected procedural car has been replaced with modified meshes from
[Quaternius — LowPoly Cars](https://quaternius.itch.io/lowpoly-cars), the
“Realistic Car Pack - Nov 2018.zip” download. The creator's download page and
the included `source/License.txt` dedicate this exact pack under CC0 1.0.
`source.json` pins the original archive and input-file checksums.

`scripts/build-inspection-models.mjs` checks those hashes, parses the three OBJ
files, gives them a consistent front/left/up frame, centers the geometry,
normalizes schematic length and family heights, and replaces materials with a
common neutral palette. It writes texture-free Three Object JSON and derived
checksums. Original input files and licence are retained. The generated JSON is
excluded from formatting so regeneration stays byte-reproducible.

These are lightweight generic navigation assets, not manufacturer models,
actual vehicle dimensions, a mechanical digital twin, or verified component
geometry. Cabin and powertrain checks use schematic anchors. A dot opens the
real check list for that part and selected inspection section. The authoritative
answers, proof and review records remain independent of the model.

The section grid and grouped searchable list remain available. Rotation is
user-controlled; no idle spin runs. Front/rear/left/right/top/below buttons offer
an alternative to gestures. Measured viewport changes recreate the GL scene,
keeping geometry and touch projections aligned after rotation or split-view resize.
Red dots use projected 3D anchors and native touch
targets; rotating reveals points on the other side. Nearby projected points
form numbered red groups that open an explicit part picker. Preset buttons
reset the camera even after manually rotating from that same view. Physical device performance
and user comprehension still require acceptance.
