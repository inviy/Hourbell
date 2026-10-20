# Lists the save flags the game sets (w.flags) and where, into docs/FLAGS.md.
# Run after adding flags: python tools/list-flags.py
import glob, os, re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ways a flag gets set in src/: an assignment, or data the framework sets for you
SET = [
    (r"flags\.(\w+)\s*=(?!=)", '코드'), (r"flags\['(\w+)'\]\s*=(?!=)", '코드'),
    (r"setFlag: '(\w+)'", 'NPC와 대화'), (r"onEnter: '(\w+)'", '지도에 들어섬'),
    (r"\bflag: '(boss\d)'", '보스 승리'), (r"\bflag: '(secret\d|grovePuzzle)'", '풍경 퍼즐'),
    (r"\bflag: '(talk\w+)'", '여관 대화'),
]
# in these files `f` is the flags object (elsewhere it is a foe)
FLAG_F = ('quests.js', 'chapter.js', 'field.js', 'props.js')
# set by pattern rather than by name
FAMILIES = [
    ('fragmentN, chapterN', 'N = 1..7. 제단에서 조각을 얻음 / 종지기에게 전해 장을 마침 (src/chapter.js, src/field.js)'),
    ('chest_<id>, pick_<id>', '상자를 엶 / 줍는 물건을 주움 (src/props.js)'),
    ('map:<region>', '그 지역에 가 봄, 지도 화면용 (src/chapter.js)'),
    ('tried_<보스 종류>', '그 보스와 한 번 싸움: 다시 도전하면 소개가 한 줄 (src/chapter.js, src/field.js)'),
    ('restAt', '마지막으로 쉰 여관 { map, x, y, dir } (src/chapter.js). 같은 장에서 지면 여기서 깨어남'),
]

found = {}
for p in sorted(glob.glob(os.path.join(root, 'src', '*.js'))):
    name = os.path.basename(p)
    s = open(p, encoding='utf-8').read()
    pats = SET + ([(r"\bf\.(\w+)\s*=(?!=)", '코드')] if name in FLAG_F else [])
    for pat, how in pats:
        for flag in re.findall(pat, s):
            found.setdefault(flag, set()).add((how, name))

lines = [
    '# 세이브 플래그 목록', '',
    '`w.flags`에 저장되는 이름들입니다. 세이브에 그대로 남으므로, 지우거나 이름을 바꾸면 기존 세이브와 어긋납니다.',
    '새 플래그를 넣으면 `python tools/list-flags.py`로 이 문서를 다시 만듭니다. 진행에 꼭 필요한 순서는 [SOFTLOCK.md](SOFTLOCK.md)에 있습니다.', '',
    '## 이름 규칙', '',
    '- 동사보다 상태: `metKeeper`(만났다), `mioJoined`(합류했다), `portArrived`(도착했다)',
    '- 장마다 같은 꼴: `bossN`, `fragmentN`, `chapterN`, `secretN`',
    '- 한 번만 보는 장면은 그 장면 이름: `saidBye`, `talkMioDan`', '',
    '## 패턴으로 정해지는 이름', '', '| 패턴 | 뜻 |', '|---|---|',
] + ['| `%s` | %s |' % f for f in FAMILIES] + ['', '## 개별 플래그', '', '| 플래그 | 켜지는 때 (파일) |', '|---|---|']
for flag in sorted(found, key=str.lower):
    if flag == 'restAt' or re.match(r'^((fragment|chapter)\d*|tried_.*)$', flag):
        continue
    lines.append('| `%s` | %s |' % (flag, ', '.join(sorted('%s (%s)' % hf for hf in found[flag]))))
open(os.path.join(root, 'docs', 'FLAGS.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print(len(found), 'flags')
