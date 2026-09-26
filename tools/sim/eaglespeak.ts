// Eagles' Peak, start to finish against the real engine - run with `npx tsx tools/sim/eaglespeak.ts`.
//
//   start      Charlie at Ardougne Zoo turns away a player under 27 Hunter, then sends one after
//              Nickolaus; the journal and the quest list row
//   camp       the abandoned camp (fire, gear, the books), the bird book and its metal feather, the
//              climbing rocks (25 Agility), the rocky outcrop opened with the feather
//   cave       the ledge over the chasm and Nickolaus's shouted conversation, the giant feathers
//   costume    Asyff: what he needs, then two eagle costumes for 10 feathers, swamp tar, yellow dye, 50gp
//   bronze     the net springs, the four winches, the feather
//   silver     the trail (pedestal, the two heaps, the opening), the kebbit, its feather
//   gold       the metal birds, gates and levers played through the wiki's solution; the corridor is shut
//              before it and open after it; the reset lever
//   door       the three feathers into the stone door, and through it
//   nest       the eagle swipes at a player without the disguise and lets one in it by; Nickolaus takes
//              the second costume
//   ending     Nickolaus's ferret at the camp, Charlie's reward (2 QP, 2,500 Hunter xp)
//   transport  a rope on each of the three eagles and back; the Uzer boulder, the Feldip vine, the
//              Rellekka handholds
//   box trap   a ferret goes for the trap of a player who has done the quest, never for one who has not
//   ops        no Eagles' Peak loc or npc op is a dead click
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();
const { check } = A;
const truthy = (what: string, pass: boolean, got: unknown = pass) => check(what, pass ? true : got, true);

const stage = (p: Player) => H.getVar(p, 'eaglespeak');
const bit = (p: Player, n: string) => H.getVarBit(p, n);
const hasLoc = (name: string, x: number, z: number, level: number) => !!World.getLoc(x, z, level, LocType.getId(name));
const joined = (lines: string[]) => lines.join(' ').replace(/\s+/g, ' ');

function journal(p: Player): string {
    const from = H.ifaces.length;
    H.ifButton(p, 'questlist:eaglespeak');
    H.tick(1);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '').join('|');
}

function to(p: Player, x: number, z: number, level: number) {
    p.teleport(x, z, level);
    H.tick(2);
}

// =============================================================================================
console.log('START');
const low = A.player('eaglelow', 2604, 3264);
low.setLevel(PlayerStat.HUNTER, 20);
let said = joined(A.talk(low, 'eagle_charlie', ['quest doing']));
check('Charlie turns away a player under 27 Hunter', stage(low), 0);
truthy('  "I need somebody with a little more experience"', said.includes('a little more experience'), said.slice(-120));

const p = A.player('eaglepeak', 2604, 3264);
p.setLevel(PlayerStat.HUNTER, 27);
p.setLevel(PlayerStat.AGILITY, 50);
let j = journal(p);
truthy('journal (not started): Charlie at Ardougne Zoo, 27 Hunter', j.includes('@dre@Charlie') && j.includes('Level 27 Hunter'), j.slice(0, 100));
said = joined(A.talk(p, 'eagle_charlie', ['quest doing', 'Sure.']));
check('Charlie sends the player after Nickolaus', stage(p), 1);
truthy('  "mountains just west of the Gnome Stronghold"', said.includes('just west of the Gnome Stronghold'), said.slice(-150));
said = joined(A.talk(p, 'eagle_charlie'));
truthy('Charlie again: "camping out somewhere to the west"', said.includes('camping out somewhere'), said.slice(-100));

console.log('CAMP');
to(p, 2318, 3503, 0);
let m = A.mark();
A.op(p, 2318, 3505, 'eagle_camp_fire');
truthy('the fire: "A few logs are still burning"', A.said(p, m, 'A few logs are still burning'), A.mesSince(p, m));
m = A.mark();
A.op(p, 2318, 3507, 'eagle_camp_equipment');
truthy('the gear: "trampled into the ground"', A.said(p, m, 'trampled into the ground'), A.mesSince(p, m));
said = joined(A.op(p, 2319, 3506, 'eagle_camp_books'));
check('the books give the bird book', H.invCount(p, 'bird_book'), 1);
said = joined(A.held(p, 'bird_book', 1));
check('reading it: the metal feather falls out', H.invCount(p, 'eagle_metal_feather'), 1);
check('  stage', stage(p), 2);
truthy('  the book opens on the crimson swift', said.includes('Crimson Swift'), said.slice(0, 80));
p.closeModal();
m = A.mark();
A.op(p, 2319, 3506, 'eagle_camp_books');
truthy('the books again: "kicked over"', A.said(p, m, 'kicked over'), A.mesSince(p, m));
said = joined(A.talk(p, 'eagle_charlie'));
truthy('Charlie: "we just sent him to look for ferrets"', said.includes('look for ferrets'), said.slice(-80));

to(p, 2322, 3502, 0);
A.op(p, 2322, 3501, 'loc474_19849');
check('the rocks climb up to the peak', A.at(p), [2324, 3497, 0]);
said = joined(A.op(p, 2328, 3494, 'eagle_outcrop', 2));
truthy('the outcrop: "a carving of a feather above it"', said.includes('carving of a feather'), said.slice(-80));
said = joined(A.useOn(p, 2328, 3494, 'eagle_outcrop', 'eagle_metal_feather'));
check('the metal feather opens it', stage(p), 3);
truthy('  "Part of the cliff face swings outwards"', said.includes('swings outwards'), said);
A.op(p, 2328, 3494, 'eagle_outcrop', 1);
check('Enter: into the cave', A.at(p), [1994, 4983, 3]);

console.log('CAVE');
to(p, 2004, 4967, 3);
said = joined(A.op(p, 2004, 4965, 'loc474_19752', 1, ['Ardougne zookeeper', "trapped then", 'Could I help']));
truthy('Nickolaus across the chasm: "I have just discovered the nest of a giant eagle"', said.includes('discovered the nest of a giant'), said.slice(0, 100));
check('he asks for a disguise', stage(p), 4);
said = joined(A.op(p, 2004, 4965, 'loc474_19752'));
truthy('shouting again: "Varrock fancy dress shop is a good bet"', said.includes('fancy dress shop is a good bet'), said.slice(-120));
to(p, 2004, 4972, 3);
for (let i = 0; i < 10; i++) A.op(p, 2005, 4972, 'loc474_19922');
check('ten eagle feathers from the piles', H.invCount(p, 'eagle_feather'), 10);

console.log('COSTUME');
to(p, 3281, 3399, 0);
said = joined(A.talk(p, 'tailorp', ['bird costumes']));
truthy('Asyff: "about 10 giant eagle feathers", swamp tar, yellow dye', said.includes('10 giant eagle feathers') && said.includes('swamp tar'), said.slice(-160));
H.give(p, 'swamp_tar'); H.give(p, 'yellowdye'); H.give(p, 'coins', 100);
said = joined(A.talk(p, 'tailorp', ['feathers and materials', 'Eagle me up']));
check('two eagle capes and two fake beaks', [H.invCount(p, 'eagle_cape'), H.invCount(p, 'fake_beak')], [2, 2]);
check('  for the feathers, the tar, the dye and 50 coins', [H.invCount(p, 'eagle_feather'), H.invCount(p, 'swamp_tar'), H.invCount(p, 'yellowdye'), H.invCount(p, 'coins')], [0, 0, 0, 50]);
said = joined(A.talk(p, 'tailorp', ['another bird costume']));
truthy('then: "It\'ll also cost you 25 gold pieces"', said.includes('25 gold pieces'), said.slice(-100));

console.log('BRONZE');
to(p, 1987, 4949, 3);
A.op(p, 1986, 4949, 'loc474_19909');
check('the tunnel to the bronze feather', A.at(p), [1974, 4908, 2]);
m = A.mark();
A.op(p, 1970, 4919, 'loc474_19976');
truthy('a winch before the net: "doesn\'t seem to move"', A.said(p, m, "doesn't seem to move"), A.mesSince(p, m));
m = A.mark();
A.op(p, 1973, 4914, 'loc474_19980');
truthy('reaching for it springs the net', A.said(p, m, 'netting on the ground shoots upwards') && hasLoc('loc474_19982', 1973, 4914, 2), A.mesSince(p, m));
for (const [x, z, n] of [[1970, 4919, 'loc474_19976'], [1978, 4919, 'loc474_19977'], [1970, 4910, 'loc474_19978'], [1978, 4910, 'loc474_19979']] as [number, number, string][]) {
    m = A.mark();
    A.op(p, x, z, n);
    truthy(`  ${n}: "You wind the winch"`, A.said(p, m, 'You wind the winch'), A.mesSince(p, m));
}
m = A.mark();
A.op(p, 1970, 4919, 'loc474_19976');
truthy('  again: "doesn\'t seem to turn any further"', A.said(p, m, 'turn any further'), A.mesSince(p, m));
check('the pedestal comes down out of the net', hasLoc('loc474_19982', 1973, 4914, 2), false);
H.tick(6);
A.op(p, 1973, 4914, 'loc474_19980');
check('the bronze feather', H.invCount(p, 'eagle_bronze_feather'), 1);
m = A.mark();
A.op(p, 1973, 4914, 'loc474_19980');
truthy('a second: "I already have a bronze feather like that."', A.said(p, m, 'already have a bronze feather'), A.mesSince(p, m));
A.op(p, 1974, 4907, 'loc474_19906');
check('back to the cave', A.at(p), [1987, 4949, 3]);

console.log('SILVER');
to(p, 1987, 4972, 3);
A.op(p, 1986, 4972, 'loc474_19903');
check('the tunnel to the silver feather', A.at(p), [1947, 4868, 2]);
said = joined(A.op(p, 1947, 4873, 'loc474_19974'));
check('the pedestal: footprints', bit(p, 'eaglespeak_silver_trail'), 1);
truthy('  "faint footprints leading away"', said.includes('faint footprints'), said.slice(-80));
m = A.mark();
A.op(p, 1957, 4869, 'loc474_19971');
truthy('a wrong heap: "generally just rock-like"', A.said(p, m, 'just rock-like'), A.mesSince(p, m));
A.op(p, 1961, 4875, 'loc474_19969');
check('the first heap', bit(p, 'eaglespeak_silver_trail'), 3);
A.op(p, 1967, 4879, 'loc474_19970');
check('the second heap', bit(p, 'eaglespeak_silver_trail'), 4);
m = A.mark();
A.op(p, 1971, 4886, 'loc474_19967');
const kebbit = H.npcNear('eagle_kebbit', 1971, 4885, 2);
if (kebbit) A.fight(p, kebbit);
H.tick(10);
truthy('the opening: "You peer down the tunnel", and a giant kebbit jumps out', A.said(p, m, 'You peer down the tunnel') && H.saysFor('eaglepeak').some(s => s.text === 'Er...'), A.mesSince(p, m));
check('the kebbit killed', bit(p, 'eaglespeak_silver_trail'), 5);
A.take(p, 'eagle_silver_feather', 6);
check('its silver feather', H.invCount(p, 'eagle_silver_feather'), 1);
A.op(p, 1947, 4867, 'loc474_19900');

console.log('GOLD');
to(p, 2022, 4982, 3);
A.op(p, 2023, 4982, 'loc474_19897');
check('the tunnel to the gold feather', A.at(p), [1957, 4908, 2]);
check('the five metal birds are laid out', [hasLoc('loc474_19935', 1931, 4914, 2), hasLoc('loc474_19935', 1935, 4898, 2), hasLoc('loc474_19935', 1945, 4906, 2), hasLoc('loc474_19935', 1963, 4900, 2), hasLoc('loc474_19935', 1971, 4890, 2)], [true, true, true, true, true]);
check('the corridor to the feather is shut', A.connected(2, 1957, 4908, 1929, 4907), false);
for (let i = 0; i < 6; i++) A.op(p, 1958, 4906, 'loc474_19919');
check('six handfuls of odd bird seed', H.invCount(p, 'odd_bird_seed'), 6);
const feed = (x: number, z: number, n: string) => { const f = A.mark(); A.useOn(p, x, z, n, 'odd_bird_seed'); return A.mesSince(p, f); };
const pull = (x: number, z: number, n: string, o = 1) => { const f = A.mark(); A.op(p, x, z, n, o); return A.mesSince(p, f); };
// RuneScape wiki's order: the corner feeder, the south-west lever, the centre lever, the two south-east
// feeders, the south-east lever, the centre lever back up, the north feeder, the north-west lever, the
// west feeder, the corner feeder again.
let got = feed(1947, 4898, 'loc474_19937');
check('1 corner feeder: the east-west bird comes (the north-south one is behind the south gate)', [hasLoc('loc474_19935', 1945, 4898, 2), hasLoc('loc474_19935', 1945, 4906, 2)], [true, true]);
got = pull(1935, 4902, 'eagle_gold_lever_sw');
truthy('2 south-west lever: "a low grinding elsewhere"', got.some(s => s.includes('low grinding')), got);
got = pull(1943, 4911, 'eagle_gold_lever_centre');
check('3 centre lever: the east gate opens', hasLoc('loc474_19871', 1953, 4900, 2), true);
got = feed(1966, 4890, 'loc474_19939');
check('4 the south-east track\'s bird comes west', hasLoc('loc474_19935', 1967, 4890, 2), true);
got = feed(1962, 4894, 'loc474_19938');
check('5 the north-south south-east bird goes down', hasLoc('loc474_19935', 1963, 4894, 2), true);
got = pull(1978, 4891, 'eagle_gold_lever_se');
check('6 south-east lever reached and pulled', hasLoc('eagle_gold_lever_se_down', 1978, 4891, 2), true);
got = pull(1943, 4911, 'eagle_gold_lever_centre_down', 2);
check('7 centre lever pushed back up', hasLoc('eagle_gold_lever_centre', 1943, 4911, 2), true);
got = feed(1945, 4915, 'loc474_19936');
check('8 the north bird comes east', hasLoc('loc474_19935', 1943, 4914, 2), true);
got = pull(1925, 4915, 'eagle_gold_lever_nw');
check('9 north-west lever: the corridor gate opens', hasLoc('loc474_19871', 1934, 4906, 2), true);
got = feed(1935, 4897, 'loc474_19941');
check('10 west feeder: the east-west bird goes back', hasLoc('loc474_19935', 1935, 4898, 2), true);
got = feed(1947, 4898, 'loc474_19937');
check('11 corner feeder: the north-south bird comes down out of the corridor', [hasLoc('loc474_19935', 1945, 4898, 2), hasLoc('loc474_19935', 1945, 4906, 2)], [true, false]);
check('the corridor to the feather is open', A.connected(2, 1957, 4908, 1929, 4907), true);
check('six handfuls were all it took', H.invCount(p, 'odd_bird_seed'), 0);
A.op(p, 1958, 4906, 'loc474_19919');
m = A.mark();
feed(1947, 4898, 'loc474_19937');
truthy('a feeder whose bird is there: "seems to have no effect"', A.said(p, m, 'no effect'), A.mesSince(p, m));
A.op(p, 1928, 4907, 'loc474_19950');
check('the golden feather', H.invCount(p, 'eagle_golden_feather'), 1);
A.op(p, 1957, 4909, 'loc474_19894');
said = joined(A.op(p, 2022, 4981, 'loc474_19945', 1, ['Yes, pull']));
check('the reset lever puts the birds back', [hasLoc('loc474_19935', 1945, 4906, 2), hasLoc('loc474_19870', 1934, 4906, 2)], [true, true]);

console.log('DOOR');
to(p, 2002, 4947, 3);
said = joined(A.op(p, 2003, 4947, 'eagle_door_south'));
truthy('the door: "locked in place... an engraving of an eagle"', said.includes('locked in place'), said.slice(0, 80));
A.useOn(p, 2003, 4947, 'eagle_door_south', 'eagle_bronze_feather');
A.useOn(p, 2003, 4947, 'eagle_door_south', 'eagle_silver_feather');
said = joined(A.useOn(p, 2003, 4948, 'eagle_door_north', 'eagle_golden_feather'));
check('three feathers in the door', bit(p, 'eaglespeak_door_count'), 3);
truthy('  "a low grinding as if stone blocks were moving"', said.includes('stone blocks were moving'), said);
A.op(p, 2003, 4947, 'eagle_door_south');
check('through the door', A.at(p), [2003, 4947, 3]);

console.log('NEST');
to(p, 2007, 4953, 3);
const hp = p.levels[PlayerStat.HITPOINTS];
m = A.mark();
A.talk(p, 'eagle_giant', [], 1, false);
truthy('no disguise: the eagle swipes', A.said(p, m, 'takes a swipe at you') && p.levels[PlayerStat.HITPOINTS] < hp, A.mesSince(p, m));
H.equip(p, { back: 'eagle_cape', hat: 'fake_beak' });
const inv = p.getInventory(InvType.INV)!;
inv.remove(ObjType.getId('eagle_cape'), 1);
inv.remove(ObjType.getId('fake_beak'), 1);
m = A.mark();
A.talk(p, 'eagle_giant', [], 1, false);
check('in the disguise: past the eagle into the nest', A.at(p), [2007, 4957, 3]);
said = joined(A.talk(p, 'eagle_nickolaus_nest_shell', [], 1, false));
truthy('Nickolaus: "What\'s this, a young hatchling?"', said.includes('young hatchling'), said.slice(0, 80));
check('he takes the second costume', [stage(p), H.invCount(p, 'eagle_cape'), H.invCount(p, 'fake_beak')], [5, 0, 0]);

console.log('ENDING');
said = joined(A.talk(p, 'eagle_charlie'));
truthy('Charlie: "tell him to hurry up with that ferret"', said.includes('hurry up with that ferret'), said.slice(-100));
to(p, 2319, 3503, 0);
said = joined(A.talk(p, 'eagle_nickolaus_camp_shell', ['ferret', 'sounds good']));
check('Nickolaus at the camp: a ferret and a box trap', [stage(p), H.invCount(p, 'ferret'), H.invCount(p, 'hunter_box_trap')], [6, 1, 1]);
truthy('  "One gift-wrapped ferret ready for delivery"', said.includes('gift-wrapped ferret'), said.slice(-160));
const xp = p.stats[PlayerStat.HUNTER];
const qp = H.getVar(p, 'qp');
said = joined(A.talk(p, 'eagle_charlie'));
check('Charlie takes the ferret: quest complete', [stage(p), H.invCount(p, 'ferret')], [7, 0]);
check('  2,500 Hunter xp', p.stats[PlayerStat.HUNTER] - xp, 25000);
check('  2 quest points', H.getVar(p, 'qp') - qp, 2);
j = journal(p);
truthy('journal: QUEST COMPLETE', j.includes('QUEST COMPLETE'), j.slice(-60));
said = joined(A.talk(p, 'eagle_charlie'));
truthy('Charlie after: "just as vicious as the one we lost"', said.includes('just as vicious'), said.slice(-100));

console.log('TRANSPORT');
H.give(p, 'rope', 3);
to(p, 2021, 4962, 3);
A.useOnNpc(p, 'eagle_desert_eagle', 'rope');
check('the desert eagle flies to the Uzer eyrie', A.at(p), [3421, 9568, 0]);
m = A.mark();
to(p, 3419, 9565, 0);
A.op(p, 3419, 9560, 'loc474_19791');
truthy('the way out: the boulder is in the way', A.said(p, m, 'boulder is blocking'), A.mesSince(p, m));
to(p, 3405, 3159, 0);
A.op(p, 3405, 3160, 'loc474_19798');
check('the cave in from the desert', A.at(p), [3419, 9562, 0]);
A.talk(p, 'eagle_boulder_shell', [], 1, true);
check('the boulder pushed aside (45 Strength)', bit(p, 'eaglespeak_boulder_pushed'), 1);
to(p, 3419, 9565, 0);
A.op(p, 3419, 9560, 'loc474_19791');
check('out into the desert', A.at(p), [3405, 3159, 0]);
A.op(p, 3405, 3160, 'loc474_19798');
to(p, 3421, 9568, 0);
A.useOnNpc(p, 'eagle_desert_eagle', 'rope');
check('the desert eagle back to Eagles\' Peak', A.at(p), [2021, 4962, 3]);
A.useOnNpc(p, 'eagle_jungle_eagle', 'rope');
check('the jungle eagle to the Feldip eyrie', A.at(p), [2525, 9320, 0]);
A.op(p, 2527, 9324, 'loc474_19759');
check('down the vine to the hunting grounds', A.at(p), [2514, 2927, 0]);
m = A.mark();
A.op(p, 2512, 2927, 'eagle_vine');
truthy('the young vine: "trained up the cliff with an appropriate cane or spar"', A.said(p, m, 'appropriate cane or spar'), A.mesSince(p, m));
H.give(p, 'teasing_stick');
A.useOn(p, 2512, 2927, 'eagle_vine', 'teasing_stick');
check('a teasing stick wraps it', bit(p, 'eaglespeak_vine'), 1);
H.setVar(p, 'eaglespeak_vine_planted', H.getVar(p, 'eaglespeak_vine_planted') - 41);
A.op(p, 2512, 2927, 'eagle_vine');
check('forty minutes on it is tall, and climbed', [bit(p, 'eaglespeak_vine'), ...A.at(p)], [3, 2525, 9320, 0]);
H.give(p, 'rope');
A.useOnNpc(p, 'eagle_jungle_eagle', 'rope');
check('the jungle eagle back', A.at(p), [2021, 4962, 3]);
H.give(p, 'rope');
A.useOnNpc(p, 'eagle_polar_eagle', 'rope');
check('the polar eagle to the Rellekka eyrie', A.at(p), [2726, 10215, 0]);
A.op(p, 2707, 10209, 'loc474_19763');
check('out onto the ledge', A.at(p), [2744, 3830, 1]);
A.op(p, 2743, 3830, 'loc474_19847');
check('the handholds (35 Agility) back along the cliff', A.at(p), [2740, 3830, 1]);
A.op(p, 2741, 3830, 'loc474_19846');
A.op(p, 2745, 3830, 'loc474_19762');
check('and along them to the cave, and in', A.at(p), [2711, 10209, 0]);
check('the ropes were used up', H.invCount(p, 'rope'), 0);

console.log('BOX TRAP');
check('a ferret goes for a trap of this player', H.runProc(p, '[proc,eaglespeak_can_trap_ferret]')[0], 1);
check('...never for one who has not done the quest', H.runProc(low, '[proc,eaglespeak_can_trap_ferret]')[0], 0);
check('ferrets live at the foot of Eagles\' Peak', !!H.npcNear('hunter_ferret', 2311, 3510, 0), true);

console.log('OPS');
for (const [t, x1, z1, x2, z2, lv] of [['Eagles\' Peak', 2304, 3456, 2367, 3519, [0]], ['the cave', 1984, 4928, 2047, 4991, [3]], ['the feather rooms', 1920, 4864, 1983, 4927, [2]],
    ['the eyries', 2688, 10176, 2751, 10239, [0]], ['Uzer eyrie', 3392, 9536, 3455, 9599, [0]], ['Feldip eyrie', 2496, 9280, 2559, 9343, [0]],
    ['the Rellekka cliff', 2730, 3820, 2750, 3840, [0, 1]], ['the Uzer cave mouth', 3395, 3150, 3415, 3170, [0]], ['the Feldip vine', 2505, 2920, 2520, 2932, [0]],
    ['Ardougne Zoo', 2596, 3250, 2620, 3275, [0]]] as [string, number, number, number, number, number[]][]) {
    const dead = A.deadLocOps(x1, z1, x2, z2, lv);
    check(`no dead loc op in ${t}`, [...dead.keys()], []);
    const deadN = A.deadNpcOps(x1, z1, x2, z2);
    check(`no dead npc op in ${t}`, [...deadN.keys()], []);
}

console.log(`\n${A.R.ok} ok, ${A.R.bad} failed`);
process.exit(A.R.bad ? 1 : 0);
