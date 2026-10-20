// The hero's numbers by level, and every foe's, as CSV for a spreadsheet.
// Run: node tools/balance-csv.mjs > balance.csv
import { loadHB } from '../tests/sim.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
console.log('level,maxHp,maxMp,atk,def,spd,expToNext');
const P = HB.newParty();
for (let l = 1; l <= 30; l++) {
  console.log([P.lvl, P.maxHp, P.maxMp, P.atk, P.def, P.spd, HB.expToNext(P.lvl)].join(','));
  HB.levelUp(P);
}
console.log('');
console.log('foe,boss,hp,atk,def,spd,exp,goldMin,goldMax,weak,resist,trait');
for (const [k, f] of Object.entries(HB.FOES)) console.log([k, f.boss ? 1 : 0, f.hp, f.atk, f.def, f.spd, f.exp, f.gold[0], f.gold[1], f.weak || '', f.resist || '', f.trait || ''].join(','));
