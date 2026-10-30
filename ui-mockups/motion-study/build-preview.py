"""Package the isolated motion study for offline review. No application build involved."""

import base64
import mimetypes
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def embed_asset(path: str) -> str:
    source = ROOT / path
    mime = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(source.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


html = (ROOT / "index.html").read_text()
css = (ROOT / "style.css").read_text()
js = (ROOT / "motion.js").read_text()
for asset in (ROOT / "assets").iterdir():
    if asset.suffix.lower() not in {".jpg", ".png", ".ttf"}:
        continue
    path = f"assets/{asset.name}"
    uri = embed_asset(path)
    html = html.replace(path, uri)
    css = css.replace(path, uri)
    js = js.replace(path, uri)
html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>{css}</style>")
html = html.replace('<script src="motion.js"></script>', f"<script>{js}</script>")
(ROOT / "preview.html").write_text(html)
print("Created offline motion preview")
