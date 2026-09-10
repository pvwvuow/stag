#!/usr/bin/env python3
"""Generate the GameDNS Tester app icon (cyan gamepad on dark rounded square)."""
from PIL import Image, ImageDraw, ImageFilter
import math

S = 1024

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Dark rounded-square background with cyan glow ring
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(bg)
bd.rounded_rectangle([32, 32, S - 32, S - 32], radius=220, fill=(6, 12, 18, 255))
for i, w in enumerate(range(26, 2, -3)):
    alpha = int(28 + i * 4)
    bd.rounded_rectangle([32, 32, S - 32, S - 32], radius=220, outline=(34, 211, 238, alpha), width=w)
img = Image.alpha_composite(img, bg)
d = ImageDraw.Draw(img)

CYAN_BRIGHT = (34, 211, 238, 255)
CYAN_MID = (8, 145, 178, 255)

# soft glow under the pad
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.ellipse([212, 620, 812, 760], fill=(34, 211, 238, 45))
shadow = shadow.filter(ImageFilter.GaussianBlur(24))
img = Image.alpha_composite(img, shadow)
d = ImageDraw.Draw(img)

# ---- gamepad body ----
grip_fill = (16, 36, 46, 255)
d.ellipse([172, 320, 512, 700], fill=grip_fill)
d.ellipse([512, 320, 852, 700], fill=grip_fill)
d.rounded_rectangle([240, 360, 784, 560], radius=100, fill=grip_fill)
d.rounded_rectangle([300, 390, 724, 460], radius=36, fill=(22, 52, 64, 255))

d.arc([172, 320, 512, 700], start=180, end=300, fill=CYAN_BRIGHT, width=14)
d.arc([512, 320, 852, 700], start=240, end=360, fill=CYAN_BRIGHT, width=14)

# D-pad (left)
cx, cy, r = 330, 505, 26
d.rounded_rectangle([cx - r - 8, cy - r * 3 + 20, cx + r + 8, cy + r * 3 - 20], radius=20, fill=CYAN_MID)
d.rounded_rectangle([cx - r * 3 + 20, cy - r - 8, cx + r * 3 - 20, cy + r + 8], radius=20, fill=CYAN_MID)

# ABXY buttons (right)
bx, by = 700, 505
gap = 62
btn = [(bx, by - gap), (bx - gap, by), (bx + gap, by), (bx, by + gap)]
for i, (x, y) in enumerate(btn):
    col = CYAN_BRIGHT if i in (0, 3) else (103, 232, 249, 255)
    d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=col)

# center emblem: dark rounded chip + star
d.rounded_rectangle([440, 470, 584, 545], radius=26, fill=(6, 12, 18, 255), outline=CYAN_BRIGHT, width=6)

def star_points(cx, cy, ro, ri, n=5):
    pts = []
    for i in range(2 * n):
        ang = math.pi * i / n - math.pi / 2
        rr = ro if i % 2 == 0 else ri
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts

d.polygon(star_points(512, 507, 26, 11), fill=CYAN_BRIGHT)

# menu dashes
d.rounded_rectangle([462, 585, 512, 600], radius=8, fill=CYAN_MID)
d.rounded_rectangle([522, 585, 572, 600], radius=8, fill=CYAN_MID)

img.save("/home/z/my-project/gamedns-electron/build/icon.png")
ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
img.save("/home/z/my-project/gamedns-electron/build/icon.ico", sizes=ico_sizes)
img.resize((256, 256), Image.LANCZOS).save("/home/z/my-project/gamedns-electron/build/icon-256.png")
print("icon generated")
