# Usage: make-walkaround.py poster.jpg outdir points-json  (used by tests/walkaround.test.cjs)
# Synthetic "walk-around": render the printed poster from known camera positions, and record where
# points floating above the paper must appear (ground truth for the AR nodes).
import sys, json, math
import numpy as np
from PIL import Image
src = Image.open(sys.argv[1]).convert('RGB'); out = sys.argv[2]
SW, SH = src.size; PW, PH = 1682, 2378; IW, IH = 1080, 1920
L = np.array([845., 1320., 0.])  # look at the printed workflow (world: x right, y down, z into the wall)
def cam(az, el, d, roll=0, fr=.78):
    a, e = math.radians(az), math.radians(el)
    C = L + d * np.array([math.sin(a) * math.cos(e), -math.sin(e), -math.cos(a) * math.cos(e)])
    z = (L - C) / np.linalg.norm(L - C); x = np.cross(z, [0, -1, 0]); x /= np.linalg.norm(x); y = np.cross(z, x)
    Rm = np.array([x, y, z]); r = math.radians(roll); Rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]]); Rm = Rz @ Rm
    f = fr * IH; K = np.array([[f, 0, IW / 2], [0, f, IH / 2], [0, 0, 1]]); t = -Rm @ C
    return K, Rm, t
views = [('front', 0, 0, 3800, 0, .78), ('left35', -35, 0, 3600, 0, .78), ('right35_up', 35, 12, 3500, 0, .78), ('above', -15, 28, 3200, 0, .78),
         ('below_right', 25, -15, 3400, 0, .78), ('closeup', 10, 6, 2000, 0, .78), ('tilted_phone', -20, 8, 3300, 18, .78), ('wide_lens_left', -30, 10, 3000, 0, .62)]
pts = json.loads(sys.argv[3])
meta = []
for name, az, el, d, roll, fr in views:
    K, Rm, t = cam(az, el, d, roll, fr)
    Hw = K @ np.column_stack([Rm[:, 0], Rm[:, 1], t])            # poster units -> image px
    Hs = Hw @ np.diag([PW / SW, PH / SH, 1.])                     # source px -> image px
    inv = np.linalg.inv(Hs); inv /= inv[2, 2]
    img = src.transform((IW, IH), Image.PERSPECTIVE, tuple(inv.flatten()[:8]), Image.BICUBIC, fillcolor=(62, 58, 54))
    img.save(f'{out}/orbit-{name}.jpg', quality=92)
    gt = []
    for x, y, h in pts:
        q = K @ (Rm @ np.array([x, y, -h]) + t); gt.append([q[0] / q[2], q[1] / q[2]])
    meta.append({'name': name, 'gt': gt, 'focalRatio': fr})
json.dump({'pts': pts, 'views': meta}, open(f'{out}/orbit.json', 'w'))
print('rendered', len(views), 'views')
