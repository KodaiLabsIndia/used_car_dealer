"""Compose browser captures into review sheets. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
review = root / "review"
font_path = root.parent / "assets" / "plus-jakarta-sans.ttf"

def font(size):
    return ImageFont.truetype(str(font_path), size)

def header(canvas, title, subtitle):
    draw = ImageDraw.Draw(canvas)
    logo = Image.open(root.parent / "assets" / "arihant-logo.png").convert("RGBA")
    logo.thumbnail((98, 63), Image.Resampling.LANCZOS)
    canvas.paste(logo, (55, 43), logo)
    draw.text((190, 36), title, font=font(39), fill="#f1efeb")
    draw.text((192, 94), subtitle, font=font(14), fill="#a5a09a")
    draw.line((55, 137, canvas.width - 55, 137), fill="#33302c", width=1)

items = [
    ("collection", "01", "The Collection", "Owner overview · select a car, see its next step"),
    ("studio", "02", "Inspection Studio", "Employee inspection · point, capture, decide"),
    ("deal", "03", "Deal Desk", "Purchase · focused panels, a visible forecast"),
    ("service", "04", "Service Wall", "Workshop · jobs, missing parts, quality checks"),
]
canvas = Image.new("RGB", (1840, 1130), "#070707")
header(canvas, "Four ways to work.", "ARIHANT OPERATIONS  /  PHONE CONCEPTS  /  INTERACTIVE PREVIEW AVAILABLE")
draw = ImageDraw.Draw(canvas)
for i, (key, number, name, caption) in enumerate(items):
    x = 50 + i * 450
    draw.text((x + 5, 165), number, font=font(15), fill="#e06166")
    draw.text((x + 38, 159), name, font=font(24), fill="#e9e5df")
    capture = Image.open(review / f"{key}-phone.png").convert("RGB")
    # Cropping removes the empty browser canvas only; the complete device is retained.
    capture = capture.crop((44, 19, 436, 803))
    canvas.paste(capture, (x, 214))
    draw.text((x + 4, 1024), caption, font=font(13), fill="#aca59c")
draw.line((55, 1073, 1785, 1073), fill="#33302c")
draw.text((55, 1090), "ORIGINAL ARIHANT IDENTITY  ·  SAMPLE DATA  ·  CONCEPT REVIEW", font=font(11), fill="#807970")
draw.text((1260, 1090), "Working app implementation awaits review.", font=font(11), fill="#807970")
canvas.save(review / "four-workspaces.png", optimize=True)

canvas = Image.new("RGB", (1920, 1590), "#070707")
header(canvas, "More room. A different arrangement.", "ARIHANT OPERATIONS  /  TABLET CONCEPTS  /  LANDSCAPE WORKSPACES")
draw = ImageDraw.Draw(canvas)
for i, (key, number, name, caption) in enumerate(items):
    x = 35 + (i % 2) * 950
    y = 163 + (i // 2) * 690
    draw.text((x + 14, y), number, font=font(14), fill="#e06166")
    draw.text((x + 48, y - 5), name, font=font(22), fill="#e9e5df")
    capture = Image.open(review / f"{key}-tablet.png").convert("RGB")
    capture = capture.crop((37, 19, 1063, 712))
    capture.thumbnail((920, 623), Image.Resampling.LANCZOS)
    canvas.paste(capture, (x, y + 42))
draw.line((55, 1540, 1865, 1540), fill="#33302c")
draw.text((55, 1558), "ORIGINAL ARIHANT IDENTITY  ·  SAMPLE DATA  ·  CONCEPT REVIEW", font=font(11), fill="#807970")
canvas.save(review / "four-tablets.png", optimize=True)
print("Created four-workspaces.png and four-tablets.png")
