"""Builds the Windows icon resources from the approved artwork in branding/.

app-icon-source.webp     -> src-tauri/icons/icon.ico + PNG set (the application: exe, taskbar, Start menu, installer, shortcuts)
project-icon-source.webp -> src-tauri/icons/project-file.ico (documents: .pone and .pguy files)

Both sources are cut to a clean rounded square with a transparent outside, so no halo or dark box shows on a light taskbar.
Run: python scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src-tauri' / 'icons'
SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

# Rounded-square bounds of the gold rim measured on each source image (left, top, right, bottom, corner radius).
SPECS = {
    'app-icon-source.webp': dict(box=(108, 103, 1132, 1124), radius=250),
    'project-icon-source.webp': dict(box=(90, 78, 1164, 1164), radius=230),
}


def cut(name):
    spec = SPECS[name]
    src = Image.open(ROOT / 'branding' / name).convert('RGBA')
    l, t, r, b = spec['box']
    scale = 4
    mask = Image.new('L', (src.width * scale, src.height * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle([l * scale, t * scale, r * scale, b * scale], radius=spec['radius'] * scale, fill=255)
    mask = mask.resize(src.size, Image.LANCZOS)
    body = Image.new('RGBA', src.size, (0, 0, 0, 0))
    solid = src.copy(); solid.putalpha(255)
    body.paste(solid, (0, 0), mask)
    body = body.crop((l, t, r, b))
    side = max(body.size)
    pad = int(side * 0.02)
    sq = Image.new('RGBA', (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
    sq.paste(body, ((sq.width - body.width) // 2, (sq.height - body.height) // 2))
    return sq


def ico(img, path):
    base = img.resize((256, 256), Image.LANCZOS)
    base.save(path, format='ICO', sizes=[(s, s) for s in SIZES], bitmap_format='png')


app = cut('app-icon-source.webp')
proj = cut('project-icon-source.webp')
ico(app, OUT / 'icon.ico')
ico(proj, OUT / 'project-file.ico')
for name, px in {'32x32.png': 32, '64x64.png': 64, '128x128.png': 128, '128x128@2x.png': 256, 'icon.png': 512, 'StoreLogo.png': 50}.items():
    app.resize((px, px), Image.LANCZOS).save(OUT / name)
for px in (30, 44, 71, 89, 107, 142, 150, 284, 310):
    app.resize((px, px), Image.LANCZOS).save(OUT / f'Square{px}x{px}Logo.png')
proj.resize((512, 512), Image.LANCZOS).save(OUT / 'project-file.png')
# Contact sheet to check small sizes by eye (not shipped).
sheet = Image.new('RGBA', (9 * 80, 2 * 80 + 20), (236, 236, 236, 255))
for row, im in enumerate((app, proj)):
    x = 8
    for s in (16, 24, 32, 48, 64):
        sheet.alpha_composite(im.resize((s, s), Image.LANCZOS), (x, 8 + row * 84)); x += s + 14
sheet.save(ROOT / 'branding' / 'contact-sheet-light.png')
print('ok')
