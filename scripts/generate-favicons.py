#!/usr/bin/env python3
"""Generate LBox brand assets (pure Python PNG, fast)."""
import struct
import zlib
import os


def make_png(width, height, get_pixel):
    """Create a PNG file from a get_pixel(x, y) -> (r, g, b) function."""
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            r, g, b = get_pixel(x, y)
            raw += bytes([r, g, b])

    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw))
    png += chunk(b'IEND', b'')
    return png


FONT = {
    'L': [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
    'B': [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
    'o': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    'x': [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
}


def render_text(size, text="LBox"):
    """Render text as a 2D bitmap (1 = text, 0 = no text)."""
    bitmap = [[0]*size for _ in range(size)]
    if size < 16:
        return bitmap

    char_w, char_h = 5, 7
    scale = max(1, int(size * 0.55 / char_h / len(text)))
    scaled_w = char_w * scale
    scaled_h = char_h * scale
    spacing = scale
    total_w = len(text) * (scaled_w + spacing) - spacing

    start_x = (size - total_w) // 2
    start_y = (size - scaled_h) // 2

    for ci, ch in enumerate(text):
        if ch not in FONT:
            continue
        glyph = FONT[ch]
        cx = start_x + ci * (scaled_w + spacing)
        for gy in range(char_h):
            for gx in range(char_w):
                if glyph[gy][gx]:
                    for sy in range(scale):
                        for sx in range(scale):
                            px, py = cx + gx*scale + sx, start_y + gy*scale + sy
                            if 0 <= px < size and 0 <= py < size:
                                bitmap[py][px] = 1
    return bitmap


def make_favicon(size, text="LBox"):
    """Create LBox favicon: white circle with black text, transparent outside."""
    if size < 32:
        text = "LB"
    
    text_bitmap = render_text(size, text)

    def get_pixel(x, y):
        nx = (x / size) * 2 - 1
        ny = (y / size) * 2 - 1
        dist = (nx**2 + ny**2) ** 0.5

        if dist < 0.85:
            # Inside circle
            if text_bitmap[y][x]:
                return (0, 0, 0)  # Black text
            else:
                return (255, 255, 255)  # White circle fill
        else:
            return (255, 255, 255)  # White outside (for non-transparent)

    return make_png(size, size, get_pixel)


# Generate
os.makedirs('assets', exist_ok=True)

# Favicons (white circle, black text)
for size, name in [(16, 'favicon-16x16.png'), (32, 'favicon-32x32.png'), (48, 'favicon-48x48.png')]:
    data = make_favicon(size)
    with open(f'assets/{name}', 'wb') as f:
        f.write(data)
    print(f'Created assets/{name} ({size}x{size})')

# Apple touch icon
data = make_favicon(180, "LBox")
with open('assets/apple-touch-icon.png', 'wb') as f:
    f.write(data)
print('Created assets/apple-touch-icon.png (180x180)')

# App icon (1024x1024) - for electron-builder
data = make_favicon(1024, "LBox")
with open('assets/app-icon.png', 'wb') as f:
    f.write(data)
print('Created assets/app-icon.png (1024x1024)')

# OG image (1200x630)
def get_og_pixel(x, y):
    cx, cy = 600, 315
    radius = 200
    dist = ((x - cx)**2 + (y - cy)**2) ** 0.5

    if dist < radius:
        text_size = 180
        text_bitmap = render_text(text_size, "LBox")
        text_scale = radius / (text_size / 2)
        tx = int((x - cx) / text_scale + text_size / 2)
        ty = int((y - cy) / text_scale + text_size / 2)

        if 0 <= tx < text_size and 0 <= ty < text_size:
            if text_bitmap[ty][tx]:
                return (0, 0, 0)
        return (255, 255, 255)
    else:
        return (255, 255, 255)


og_data = make_png(1200, 630, get_og_pixel)
with open('assets/og-image.png', 'wb') as f:
    f.write(og_data)
print('Created assets/og-image.png (1200x630)')

print('Done!')
