# How a screenshot looks with red-green colour blindness (deuteranopia and
# protanopia, Machado 2009 at full strength). Writes <name>-deutan.png and
# <name>-protan.png next to it. Run: python tools/colorblind.py shot.png
# (needs Pillow)
import sys
from PIL import Image

MATRIX = {
    'deutan': ((0.367, 0.861, -0.228), (0.280, 0.673, 0.047), (-0.012, 0.043, 0.969)),
    'protan': ((0.152, 1.053, -0.205), (0.115, 0.786, 0.099), (-0.004, -0.048, 1.052)),
}
for path in sys.argv[1:]:
    img = Image.open(path).convert('RGB')
    for name, m in MATRIX.items():
        out = img.convert('RGB', (m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0))
        out.save(path.rsplit('.', 1)[0] + '-' + name + '.png', optimize=True)
        print('wrote', path.rsplit('.', 1)[0] + '-' + name + '.png')
