// THE CANDLESTICK HEIST, with the two players it was written for.
//
// Heroes' Quest in 2006 is a two-player quest and this content implements it that way on purpose:
//
//   [proc,grip_attack]        refuses a Black Arm member ("Perhaps you need another player's
//                             help...?"); only a Phoenix member may touch Grip.
//   [oplocu,pete_sidedoor]    needs the miscellaneous key, which only Grip hands to his new
//                             deputy - the Black Arm member.
//   [oplocu,pete_treasuredoor] takes Grip's keys only from somebody who has handed over the ID
//                             papers, which again is the Black Arm member.
//   [oploc1,opencandlechest]  gives TWO candlesticks: "one for you, and one for the person who
//                             killed Grip for you".
//
// So neither half can finish alone, and quest_hero_run.ts stops at the deputy's post. This drives
// both halves at once: the deputy unlocks the side door, the Phoenix thief comes in and kills Grip,
// the deputy opens the treasure room with his keys, and they split the chest.
//
//   npx tsx tools/sim/heroes_candlestick.ts
import * as H from './harness.js';
import { useOn, drive } from './a1lib.js';
import { travel } from './questrun.js';

await H.boot();

const SIDEDOOR: [number, number] = [2781, 3197];
const TREASUREDOOR: [number, number] = [2764, 3197];
const CHEST: [number, number] = [2766, 3199];

let pass = 0;
let fail = 0;
function check(what: string, ok: boolean, detail = '') {
    if (ok) pass++;
    else fail++;
    console.log('  ' + (what.length > 62 ? what.slice(0, 61) + '~' : what.padEnd(62)) + (ok ? ' ok' : ' FAIL') + (detail ? '  ' + detail : ''));
}

// The Phoenix thief: Shield of Arrav with the Phoenix gang, and Heroes' as far as Charlie, which
// is what [proc,grip_attack] wants to see.
const thief: any = H.makePlayer('phoenixthief', 2781, 3195);
// The Black Arm deputy: Shield of Arrav with the Black Arm, ID papers handed to Grip, which is
// where quest_hero_run.ts leaves off.
const deputy: any = H.makePlayer('blackarmdeputy', 2781, 3198);
H.tick(3);
for (const p of [thief, deputy]) {
    p.applyDamage = function () {};
    H.setVar(p, 'macro_event', 1);
    H.maxOut(p);
    H.setVar(p, 'qp', 55);
    H.setVar(p, 'zanaris', 6);
    H.setVar(p, 'dragonquest', 10);
    H.setVar(p, 'arthur', 7);
}
H.setVar(thief, 'phoenixgang', 10);
H.setVar(thief, 'heroquest', 4); // ^hero_phoenix_talked_charlie
H.setVar(deputy, 'blackarmgang', 4);
H.setVar(deputy, 'heroquest', 11); // ^hero_blackarm_id_papers_given
H.give(deputy, 'misc_key');
H.give(thief, 'rune_scimitar');
H.opheld(thief, 'rune_scimitar', 2);
H.tick(2);

console.log('');
console.log("THE CANDLESTICK HEIST  (Heroes' Quest, two players)");
console.log('');

// 1. the deputy unlocks the side door from the mansion side. The two sides of that door are
// pockets of their own - the thief's is the "old side entrance ... blocked off from the rest of
// the mansion some years ago" that Charlie describes, and the deputy's is the far side of it - so
// both players are placed where the quest puts them rather than walked across Karamja.
travel(deputy, 2781, 3197, 0, 32, 0);
const mark1 = H.mesgs.length;
useOn(deputy, SIDEDOOR[0], SIDEDOOR[1], 'pete_sidedoor', 'misc_key');
H.tick(4);
const said1 = H.mesgs.slice(mark1).filter(x => x.who === deputy.username).map(x => x.text).join(' ');
check('the deputy unlocks the side door with the odd key Grip gave him', !said1.includes('locked'), said1.slice(0, 40));

// 2. and the pair of them head for Grip. The mansion's inside is a chain of small rooms with a
// door between each pair, which quest_hero_run.ts walks properly on the way in; here both players
// are simply put where the quest wants them, because what is being tested is the heist's own
// rules rather than the floor plan.
thief.teleport(2776, 3194, 0);
deputy.teleport(2777, 3193, 0);
H.tick(2);

// 3. and kills Grip, which the deputy is not allowed to do
const grip = H.npcNear('grip', 2774, 3192, 0)!;
check('Grip is at his post', !!grip, grip ? grip.x + ',' + grip.z : '');
// the content's own gate on attacking Grip, asked directly: false for the deputy, true for the
// thief. H.attackNpc sets the interaction itself and would walk straight past it.
// The refusal talks before it returns, so the proc suspends and hands back nothing; the words
// are the answer. The thief's side returns cleanly because it says nothing at all.
const markGate = H.ifaces.length;
H.runProc(deputy, '[proc,grip_attack]');
const refusal = drive(deputy, []).join(' ');
const saidGate = H.ifaces
    .slice(markGate)
    .filter(i => i.who === deputy.username && i.kind === 'text' && i.text)
    .map(i => i.text)
    .join(' ');
check(
    'the deputy is refused - too many witnesses, and he wants the promotion',
    (refusal + ' ' + saidGate).includes("attack the head guard"),
    (refusal + ' ' + saidGate).slice(0, 46)
);
const thiefMay = H.runProc(thief, '[proc,grip_attack]')[0];
check('the Phoenix thief is allowed', thiefMay === 1, 'grip_attack ' + thiefMay);

let dead = false;
for (let t = 0; t < 400 && !dead; t++) {
    if (!grip.isValid()) {
        dead = true;
        break;
    }
    if (!thief.target && !thief.delayed) {
        thief.closeModal(false);
        H.attackNpc(thief, grip);
    }
    H.tick(1);
}
H.tick(10);
check('the thief kills Grip', dead);
check("the thief's quest moves to 'killed Grip'", H.getVar(thief, 'heroquest') === 5, 'heroquest ' + H.getVar(thief, 'heroquest'));

// 4. the deputy picks up the keys off him and opens the treasure room
travel(deputy, grip.x, grip.z, 0, 32, 0);
H.opObj(deputy, deputy.x, deputy.z, 'grip_keys', 3, false);
H.tick(4);
check('the keys are off Grip and in the deputy’s hands', H.invCount(deputy, 'grip_keys') > 0);

deputy.teleport(2765, 3197, 0);
H.tick(1);
const mark2 = H.mesgs.length;
useOn(deputy, TREASUREDOOR[0], TREASUREDOOR[1], 'pete_treasuredoor', 'grip_keys');
H.tick(4);
const said2 = H.mesgs.slice(mark2).filter(x => x.who === deputy.username).map(x => x.text).join(' ');
check('Grip’s key unlocks the treasure room for the deputy', said2.includes('unlocks the door'), said2.slice(0, 40));

// 5. the chest holds two: one each
deputy.teleport(2766, 3198, 0);
H.tick(1);
H.opLoc(deputy, CHEST[0], CHEST[1], 'shutcandlechest', 1);
H.tick(3);
drive(deputy, []);
H.opLoc(deputy, CHEST[0], CHEST[1], 'opencandlechest', 1);
H.tick(3);
drive(deputy, []);
check('the chest holds two candlesticks - one each', H.invCount(deputy, 'petecandlestick') === 2, 'has ' + H.invCount(deputy, 'petecandlestick'));
check('and the deputy is credited with the robbery', H.getVar(deputy, 'heroquest') === 12, 'heroquest ' + H.getVar(deputy, 'heroquest'));

// the second one goes to the thief. In game that is a trade, which no sim can make; the point of
// the check is that the chest produced a spare for him at all.
H.give(thief, 'petecandlestick');
check('the thief has his half of the loot (traded over, declared here)', H.invCount(thief, 'petecandlestick') > 0);
check('and his quest is still on the Phoenix track, not the Black Arm one', H.getVar(thief, 'heroquest') === 5, 'heroquest ' + H.getVar(thief, 'heroquest'));

// 6. each hands in to their own gang leader
thief.teleport(3188, 3387, 0);
deputy.teleport(3188, 3387, 0);
H.tick(2);
const straven = H.npcNear('straven', 3190, 3389, 0);
if (straven) {
    thief.teleport(straven.x, straven.z + 1, 0);
    H.tick(1);
    H.opNpc(thief, straven, 1);
    H.tick(3);
    drive(thief, []);
    check('Straven gives the thief a master thief armband', H.invCount(thief, 'master_thief_armband') > 0);
    check('and his quest reaches "armband obtained"', H.getVar(thief, 'heroquest') === 6, 'heroquest ' + H.getVar(thief, 'heroquest'));
} else {
    check('Straven is somewhere near the Phoenix hideout', false, 'not found');
}
const katrine = H.npcNear('katrine', 3187, 3386, 0);
if (katrine) {
    deputy.teleport(katrine.x, katrine.z + 1, 0);
    H.tick(1);
    H.opNpc(deputy, katrine, 1);
    H.tick(3);
    drive(deputy, ['I have a candlestick now!']);
    check('Katrine gives the deputy a master thief armband', H.invCount(deputy, 'master_thief_armband') > 0);
    check('and his quest reaches "armband obtained"', H.getVar(deputy, 'heroquest') === 13, 'heroquest ' + H.getVar(deputy, 'heroquest'));
} else {
    check('Katrine is in the Black Arm hideout', false, 'not found');
}

console.log('');
console.log('  ' + pass + ' of ' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
