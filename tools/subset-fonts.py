# Cuts the Galmuri fonts down to the characters the game uses, so the first
# load is small. Run after adding new text: python tools/subset-fonts.py
# (needs: pip install fonttools brotli). tests/data.test.mjs fails when the
# game uses a character that is not in assets/fonts/chars.txt.
#
# The subset is a Modified Version under the SIL OFL 1.1, so it gets its own
# name (HourbellText11 / HourbellText9); the copyright and license stay.
import glob, os
from fontTools import subset
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(root, 'src', '*.js'))) + [os.path.join(root, 'index.html')])
chars = sorted(set(c for c in text if ord(c) > 0x7e) | set(chr(c) for c in range(0x20, 0x7f)))

for size in ('11', '9'):
    font = TTFont(os.path.join(root, 'tools', 'fonts', 'Galmuri' + size + '.woff2'), recalcTimestamp=False)  # same text, same file
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(text=''.join(chars))
    s.subset(font)
    family = 'HourbellText' + size
    for r in font['name'].names:
        if r.nameID in (1, 16): r.string = family
        elif r.nameID == 3: r.string = family + '-Regular;subset of Galmuri' + size
        elif r.nameID == 4: r.string = family + ' Regular'
        elif r.nameID == 6: r.string = family + '-Regular'
    font.save(os.path.join(root, 'assets', 'fonts', family + '.woff2'))

with open(os.path.join(root, 'assets', 'fonts', 'chars.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(''.join(chars) + '\n')
# Galmuri has no glyph for these; the browser draws them in a fallback font
missing = [c for c in chars if ord(c) not in TTFont(os.path.join(root, 'assets', 'fonts', 'HourbellText11.woff2')).getBestCmap()]
print(len(chars), 'characters,', len(missing), 'not in Galmuri:', ascii(''.join(missing)))
