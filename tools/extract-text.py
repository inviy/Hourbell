# Every Korean line the game says, with file:line, for proofreading in one place.
# Run: python tools/extract-text.py > text.txt
import glob, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')  # Korean on any console

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KOREAN = re.compile(r"'([^'\n]*[가-힣][^'\n]*)'")
for p in sorted(glob.glob(os.path.join(root, 'src', '*.js'))):
    for n, line in enumerate(open(p, encoding='utf-8'), 1):
        if line.strip().startswith('//'):
            continue
        for s in KOREAN.findall(line):
            print('%s:%d\t%s' % (os.path.basename(p), n, s))
