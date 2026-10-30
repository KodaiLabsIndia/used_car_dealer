"""Create a standalone, offline concept board from the editable sources."""
from pathlib import Path
import base64

root = Path(__file__).resolve().parent
assets = root.parent / "assets"

def data_url(name, mime):
    return f"data:{mime};base64," + base64.b64encode((assets / name).read_bytes()).decode()

html = (root / "index.html").read_text()
css = (root / "concepts.css").read_text()
js = (root / "concepts.js").read_text()
for name, mime in [("arihant-logo.png", "image/png"), ("seltos.jpg", "image/jpeg"), ("sonet.jpg", "image/jpeg"), ("plus-jakarta-sans.ttf", "font/ttf")]:
    uri = data_url(name, mime)
    html = html.replace(f"../assets/{name}", uri)
    css = css.replace(f"../assets/{name}", uri)
    js = js.replace(f"../assets/{name}", uri)
html = html.replace('<link rel="stylesheet" href="concepts.css">', f"<style>{css}</style>")
html = html.replace('<script src="concepts.js" defer></script>', "")
html = html.replace("</body>", "<script>" + js.replace("</script", "<\\/script") + "</script></body>")
(root / "preview.html").write_text(html)
print(f"Built preview.html · {len(html):,} characters · logo, photos, font and interactions embedded")
