// The Abyss (content areas/area_abyss): every outer-ring obstacle through the real oploc1 triggers,
// and the Law rift's Entrana check.
//   Rock      - the best pickaxe you can use, worn or carried, swung with ITS animation; none -> refused
//   Tendrils  - the same for axes
//   Boil      - needs a tinderbox
//   Eyes      - a random Emotes-tab emote
//   Gap, Passage
// Each skilled obstacle rolls stat_random(skill, 0, 255) and gives 25 xp: the roll is forced so the
// sim is exact - at a roll of 128/256, level 50 fails and level 51 gets through.
// Law rift: weapons or armour, worn or carried, keep you in the Abyss; empty-handed you land at the
// Law altar (not the Nature altar, where it used to send you).
import * as H from './harness.ts';
import World from '#/engine/World.js';
import SeqType from '#/cache/config/SeqType.js';
import JavaRandom from '#/util/JavaRandom.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const seq = (name: string) => {
    const id = SeqType.getId(name);
    if (id === -1) throw new Error('no such seq: ' + name);
    return id;
};
const seqName = (id: number) => SeqType.get(id)?.debugname ?? String(id);

// stat_random's roll is floor(nextDouble() * 256); pin it
const origND = JavaRandom.nextDouble.bind(JavaRandom);
function pinRoll(roll: number | null) {
    (JavaRandom as any).nextDouble = roll === null ? origND : () => roll / 256;
}

// rcu_outer_multi1 stands at 0_47_75_33_11 (3041,4811); which obstacle it shows is the
// rcu_abyssal_generator varbit (abyss.loc / abyss_outer.rs2's switch for multi1).
const MULTI_X = 3041, MULTI_Z = 4811;
const INNER = { x: 3042, z: 4819 }; // multi1's rcu_outer_inner_coord, 0_47_75_34_19
const GEN = { rock: 1, tendrils: 2, boil: 3, eyes: 4, gap: 5, passage: 6 } as const;
let n = 0;

function player(skill: string, level: number, gen: number) {
    const p: any = H.makePlayer('aby' + n++, 3042, 4809, 60 + n);
    H.tick(1);
    H.maxOut(p);
    const stat = PlayerStatMap.get(skill.toUpperCase())!;
    p.setLevel(stat, level);
    H.clearInv(p);
    H.setVarBit(p, 'rcu_abyssal_generator', gen);
    return { p, stat };
}

/** Click the multiloc's op1 and let the obstacle play out; what the player saw and where they are. */
function attempt(p: any, stat: number) {
    const xp0 = p.stats[stat];
    const m0 = H.mesgs.length, a0 = H.anims.length;
    H.opLoc(p, MULTI_X, MULTI_Z, 'rcu_outer_multi1', 1);
    let idle = 0;
    for (let t = 0; t < 40; t++) {
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    const mes = H.mesgs.slice(m0).filter(m => m.who === p.username).map(m => m.text);
    const anims = [...new Set(H.anims.slice(a0).filter(a => a.who === p.username).map(a => a.seq))];
    const inner = p.x === INNER.x && p.z === INNER.z;
    const xp = (p.stats[stat] - xp0) / 10;
    H.despawn(p);
    return { mes, anims, inner, xp };
}

console.log('ROCK (Mining)');
{
    const { p, stat } = player('mining', 99, GEN.rock);
    const r = attempt(p, stat);
    check('no pickaxe: refused', r.mes, ['You need a pickaxe for which you have the required Mining level to mine this rock.']);
    check('  no swing, still outside', [r.anims.length, r.inner], [0, false]);
}
{
    const { p, stat } = player('mining', 30, GEN.rock);
    H.give(p, 'rune_pickaxe');
    const r = attempt(p, stat);
    check('only a rune pickaxe at 30 Mining (rune needs 41): refused', r.mes, ['You need a pickaxe for which you have the required Mining level to mine this rock.']);
}
const TIERS: [string, string, number, 'inv' | 'worn'][] = [
    ['bronze_pickaxe', 'human_mining_bronze_pickaxe', 1, 'inv'],
    ['iron_pickaxe', 'human_mining_iron_pickaxe', 1, 'worn'],
    ['steel_pickaxe', 'human_mining_steel_pickaxe', 6, 'inv'],
    ['mithril_pickaxe', 'human_mining_mithril_pickaxe', 21, 'inv'],
    ['adamant_pickaxe', 'human_mining_adamant_pickaxe', 31, 'worn'],
    ['rune_pickaxe', 'human_mining_rune_pickaxe', 41, 'inv'],
    ['dragon_pickaxe', 'human_mining_dragon_pickaxe', 61, 'worn']
];
pinRoll(0); // every roll passes at any level: this part is about the tool
for (const [obj, anim, lvl, where] of TIERS) {
    const { p, stat } = player('mining', lvl, GEN.rock);
    if (where === 'worn') H.equip(p, { rhand: obj }); else H.give(p, obj);
    const r = attempt(p, stat);
    check(`${obj} (${where}) at ${lvl} Mining swings ${anim}`, r.anims.map(seqName), [anim]);
}
{
    const { p, stat } = player('mining', 40, GEN.rock);
    H.give(p, 'rune_pickaxe');
    H.give(p, 'bronze_pickaxe');
    const r = attempt(p, stat);
    check('rune + bronze at 40 Mining: the bronze is the one it can use', r.anims.map(seqName), ['human_mining_bronze_pickaxe']);
}
pinRoll(128);
{
    const { p, stat } = player('mining', 50, GEN.rock);
    H.give(p, 'bronze_pickaxe');
    const r = attempt(p, stat);
    check('roll 128, Mining 50: fails', r.mes, ['You attempt to mine your way through...', '...but fail to break-up the rock.']);
    check('  no xp, still outside', [r.xp, r.inner], [0, false]);
}
{
    const { p, stat } = player('mining', 51, GEN.rock);
    H.give(p, 'bronze_pickaxe');
    const r = attempt(p, stat);
    check('roll 128, Mining 51: through', r.mes, ['You attempt to mine your way through...', '...and manage to break through the rock.']);
    check('  25 xp, inside', [r.xp, r.inner], [25, true]);
}

console.log('TENDRILS (Woodcutting)');
pinRoll(0);
{
    const { p, stat } = player('woodcutting', 99, GEN.tendrils);
    const r = attempt(p, stat);
    check('no axe: refused', r.mes, ['You attempt to chop your way through...', 'You need an axe to chop through the tendrils.', 'You do not have an axe that you have the Woodcutting level to use.']);
    check('  no swing, still outside', [r.anims.length, r.inner], [0, false]);
}
const AXES: [string, string, number, 'inv' | 'worn'][] = [
    ['bronze_axe', 'human_woodcutting_bronze_axe', 1, 'inv'],
    ['iron_axe', 'human_woodcutting_iron_axe', 1, 'worn'],
    ['steel_axe', 'human_woodcutting_steel_axe', 6, 'inv'],
    ['black_axe', 'human_woodcutting_black_axe', 11, 'inv'],
    ['mithril_axe', 'human_woodcutting_mithril_axe', 21, 'worn'],
    ['adamant_axe', 'human_woodcutting_adamant_axe', 31, 'inv'],
    ['rune_axe', 'human_woodcutting_rune_axe', 41, 'worn'],
    ['dragon_axe', 'human_woodcutting_dragon_axe', 61, 'inv']
];
for (const [obj, anim, lvl, where] of AXES) {
    const { p, stat } = player('woodcutting', lvl, GEN.tendrils);
    if (where === 'worn') H.equip(p, { rhand: obj }); else H.give(p, obj);
    const r = attempt(p, stat);
    check(`${obj} (${where}) at ${lvl} Woodcutting swings ${anim}`, r.anims.map(seqName), [anim]);
}
{
    const { p, stat } = player('woodcutting', 40, GEN.tendrils);
    H.give(p, 'rune_axe');
    const r = attempt(p, stat);
    check('only a rune axe at 40 Woodcutting: refused', r.mes.slice(1), ['You need an axe to chop through the tendrils.', 'You do not have an axe that you have the Woodcutting level to use.']);
}
pinRoll(128);
{
    const { p, stat } = player('woodcutting', 50, GEN.tendrils);
    H.give(p, 'bronze_axe');
    const r = attempt(p, stat);
    check('roll 128, Woodcutting 50: fails', [r.mes.at(-1), r.xp, r.inner], ['...but fail to cut through the tendrils.', 0, false]);
}
{
    const { p, stat } = player('woodcutting', 51, GEN.tendrils);
    H.give(p, 'bronze_axe');
    const r = attempt(p, stat);
    check('roll 128, Woodcutting 51: through, 25 xp', [r.mes.at(-1), r.xp, r.inner], ['...and manage to cut a way through the tendrils.', 25, true]);
}

console.log('BOIL (Firemaking)');
{
    const { p, stat } = player('firemaking', 99, GEN.boil);
    const r = attempt(p, stat);
    check('no tinderbox: refused', [r.mes, r.inner], [['You attempt to set the blockade on fire...', "...but you don't have a tinderbox to burn it!"], false]);
}
{
    const { p, stat } = player('firemaking', 50, GEN.boil);
    H.give(p, 'tinderbox');
    const r = attempt(p, stat);
    check('roll 128, Firemaking 50: fails', [r.mes.at(-1), r.xp, r.inner], ['...but fail to burn it out of your way.', 0, false]);
}
{
    const { p, stat } = player('firemaking', 51, GEN.boil);
    H.give(p, 'tinderbox');
    const r = attempt(p, stat);
    check('roll 128, Firemaking 51: through, 25 xp', [r.mes.at(-1), r.xp, r.inner], ['...and manage to burn it down and get past.', 25, true]);
    check('  lighting anim', r.anims.map(seqName), ['human_createfire']);
}

console.log('EYES (Thieving)');
const EMOTES = new Set(['emote_yes', 'emote_no', 'emote_bow', 'emote_angry', 'emote_think', 'emote_wave', 'emote_shrug', 'emote_cheer', 'emote_beckon', 'emote_laugh', 'emote_jump_with_joy', 'emote_yawn', 'emote_dance', 'emote_dance_scottish', 'emote_dance_spin', 'emote_dance_headbang', 'emote_cry', 'emote_blow_kiss', 'emote_panic', 'emote_ya_boo_sucks', 'emote_clap', 'emote_fremmenik_salute', 'human_cave_goblin_bow', 'human_cave_goblin_dance', 'emote_glass_box', 'emote_climbing_rope', 'emote_mime_lean', 'emote_glass_wall', 'human_stamp', 'human_chicken_dance', 'zombie_walk_emote', 'zombie_dance', 'terrified_emote'].map(seq));
{
    const { p, stat } = player('thieving', 50, GEN.eyes);
    const r = attempt(p, stat);
    check('roll 128, Thieving 50: fails', [r.mes.at(-1), r.xp, r.inner], ['...but fail to distract them enough to get past.', 0, false]);
}
{
    const { p, stat } = player('thieving', 51, GEN.eyes);
    const r = attempt(p, stat);
    check('roll 128, Thieving 51: through, 25 xp', [r.mes.at(-1), r.xp, r.inner], ["...and sneak past while they're not looking.", 25, true]);
    check('  every anim is an Emotes-tab emote', r.anims.length > 0 && r.anims.every(a => EMOTES.has(a)), true);
}
// the emote is random: over many draws, more than the old five show up
pinRoll(null);
{
    const { p } = player('thieving', 99, GEN.eyes);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(H.runProc(p, '[proc,rcu_distract_eyes_rand_anim]')[0]);
    check('400 draws: only Emotes-tab emotes', [...seen].every(s => EMOTES.has(s)), true);
    check('  and all 33 of them come up', seen.size, 33);
    H.despawn(p);
}
pinRoll(128);

console.log('GAP (Agility)');
{
    const { p, stat } = player('agility', 50, GEN.gap);
    const r = attempt(p, stat);
    check('roll 128, Agility 50: fails', [r.mes.at(-1), r.xp, r.inner], ['...but you are not agile enough to get through the gap.', 0, false]);
}
{
    const { p, stat } = player('agility', 51, GEN.gap);
    const r = attempt(p, stat);
    check('roll 128, Agility 51: through, 25 xp', [r.mes.at(-1), r.xp, r.inner], ['...and you manage to crawl through.', 25, true]);
    check('  crawls', r.anims.map(seqName), ['viking_drop_to_knee', 'human_crawling']);
}

console.log('PASSAGE');
pinRoll(255);
{
    const { p, stat } = player('agility', 1, GEN.passage);
    const r = attempt(p, stat);
    check('level 1, worst roll: straight through, no xp', [r.inner, r.xp], [true, 0]);
}

console.log('A LEVEL 99 NEVER FAILS');
{
    const { p, stat } = player('mining', 99, GEN.rock);
    H.give(p, 'bronze_pickaxe');
    const r = attempt(p, stat);
    check('roll 255, Mining 99: through', r.inner, true);
}
{
    const { p, stat } = player('mining', 98, GEN.rock);
    H.give(p, 'bronze_pickaxe');
    const r = attempt(p, stat);
    check('roll 255, Mining 98: fails', r.inner, false);
}
pinRoll(null);

console.log('LAW RIFT');
// the rift is at 0_47_75_41_39 (3049,4839); it is reached from the tiles east of it
function law(items: (p: any) => void) {
    const p: any = H.makePlayer('law' + n++, 3051, 4838, 60 + n);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    items(p);
    const m0 = H.mesgs.length;
    H.opLoc(p, 3049, 4839, 'abyss_exit_to_law', 1);
    for (let t = 0; t < 20; t++) H.tick(1);
    const mes = H.mesgs.slice(m0).filter(m => m.who === p.username).map(m => m.text);
    const at = [p.x, p.z, p.level];
    H.despawn(p);
    return { mes, at };
}
const SARA = 'The power of Saradomin prevents you from taking armour or weaponry to Entrana.';
{
    const r = law(p => H.give(p, 'bronze_dagger'));
    check('a dagger in the pack: turned back, still in the Abyss', [r.mes, r.at[0] >= 3008 && r.at[0] < 3072], [[SARA], true]);
}
{
    const r = law(p => H.equip(p, { torso: 'bronze_platebody' }));
    check('a platebody worn: turned back', r.mes, [SARA]);
}
{
    const r = law(p => H.give(p, 'rune_pickaxe'));
    check('the pickaxe from the rocks counts too', r.mes, [SARA]);
}
{
    const r = law(p => { H.give(p, 'blankrune_high', 20); H.give(p, 'lobster'); });
    check('essence and food: through, to the Law altar (2464,4819)', [r.mes, r.at], [[], [2464, 4819, 0]]);
}
void World;

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
