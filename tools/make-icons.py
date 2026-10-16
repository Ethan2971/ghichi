# GC-PWA — Vẽ biểu tượng app: khối cầu đỏ 3D có dấu + trắng ở giữa.
# Chạy lại khi muốn đổi biểu tượng: python3 tools/make-icons.py (cần Pillow).
import math
from PIL import Image, ImageDraw, ImageFilter

S = 1024
TOP, MID, BOT = (255, 138, 138), (239, 68, 68), (165, 18, 32)  # đỏ trùng màu nút + trong app


# kind: 'any' (nền trong suốt), 'mask' (Android cắt tròn: quả cầu lấp kín vòng tròn, nền đỏ sẫm trùng mép cầu),
# 'apple' (iPhone cắt vuông bo góc: nền hồng nhạt).
def sphere(kind='any'):
    bg = {'any': (0, 0, 0, 0), 'mask': (124, 14, 24, 255), 'apple': (255, 241, 242, 255)}[kind]
    im = Image.new('RGBA', (S, S), bg)
    R = S * {'any': 0.41, 'mask': 0.41, 'apple': 0.36}[kind]
    cx = cy = S / 2
    if kind != 'mask':
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([cx - R * 0.9, cy - R * 0.7, cx + R * 0.9, cy + R * 1.12], fill=(120, 10, 20, 110))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(R * 0.09)))
    ball = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = ball.load()
    lx, ly = cx - R * 0.38, cy - R * 0.42
    for y in range(int(cy - R) - 1, int(cy + R) + 2):
        for x in range(int(cx - R) - 1, int(cx + R) + 2):
            dist = math.hypot(x - cx, y - cy)
            if dist > R + 1:
                continue
            t = min(1, math.hypot(x - lx, y - ly) / (R * 1.75))
            a_, b_, k = (TOP, MID, t / 0.45) if t < 0.45 else (MID, BOT, (t - 0.45) / 0.55)
            c = [a_[i] + (b_[i] - a_[i]) * k for i in range(3)]
            edge = max(0, dist / R - 0.86) / 0.14
            c = [int(v * (1 - 0.25 * edge)) for v in c]
            px[x, y] = (*c, 255 if dist <= R else int(255 * (R + 1 - dist)))
    im = Image.alpha_composite(im, ball)
    hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([cx - R * 0.62, cy - R * 0.86, cx + R * 0.30, cy - R * 0.28], fill=(255, 255, 255, 120))
    im = Image.alpha_composite(im, hl.filter(ImageFilter.GaussianBlur(R * 0.09)))
    w, L = R * 0.21, R * 0.56

    def plus(img, dy, col):
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([cx - L, cy - w / 2 + dy, cx + L, cy + w / 2 + dy], radius=w / 2, fill=col)
        d.rounded_rectangle([cx - w / 2, cy - L + dy, cx + w / 2, cy + L + dy], radius=w / 2, fill=col)
        return img
    psh = plus(Image.new('RGBA', (S, S), (0, 0, 0, 0)), R * 0.05, (110, 0, 10, 120))
    im = Image.alpha_composite(im, psh.filter(ImageFilter.GaussianBlur(R * 0.04)))
    return Image.alpha_composite(im, plus(Image.new('RGBA', (S, S), (0, 0, 0, 0)), 0, (255, 255, 255, 255)))


big, mask, apple = sphere(), sphere('mask'), sphere('apple')
for s in (192, 512):
    big.resize((s, s), Image.LANCZOS).save(f'icons/icon-{s}.png')
big.resize((48, 48), Image.LANCZOS).save('icons/favicon-48.png')
mask.resize((512, 512), Image.LANCZOS).save('icons/maskable-512.png')
apple.resize((180, 180), Image.LANCZOS).convert('RGB').save('icons/apple-touch-icon.png')
# Biểu tượng nhỏ trên thanh trạng thái Android: chỉ hình trắng trên nền trong suốt.
b = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
d = ImageDraw.Draw(b)
d.ellipse([6, 6, 90, 90], outline=(255, 255, 255, 255), width=8)
d.rounded_rectangle([28, 43, 68, 53], radius=5, fill=(255, 255, 255, 255))
d.rounded_rectangle([43, 28, 53, 68], radius=5, fill=(255, 255, 255, 255))
b.save('icons/badge-96.png')
