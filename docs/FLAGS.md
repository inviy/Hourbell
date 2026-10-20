# 세이브 플래그 목록

`w.flags`에 저장되는 이름들입니다. 세이브에 그대로 남으므로, 지우거나 이름을 바꾸면 기존 세이브와 어긋납니다.
새 플래그를 넣으면 `python tools/list-flags.py`로 이 문서를 다시 만듭니다. 진행에 꼭 필요한 순서는 [SOFTLOCK.md](SOFTLOCK.md)에 있습니다.

## 이름 규칙

- 동사보다 상태: `metKeeper`(만났다), `mioJoined`(합류했다), `portArrived`(도착했다)
- 장마다 같은 꼴: `bossN`, `fragmentN`, `chapterN`, `secretN`
- 한 번만 보는 장면은 그 장면 이름: `saidBye`, `talkMioDan`

## 패턴으로 정해지는 이름

| 패턴 | 뜻 |
|---|---|
| `fragmentN, chapterN` | N = 1..7. 제단에서 조각을 얻음 / 종지기에게 전해 장을 마침 (src/chapter.js, src/field.js) |
| `chest_<id>, pick_<id>` | 상자를 엶 / 줍는 물건을 주움 (src/props.js) |
| `map:<region>` | 그 지역에 가 봄, 지도 화면용 (src/chapter.js) |
| `tried_<보스 종류>` | 그 보스와 한 번 싸움: 다시 도전하면 소개가 한 줄 (src/chapter.js, src/field.js) |
| `restAt` | 마지막으로 쉰 여관 { map, x, y, dir } (src/chapter.js). 같은 장에서 지면 여기서 깨어남 |

## 개별 플래그

| 플래그 | 켜지는 때 (파일) |
|---|---|
| `boss1` | 보스 승리 (rules.js) |
| `boss2` | 보스 승리 (ch2.js) |
| `boss3` | 보스 승리 (ch3.js) |
| `boss4` | 보스 승리 (ch4.js) |
| `boss5` | 보스 승리 (ch5.js) |
| `boss6` | 보스 승리 (ch6.js) |
| `boss7` | 보스 승리 (ch7.js) |
| `canyonArrived` | 지도에 들어섬 (ch3.js) |
| `coreArrived` | 지도에 들어섬 (ch7.js) |
| `grovePuzzle` | 풍경 퍼즐 (maps.js) |
| `metAstronomer` | NPC와 대화 (ch6.js) |
| `metForeman` | NPC와 대화 (ch3.js) |
| `metHarbor` | NPC와 대화 (ch2.js) |
| `metHunter` | NPC와 대화 (ch5.js) |
| `metKeeper` | 코드 (quests.js) |
| `metSpirit` | NPC와 대화 (ch7.js) |
| `metYoungKeeper` | NPC와 대화 (ch4.js) |
| `mioAsked` | 코드 (quests.js) |
| `mioJoined` | 코드 (quests.js) |
| `mioStart` | 코드 (quests.js) |
| `pastArrived` | 지도에 들어섬 (ch4.js) |
| `portArrived` | 지도에 들어섬 (ch2.js) |
| `saidBye` | 코드 (chapter.js) |
| `secret2` | 풍경 퍼즐 (ch2.js) |
| `secret3` | 풍경 퍼즐 (ch3.js) |
| `secret4` | 풍경 퍼즐 (ch4.js) |
| `secret5` | 풍경 퍼즐 (ch5.js) |
| `secret6` | 풍경 퍼즐 (ch6.js) |
| `secret7` | 풍경 퍼즐 (ch7.js) |
| `snowArrived` | 지도에 들어섬 (ch5.js) |
| `starArrived` | 지도에 들어섬 (ch6.js) |
| `talkAll` | 여관 대화 (chapter.js) |
| `talkDanHaru` | 여관 대화 (chapter.js) |
| `talkMioDan` | 여관 대화 (chapter.js) |
| `talkMioHaru` | 여관 대화 (chapter.js) |
| `talkPip` | 여관 대화 (chapter.js) |
| `tobyAsked` | 코드 (quests.js) |
| `tobyDone` | 코드 (quests.js) |
