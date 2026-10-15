# Android launcher icons: the brand green fills the whole icon shape (the
# launcher masks it to a circle or squircle) with the ink ₪ on top, so there
# is no light ring around it. Also the themed (monochrome) layer.
# Usage: python3 scripts/make_icons.py   (from the repo root)
import os
from PIL import Image, ImageDraw, ImageFont

res = 'android/app/src/main/res'
GREEN = (34, 164, 93, 255)   # --accent
INK = (20, 20, 20, 255)      # --ink
S = 1024

# The ₪ glyph in Rubik ExtraBold, like the app's CoinLogo.
font = ImageFont.truetype(os.path.join(res, 'font/rubik_extrabold.ttf'), 900)
mask = Image.new('L', (S * 2, S * 2), 0)
ImageDraw.Draw(mask).text((S // 2, S // 2), '₪', font=font, fill=255)
glyph = mask.crop(mask.getbbox())


def glyph_layer(size, height_frac, color=INK):
    """Transparent canvas with the glyph centred, its height a fraction of size."""
    big = size * 4
    im = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    gh = big * height_frac
    gw = gh * glyph.width / glyph.height
    g = glyph.resize((int(gw), int(gh)), Image.LANCZOS)
    im.paste(Image.new('RGBA', g.size, color), (int((big - gw) / 2), int((big - gh) / 2)), g)
    return im.resize((size, size), Image.LANCZOS)


# Adaptive icon (Android 8+): 108dp canvas, the glyph inside the 66dp safe zone.
for dens, n in {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}.items():
    glyph_layer(n, 0.25).save(os.path.join(res, f'mipmap-{dens}', 'ic_launcher_foreground.png'))
    glyph_layer(n, 0.25, (255, 255, 255, 255)).save(os.path.join(res, f'mipmap-{dens}', 'ic_launcher_monochrome.png'))

# Legacy icons (Android 7): green all the way to the edge.
for dens, n in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    big = n * 4
    sq = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(sq).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.22, fill=GREEN)
    sq.alpha_composite(glyph_layer(big, 0.34))
    sq.resize((n, n), Image.LANCZOS).save(os.path.join(res, f'mipmap-{dens}', 'ic_launcher.png'))
    rnd = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(rnd).ellipse((0, 0, big - 1, big - 1), fill=GREEN)
    rnd.alpha_composite(glyph_layer(big, 0.34))
    rnd.resize((n, n), Image.LANCZOS).save(os.path.join(res, f'mipmap-{dens}', 'ic_launcher_round.png'))
print('icons written')
