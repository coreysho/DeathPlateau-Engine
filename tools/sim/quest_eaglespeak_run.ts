// EAGLES' PEAK, played through on foot.
//
// Quest 89 of the quest-by-quest pass. Charlie at Ardougne Zoo has lost a zookeeper, and Nickolaus
// is sitting in a giant eagle's nest inside a mountain, unable to come out past the eagle.
//
// tools/sim/eaglespeak.ts already proves this quest at the op level - 124 checks including a
// no-dead-ops sweep of every room, the eagle transport network and the box traps - and it is still
// the authority on all of that. This is the other half of the question: whether a player can get
// from one end to the other on their own feet. Every tunnel, climb, winch, lever and feeder is
// clicked here and every leg inside a room is walked; the only steps are between the mountainside
// and the cave, and out to Asyff in Varrock, which have no walkable link in either direction.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_eaglespeak_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const CHARLIE: [number, number, number] = [2604, 3264, 0];
const CAMP: [number, number, number] = [2318, 3503, 0];
const ROCKS_STAND: [number, number, number] = [2322, 3502, 0];
const OUTCROP: [number, number] = [2328, 3494];
const ASYFF: [number, number, number] = [3281, 3399, 0];

// The same click, over and over: ten feathers out of a pile, six handfuls of seed out of a sack.
const times = (n: number, step: any) => Array.from({ length: n }, () => ({ ...step }));

const m: Manifest = {
    quest: "EAGLES' PEAK",
    source: 'oldschool.runescape.wiki/w/Eagles%27_Peak/Quick_guide',
    stageVar: 'eaglespeak',
    done: 7,
    start: CHARLIE,
    steps: [
        { note: 'requirements: 27 Hunter, and 25 Agility for the climb. Items: swamp tar, yellow' },
        { note: 'dye and 50 coins for the costumes, and a rope is handy afterwards.' },

        { note: 'wiki step 1: Charlie, at Ardougne Zoo' },
        { setpos: CHARLIE, why: 'to Charlie' },
        { talk: 'eagle_charlie', picks: ['quest doing', 'Sure.'], want: 'west of the Gnome Stronghold', why: 'he has lost a zookeeper' },
        { stage: 1 },

        { note: "wiki step 2: Nickolaus's abandoned camp, west of the Gnome Stronghold" },
        { setpos: CAMP, why: 'west to the camp' },
        { loc: 'eagle_camp_fire', at: [2318, 3505], want: 'A few logs are still burning', why: 'the fire is still warm' },
        { loc: 'eagle_camp_equipment', at: [2318, 3507], want: 'trampled into the ground', why: 'and the gear is trampled' },
        { loc: 'eagle_camp_books', at: [2319, 3506], why: 'search the books' },
        { has: 'bird_book' },
        { held: 'bird_book', op: 1, want: 'Crimson Swift', why: 'read it - a metal feather falls out' },
        { stage: 2 },
        { has: 'eagle_metal_feather' },
        { close: true, why: 'shut the book' },

        { note: 'wiki step 3: up the rocks (25 Agility) and along to the rocky outcrop' },
        { setpos: ROCKS_STAND, why: 'to the climbing rocks' },
        { loc: 'loc474_19849', at: [2322, 3501], hop: true, why: 'climb up to the peak' },
        { loc: 'eagle_outcrop', at: OUTCROP, op: 2, want: 'carving of a feather', why: 'study the outcrop' },
        { useLoc: 'eagle_outcrop', at: OUTCROP, obj: 'eagle_metal_feather', want: 'swings outwards', why: 'the feather opens it' },
        { stage: 3 },
        { loc: 'eagle_outcrop', at: OUTCROP, hop: true, why: 'in' },

        { note: 'wiki step 4: Nickolaus is shouting across the chasm' },
        { go: [2004, 4967], why: 'to the ledge over the chasm' },
        {
            loc: 'loc474_19752',
            at: [2004, 4965],
            picks: ['Ardougne zookeeper', 'trapped then', 'Could I help'],
            want: 'discovered the nest of a giant',
            why: 'he wants a disguise'
        },
        { stage: 4 },

        { note: 'wiki step 5: ten giant eagle feathers out of the piles' },
        { go: [2004, 4972], why: 'to the feather piles' },
        ...times(10, { loc: 'loc474_19922', at: [2005, 4972], why: 'a feather off the pile' }),
        { has: 'eagle_feather', n: 10 },

        { note: 'wiki step 6: Asyff, in Varrock, makes the costumes. There is no walking out of the' },
        { note: 'mountain and back, so this is the one leg that is stepped.' },
        { setpos: ASYFF, why: 'to Varrock, and Asyff' },
        { note: 'he is asked what he needs BEFORE the tar and the dye are in the pack - with them' },
        { note: 'there his menu is the one for a customer who has already brought everything.' },
        { talk: 'tailorp', picks: ['bird costumes'], want: '10 giant eagle feathers', why: 'he names his price' },
        { give: 'swamp_tar' },
        { give: 'yellowdye' },
        { give: 'coins', n: 100 },
        { talk: 'tailorp', picks: ['feathers and materials', 'Eagle me up'], want: 'eagle', why: 'two costumes' },
        { has: 'eagle_cape', n: 2 },
        { has: 'fake_beak', n: 2 },

        { note: 'wiki step 7: the bronze feather. Reaching for it springs a net; four winches lift' },
        { note: 'the net off the pedestal.' },
        { setpos: [1987, 4949, 3], why: 'back into the cave, to the eastern tunnel' },
        { loc: 'loc474_19909', at: [1986, 4949], hop: true, why: 'down the tunnel' },
        { go: [1973, 4915], why: 'to the pedestal' },
        { loc: 'loc474_19980', at: [1973, 4914], want: 'netting on the ground shoots upwards', why: 'reach for the feather' },
        { go: [1970, 4918], why: 'to the first winch' },
        { loc: 'loc474_19976', at: [1970, 4919], want: 'You wind the winch', why: 'wind it' },
        { go: [1978, 4918], why: 'the second' },
        { loc: 'loc474_19977', at: [1978, 4919], want: 'You wind the winch', why: 'wind it' },
        { go: [1978, 4911], why: 'the third' },
        { loc: 'loc474_19979', at: [1978, 4910], want: 'You wind the winch', why: 'wind it' },
        { go: [1970, 4911], why: 'and the fourth' },
        { loc: 'loc474_19978', at: [1970, 4910], want: 'You wind the winch', why: 'wind it' },
        { wait: 6, why: 'the pedestal comes down out of the net' },
        { go: [1973, 4915], why: 'back to the pedestal' },
        { loc: 'loc474_19980', at: [1973, 4914], why: 'take the bronze feather' },
        { has: 'eagle_bronze_feather' },
        { go: [1974, 4908], why: 'to the way back up' },
        { loc: 'loc474_19906', at: [1974, 4907], hop: true, why: 'up the tunnel' },

        { note: 'wiki step 8: the silver feather, at the end of a trail of footprints, down a hole' },
        { note: 'with a giant kebbit in it' },
        { go: [1987, 4972], why: 'to the northern tunnel' },
        { loc: 'loc474_19903', at: [1986, 4972], hop: true, why: 'down the tunnel' },
        { go: [1947, 4872], why: 'to the pedestal' },
        { loc: 'loc474_19974', at: [1947, 4873], want: 'faint footprints', why: 'the feather is gone, and something took it' },
        { go: [1961, 4874], why: 'along the trail' },
        { loc: 'loc474_19969', at: [1961, 4875], why: 'the first heap' },
        { go: [1967, 4878], why: 'on' },
        { loc: 'loc474_19970', at: [1967, 4879], why: 'the second heap' },
        { go: [1971, 4885], why: 'to the opening' },
        { note: 'brief, because the thing that comes out of the hole is aggressive: drive() would' },
        { note: 'spend its whole guard waiting for a fight a damage-immune sim cannot finish, and' },
        { note: 'the kebbit has expired by the time the fight step looks for it.' },
        { loc: 'loc474_19967', at: [1971, 4886], brief: 3, soft: true, why: 'and a giant kebbit comes out of it' },
        { fight: 'eagle_kebbit', tries: 8, r: 8, why: 'kill the kebbit' },
        { take: 'eagle_silver_feather', r: 6, why: 'it drops the silver feather' },
        { has: 'eagle_silver_feather' },
        { go: [1947, 4868], why: 'back to the tunnel' },
        { loc: 'loc474_19900', at: [1947, 4867], hop: true, why: 'up it' },

        { note: 'wiki step 9: the golden feather. Five metal birds on tracks block a corridor, and' },
        { note: 'the feeders and levers move them - the order below is the wiki solution.' },
        { setpos: [2022, 4982, 3], why: 'to the western tunnel' },
        { loc: 'loc474_19897', at: [2023, 4982], hop: true, why: 'down the tunnel' },
        { go: [1958, 4905], why: 'to the seed sack' },
        ...times(6, { loc: 'loc474_19919', at: [1958, 4906], why: 'a handful of odd bird seed' }),
        { has: 'odd_bird_seed', n: 6 },
        { go: [1947, 4899], why: 'to the corner feeder' },
        { useLoc: 'loc474_19937', at: [1947, 4898], obj: 'odd_bird_seed', soft: true, why: '1 the corner feeder' },
        { go: [1935, 4903], why: 'to the south-west lever' },
        { loc: 'eagle_gold_lever_sw', at: [1935, 4902], want: 'low grinding', why: '2 pull it' },
        { go: [1943, 4912], why: 'to the centre lever' },
        { loc: 'eagle_gold_lever_centre', at: [1943, 4911], why: '3 pull it - the east gate opens' },
        { go: [1966, 4891], why: 'to the south-east feeders' },
        { useLoc: 'loc474_19939', at: [1966, 4890], obj: 'odd_bird_seed', soft: true, why: '4 the far one' },
        { go: [1962, 4895], why: 'and the near one' },
        { useLoc: 'loc474_19938', at: [1962, 4894], obj: 'odd_bird_seed', soft: true, why: '5 feed it' },
        { go: [1978, 4892], why: 'to the south-east lever' },
        { loc: 'eagle_gold_lever_se', at: [1978, 4891], why: '6 pull it' },
        { go: [1943, 4912], why: 'back to the centre lever' },
        { loc: 'eagle_gold_lever_centre_down', at: [1943, 4911], op: 2, why: '7 push it back up' },
        { go: [1945, 4916], why: 'to the north feeder' },
        { useLoc: 'loc474_19936', at: [1945, 4915], obj: 'odd_bird_seed', soft: true, why: '8 feed it' },
        { go: [1925, 4916], why: 'to the north-west lever' },
        { loc: 'eagle_gold_lever_nw', at: [1925, 4915], why: '9 pull it - the corridor gate opens' },
        { go: [1935, 4898], why: 'to the west feeder' },
        { useLoc: 'loc474_19941', at: [1935, 4897], obj: 'odd_bird_seed', soft: true, why: '10 feed it' },
        { go: [1947, 4899], why: 'back to the corner feeder' },
        { useLoc: 'loc474_19937', at: [1947, 4898], obj: 'odd_bird_seed', soft: true, why: '11 and the corridor is clear' },
        { go: [1929, 4907], why: 'along the corridor' },
        { loc: 'loc474_19950', at: [1928, 4907], why: 'take the golden feather' },
        { has: 'eagle_golden_feather' },
        { go: [1957, 4909], why: 'back to the tunnel' },
        { loc: 'loc474_19894', at: [1957, 4909], hop: true, soft: true, why: 'up it' },

        { note: 'wiki step 10: the three feathers go into the stone door' },
        { go: [2002, 4947], why: 'to the stone door' },
        { loc: 'eagle_door_south', at: [2003, 4947], want: 'locked in place', why: 'it has an eagle engraved on it' },
        { useLoc: 'eagle_door_south', at: [2003, 4947], obj: 'eagle_bronze_feather', why: 'the bronze feather' },
        { useLoc: 'eagle_door_south', at: [2003, 4947], obj: 'eagle_silver_feather', why: 'the silver one' },
        { useLoc: 'eagle_door_south', at: [2003, 4947], obj: 'eagle_golden_feather', want: 'stone blocks were moving', why: 'and the golden one' },
        { loc: 'eagle_door_south', at: [2003, 4947], hop: true, why: 'through the door' },

        { note: 'wiki step 11: the eagle will not let anybody past who is not dressed as an eagle' },
        { go: [2007, 4953], why: 'to the nest' },
        { talk: 'eagle_giant', soft: true, want: 'takes a swipe at you', why: 'undisguised, it swipes' },
        { held: 'eagle_cape', op: 2, why: 'the cape' },
        { held: 'fake_beak', op: 2, why: 'and the beak' },
        { worn: 'eagle_cape' },
        { worn: 'fake_beak' },
        { talk: 'eagle_giant', soft: true, why: 'and now it lets you by' },
        { talk: 'eagle_nickolaus_nest_shell', soft: true, want: 'young hatchling', why: 'Nickolaus takes the spare costume' },
        { stage: 5 },
        { hasnt: 'eagle_cape' },

        { note: 'wiki step 12: he goes back to his camp, and hands over the ferret' },
        { setpos: [2319, 3503, 0], why: 'back to the camp' },
        { talk: 'eagle_nickolaus_camp_shell', picks: ['ferret', 'sounds good'], want: 'gift-wrapped ferret', why: 'the ferret and a box trap' },
        { stage: 6 },
        { has: 'ferret' },
        { has: 'hunter_box_trap' },

        { note: 'wiki step 13: the ferret to Charlie' },
        { setpos: CHARLIE, why: 'back to Ardougne Zoo' },
        { talk: 'eagle_charlie', why: 'hand over the ferret' },
        { stage: 7 },
        { hasnt: 'ferret' }
    ]
};

const p: any = H.makePlayer('eaglerun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
