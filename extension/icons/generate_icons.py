import zlib
import struct
import os

def make_png(width, height, get_pixel):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel(x, y, width, height)
            raw_data.extend([r, g, b, a])
            
    def chunk(tag, data):
        c = tag + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
        
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    png.extend(chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)))
    # IDAT
    compressed = zlib.compress(bytes(raw_data), 9)
    png.extend(chunk(b'IDAT', compressed))
    # IEND
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

def shield_pixel(x, y, w, h):
    # Normalized coords -1 to 1
    nx = (x + 0.5 - w / 2) / (w / 2)
    ny = (y + 0.5 - h / 2) / (h / 2)
    
    # Shield shape:
    # top half is rectangle with rounded corners, bottom curves to a point
    in_shield = False
    if ny >= -0.85 and ny <= 0.1:
        if abs(nx) <= 0.8:
            in_shield = True
    elif ny > 0.1 and ny <= 0.9:
        # curve down: width decreases with parabolic or linear taper
        max_x = 0.8 * (1.0 - ((ny - 0.1) / 0.8) ** 1.3)
        if abs(nx) <= max_x:
            in_shield = True
            
    if not in_shield:
        return (0, 0, 0, 0)
        
    # Blue / Indigo gradient: #1a73e8 to #1557b0
    t = (ny + 1) / 2
    r = int(26 * (1 - t) + 18 * t)
    g = int(115 * (1 - t) + 84 * t)
    b = int(232 * (1 - t) + 180 * t)
    
    # Draw checkmark inside shield
    # Checkmark segments: (-0.35, 0.05) to (-0.05, 0.35) to (0.4, -0.3)
    # Check distance to these two lines
    def dist_to_segment(px, py, x1, y1, x2, y2):
        dx = x2 - x1
        dy = y2 - y1
        l2 = dx*dx + dy*dy
        if l2 == 0:
            return ((px - x1)**2 + (py - y1)**2)**0.5
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / l2))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return ((px - proj_x)**2 + (py - proj_y)**2)**0.5

    d1 = dist_to_segment(nx, ny, -0.38, 0.05, -0.05, 0.38)
    d2 = dist_to_segment(nx, ny, -0.05, 0.38, 0.42, -0.28)
    d = min(d1, d2)
    
    stroke = 0.14
    if d <= stroke:
        # Checkmark in white
        return (255, 255, 255, 255)
    elif d <= stroke + 0.05:
        # Smooth antialias
        alpha = (stroke + 0.05 - d) / 0.05
        cr = int(255 * alpha + r * (1 - alpha))
        cg = int(255 * alpha + g * (1 - alpha))
        cb = int(255 * alpha + b * (1 - alpha))
        return (cr, cg, cb, 255)

    return (r, g, b, 255)

os.makedirs('extension/icons', exist_ok=True)
for size in [16, 32, 48, 128]:
    png_bytes = make_png(size, size, shield_pixel)
    with open(f'extension/icons/icon-{size}.png', 'wb') as f:
        f.write(png_bytes)
    print(f'Wrote icon-{size}.png ({len(png_bytes)} bytes)')
