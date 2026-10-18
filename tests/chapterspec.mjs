// What each chapter asks of the player, shared by the balance tests.
//   lvl: the boss's level with this chapter's gear (gear) and companions
//   part: a weapon and armour of this tier, the rest from the last one
//   prev: last chapter's gear; arrive: the level you come in at
//   groups: field fights on the way, for someone who just arrived
//   early: how often a level-early party may still win (late levels add less)
export const TIERS = {
  1: ['mallet', 'cap', 'vest', 'gloves', 'sandals', 'amulet', 'oldscore'],
  2: ['coral', 'hood', 'coat', 'net', 'reefboots', 'pearlear', 'wavescore'],
  3: ['echomallet', 'minerhelm', 'stonemail', 'pickgloves', 'cliffboots', 'echostone', 'echoscore'],
  4: ['brassmallet', 'tophat', 'oldcoat', 'tickgloves', 'oldboots', 'pocketwatch', 'oldsong'],
  5: ['icemallet', 'furhat', 'furcoat', 'mittens', 'snowshoes', 'snowcharm', 'winterscore'],
  6: ['starmallet', 'starcap', 'nightrobe', 'lensgloves', 'cometboots', 'moonlocket', 'starscore'],
  7: ['hourmallet', 'starcap', 'nightrobe', 'lensgloves', 'cometboots', 'moonlocket', 'lastscore']
};
const part = (t) => [TIERS[t][0], TIERS[t - 1][1], TIERS[t][2]].concat(TIERS[t - 1].slice(3));
export const SPEC = () => ({
  3: { boss: 'echoking', lvl: 11, gear: TIERS[3], part: part(3), prev: TIERS[2], allies: ['mio', 'dan'], items: { soup: 4, bigdrop: 2, water: 2 },
    arrive: 8, arriveAllies: ['mio'], maps: ['canyon'], groups: [['echobat', 'dustwisp', 'rockgolem'], ['rockgolem', 'rockgolem', 'echobat']] },
  4: { boss: 'timeeater', lvl: 14, gear: TIERS[4], part: part(4), prev: TIERS[3], allies: ['mio', 'dan', 'haru'], items: { honeycake: 3, soup: 2, bigdrop: 2, water: 2 },
    arrive: 11, arriveAllies: ['mio', 'dan'], maps: ['pastwood'], groups: [['tickwisp', 'duskbat', 'cogolem'], ['cogolem', 'cogolem', 'duskbat']] },
  5: { boss: 'frostwing', lvl: 17, gear: TIERS[5], part: part(5), prev: TIERS[4], allies: ['mio', 'dan', 'haru'], items: { honeycake: 4, gingertea: 2, water: 2 },
    arrive: 14, arriveAllies: ['mio', 'dan', 'haru'], maps: ['snowroad'], groups: [['snowjelly', 'frostbat', 'icegolem'], ['icegolem', 'icegolem', 'frostbat']] },
  6: { boss: 'eclipse', lvl: 20, early: 0.88, gear: TIERS[6], part: part(6), prev: TIERS[5], allies: ['mio', 'dan', 'haru'], items: { starhoney: 4, gingertea: 2, water: 2 },
    arrive: 17, arriveAllies: ['mio', 'dan', 'haru'], maps: ['starpath'], groups: [['starbit', 'nightbat', 'moonwisp'], ['starbit', 'starbit', 'nightbat']] },
  7: { boss: 'hush', lvl: 23, early: 0.88, gear: TIERS[7], part: part(7), prev: TIERS[6], allies: ['mio', 'dan', 'haru'], items: { starhoney: 5, gingertea: 3, water: 2 },
    arrive: 20, arriveAllies: ['mio', 'dan', 'haru'], maps: ['bellcore'], groups: [['bellwisp', 'timestar', 'clockgolem'], ['clockgolem', 'clockgolem', 'timestar']] }
});
