// The Fremennik Trials as ported from PlagueCityRS 349, start to finish on the real engine and the
// real map, and the save migration from this server's old version.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_viking.ts [section...]
//
//   start      Brundt: the outerlander's questions, then "I want to become a Fremennik!" (stage 1)
//   swensen    his challenge, the ladder, the seven portals, a wrong portal and the escape rope,
//              the exit ladder (+1 vote)
//   manni      his contest; the council workman's strange object for a beer; the Poison Salesman's
//              low alcohol keg; lighting it and the pipe; the keg off the table; the swap; the win
//              (+1 vote); and the honest loss
//   sigli      the talisman, the butterfly and the Draugen, the essence, Sigli's vote (+1)
//   thorvald   the ladder's rules, Koschei's three revivals, the fourth form's honour death (+1),
//              and beating the fourth form outright (the sword)
//   peer       the challenge and the banking spell, the riddle lock, the whole house (bucket and
//              jug, the scales, the herring and the disks, the mural, the lid, the ice, the key),
//              out of the far door (+1)
//   olaf       the challenge, Lalli, Askeladden's rock, Lalli again, the stew, the fleece, the wool,
//              the tree, the knife both ways round, the Fossegrimen, the bouncer, the stage (+1)
//   sigmund    the whole chain of favours, 13 askings, Askeladden's 5,000 coins, 13 trades back,
//              Sigmund's vote (+1); losing the goods sends you back to the start
//   brundt     seven votes: the quest completes, 3 quest points, the XP, the Fremennik name
//   migrate    old-version saves at every representative state; a fresh player; twice is once
//   crabs      the rock crabs 349 keeps with this quest wake up and fight
import * as H from './harness.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import NpcType from '#/cache/config/NpcType.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import {
    R,
    check,
    errors,
    npcSays,
    bits,
    bit,
    stage,
    setStage,
    setBit,
    viking,
    at,
    player,
    drain,
    text,
    mesSince,
    has,
    talk,
    clickLoc,
    useOnLoc,
    useOnNpc,
    useHeld,
    held,
    opObj,
    npcsOf,
    until,
    done,
    BIT,
    runProtected,
    reachSet,
    walkable
} from './vikinglib.js';
void R;
void errors;
void npcSays;
void Component;
void setBit;
void text;

await H.boot();
H.loginOrder();

const argv = process.argv.slice(2);
const want = (s: string) => argv.length === 0 || argv.includes(s);

// region origins
const M41_57 = (x: number, z: number): [number, number] => [2624 + x, 3648 + z];
const M41_156 = (x: number, z: number): [number, number] => [2624 + x, 9984 + z];
const M43_56 = (x: number, z: number): [number, number] => [2752 + x, 3584 + z];

// the one player who plays the whole quest; later sections set up their own when run alone
let hero: Player | null = null;
function heroAt(x: number, z: number, votes: number): Player {
    if (!hero) {
        hero = player('frem_hero', x, z, 1 + votes);
        // the earlier trials, when a section is run on its own
        const done = ['swensen', 'reveller', 'sigli', 'thorvald', 'peer', 'olaf', 'sigmund'];
        const full: Record<string, number> = { swensen: 2, reveller: 2, sigli: 3, thorvald: 2, peer: 3, olaf: 7, sigmund: 15 };
        for (const t of done.slice(0, votes)) setStage(hero, t, full[t]);
    }
    hero.teleport(x, z, 0);
    H.tick(1);
    return hero;
}

// ===================================================================================== start
if (want('start')) {
    console.log('START  Brundt');
    const p = heroAt(...M41_57(34, 21), 0);
    H.setVar(p, 'viking', 0);
    let t = talk(p, 'viking_askelapen');
    check('Askeladden before the quest: "Talk to Brundt"', has(t, 'His names Brundt, buddy'), true);
    t = talk(p, 'viking_brundt', [1, 1, 1, 1]);
    check('Brundt: "What is this place?", then "Do you have any quests?", "Yes, I am interested.", "I want to become a Fremennik!"', [viking(p), has(t, 'twelve council members')], [1, true]);
    t = talk(p, 'viking_brundt');
    check('  and again: no votes yet, speak to the council', [viking(p), has(t, "I don't have any votes yet.")], [1, true]);
}

// ===================================================================================== swensen
if (want('swensen')) {
    console.log('SWENSEN  the maze');
    const p = heroAt(...M41_57(21, 11), 0);
    let t = clickLoc(p, ...M41_57(20, 9), 'vt_mazeladdertopentrance', 1);
    check('the ladder before his challenge: "Have you no manners"', [at(p)[2], has(t, 'Have you no manners')], [0, true]);
    t = talk(p, 'viking_hallifred', [1]);
    check('Swensen: his challenge, accepted', [stage(p, 'swensen'), has(t, 'most fiendish complexity')], [1, true]);
    clickLoc(p, ...M41_57(20, 9), 'vt_mazeladdertopentrance', 1);
    check('down the ladder into the first room', at(p), [...M41_156(7, 20), 0]);
    // a wrong portal, then the rope out
    const wrong = World.getLoc(...M41_156(10, 21), 0, LocType.getId('vt_mazeportal_wrong'));
    if (wrong) {
        clickLoc(p, wrong.x, wrong.z, 'vt_mazeportal_wrong', 1);
        check('a wrong portal: somewhere else in the maze', [p.z > 9984, p.x !== 2624 + 7 || p.z !== 9984 + 20], [true, true]);
    }
    p.teleport(...M41_156(7, 20), 0);
    H.tick(1);
    const rooms: [string, number, number, number, number][] = [
        ['vt_mazeportal_1', 7, 18, 18, 33],
        ['vt_mazeportal_2', 15, 31, 27, 20],
        ['vt_mazeportal_3', 32, 20, 43, 31],
        ['vt_mazeportal_4', 41, 34, 6, 44],
        ['vt_mazeportal_5', 6, 39, 29, 51],
        ['vt_mazeportal_6', 32, 53, 44, 42],
        ['vt_mazeportal_7', 42, 45, 41, 54]
    ];
    for (const [name, x, z, ex, ez] of rooms) {
        clickLoc(p, ...M41_156(x, z), name, 1);
        H.tick(2);
        check(`${name}: on into the next room`, at(p), [...M41_156(ex, ez), 0]);
    }
    const before = viking(p);
    t = clickLoc(p, ...M41_156(41, 53), 'vt_mazeladderexit', 1);
    check("out of the far side: Swensen's vote", [stage(p, 'swensen'), viking(p) - before, at(p)], [2, 1, [...M41_57(25, 13), 0]]);
    t = clickLoc(p, ...M41_57(20, 9), 'vt_mazeladdertopentrance', 1);
    check('  and no way back down', has(t, 'No way am I doing that maze again'), true);

    // every one of the twenty places a wrong portal can drop you (349's list) is open floor in a
    // dead-end room with a way out - a rope or a portal - on this server's map
    const DEAD: [number, number, number, number][] = [
        [9, 53, 8, 53],
        [18, 52, 18, 53],
        [7, 34, 7, 33],
        [7, 28, 7, 29],
        [32, 31, 31, 31],
        [37, 20, 38, 20],
        [7, 18, 7, 19],
        [21, 55, 20, 55],
        [3, 53, 4, 53],
        [29, 34, 29, 33],
        [33, 42, 32, 42],
        [43, 20, 42, 20],
        [18, 45, 18, 44],
        [27, 42, 28, 42],
        [18, 39, 18, 40],
        [15, 21, 16, 21],
        [4, 31, 5, 31],
        [21, 21, 20, 21],
        [26, 31, 27, 31]
    ];
    const outs = ['vt_mazeladderescapeladder', 'vt_mazeportal_wrong', 'vt_mazeladderentrance', 'vt_mazeportal_1', 'vt_mazeportal_2', 'vt_mazeportal_3', 'vt_mazeportal_4', 'vt_mazeportal_5', 'vt_mazeportal_6', 'vt_mazeportal_7'].map(n =>
        LocType.getId(n)
    );
    const bad: string[] = [];
    for (const [, , wx, wz] of DEAD) {
        const [ax, az] = M41_156(wx, wz);
        const reach = reachSet(0, ax, az, 8);
        let exit = false;
        for (const k of reach) {
            const [rx, rz] = k.split(',').map(Number);
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ])
                for (const id of outs) if (World.getLoc(rx + dx, rz + dz, 0, id)) exit = true;
        }
        if (!walkable(0, ax, az) || !exit) bad.push(`${wx},${wz}`);
    }
    check('the wrong portals: every landing is floor with a way out', bad, []);

    // the escape rope, for another player
    const e = player('frem_maze_rope', ...M41_156(7, 32), 1);
    setStage(e, 'swensen', 1);
    clickLoc(e, ...M41_156(7, 31), 'vt_mazeladderescapeladder', 1);
    check('the escape rope: back up into his house, no vote', [at(e), stage(e, 'swensen'), viking(e)], [[...M41_57(23, 10), 0], 1, 1]);
    H.despawn(e);
}

// ===================================================================================== manni
if (want('manni')) {
    console.log('MANNI  the drinking contest');
    const p = heroAt(...M41_57(36, 24), 1);
    let t = talk(p, 'viking_reveller_3', [1]);
    check('Manni: the contest, accepted', [stage(p, 'reveller'), has(t, 'a drinking contest!')], [1, true]);

    // the council workman at the bridge south of Rellekka
    p.teleport(2655, 3591, 0);
    H.tick(1);
    t = talk(p, 'vt_council_workmen', [1]);
    check('the workman: thirsty work', has(t, 'thirsty work'), true);
    H.give(p, 'beer');
    t = useOnNpc(p, 'vt_council_workmen', 'beer');
    check('a beer for the strange object', [H.invCount(p, 'beer'), H.invCount(p, 'viking_firecracker'), has(t, 'souvenir')], [0, 1, true]);

    // the Poison Salesman in Seers' Village
    p.teleport(2694, 3493, 0);
    H.tick(1);
    H.give(p, 'coins', 250);
    t = talk(p, 'poison_salesman', [2, 1]);
    check('the Poison Salesman: the sales pitch, and a low alcohol keg for 250', [H.invCount(p, 'viking_low_alcahol_beerkeg'), H.invCount(p, 'coins'), bit(p, BIT.poisonsalesman), has(t, "Peter Potter's Patented Party Potions")], [1, 0, 1, true]);

    // lighting it and the pipe
    H.give(p, 'tinderbox');
    useHeld(p, 'tinderbox', 'viking_firecracker');
    check('tinderbox on the strange object: lit', [H.invCount(p, 'viking_firecracker'), H.invCount(p, 'viking_firecracker_lit')], [0, 1]);
    p.teleport(...M41_57(38, 26), 0);
    H.tick(1);
    t = clickLoc(p, ...M41_57(39, 26), 'viking_pipe_end_longhall', 1);
    check('Put-inside the pipe', [H.invCount(p, 'viking_firecracker_lit'), bit(p, BIT.firecracker), has(t, 'perfect distraction')], [0, 1, true]);

    // the keg on the table
    p.teleport(...M41_57(36, 27), 0);
    H.tick(1);
    opObj(p, ...M41_57(36, 28), 'viking_beerkeg', 3);
    check('a keg of beer off the table', H.invCount(p, 'viking_beerkeg'), 1);
    useHeld(p, 'viking_beerkeg', 'viking_low_alcahol_beerkeg');
    check('the swap, under cover of the bang', [bit(p, BIT.lowalc), H.invCount(p, 'viking_low_alcahol_beerkeg'), H.invCount(p, 'viking_beerkeg')], [1, 0, 1]);
    const before = viking(p);
    t = talk(p, 'viking_reveller_3', [1]);
    check('the contest: Manni concedes, the vote', [stage(p, 'reveller'), viking(p) - before, bits(p) & 7, H.invCount(p, 'viking_beerkeg')], [2, 1, 0, 0]);
    t = talk(p, 'viking_reveller_3');
    check('  and he says so', has(t, "You're one mighty drinker"), true);

    // an honest contest, lost
    const l = player('frem_manni_lose', ...M41_57(36, 24), 1);
    setStage(l, 'reveller', 1);
    H.give(l, 'viking_beerkeg');
    t = talk(l, 'viking_reveller_3', [1]);
    check('drinking a real keg: you lose, and may try again', [stage(l, 'reveller'), viking(l), H.invCount(l, 'viking_beerkeg'), has(t, 'I canna drink another drop')], [1, 1, 0, true]);
    H.despawn(l);
}

// ===================================================================================== sigli
if (want('sigli')) {
    console.log('SIGLI  the Draugen');
    const p = heroAt(...M41_57(36, 6), 2);
    let t = talk(p, 'viking_sigli', [1, 1]);
    check('Sigli: the hunt, and the talisman', [stage(p, 'sigli'), H.invCount(p, 'viking_draugen_talisman_uncharged'), has(t, 'The Draugen')], [1, 1, true]);
    const m0 = H.mesgs.length;
    held(p, 'viking_draugen_talisman_uncharged', 1);
    check(
        'Locate: the talisman points the way',
        mesSince(p, m0).some(m => m.startsWith('The talisman guides you')),
        true
    );
    // walk up to the butterfly and Locate again - it can move on (a timer), so chase it
    let draugen = null as any;
    let appeared = false;
    for (let n = 0; n < 6 && !draugen && stage(p, 'sigli') === 1; n++) {
        const flies = npcsOf('viking_draugen_safe');
        const fly = flies.find(f => f.uid === H.getVar(p, 'draugen_butterfly_uid')) ?? flies[flies.length - 1];
        if (!fly) break;
        // it flutters about (a teleport lands on the next tick), so catch up with it, then Locate
        for (let c = 0; c < 20; c++) {
            p.teleport(fly.x + 1, fly.z, fly.level);
            H.tick(1);
            if (Math.max(Math.abs(p.x - fly.x), Math.abs(p.z - fly.z)) <= 2) break;
        }
        held(p, 'viking_draugen_talisman_uncharged', 1);
        draugen = npcsOf('viking_draugen').find(d => Math.abs(d.x - p.x) < 5 && Math.abs(d.z - p.z) < 5) ?? null;
        appeared ||= !!draugen || mesSince(p, m0).some(m => m.includes('The Draugen is here!'));
    }
    check('Locate beside the butterfly: the Draugen appears and attacks', appeared, true);
    if (draugen && draugen.isActive) {
        draugen.levels[3] = 1;
        H.attackNpc(p, draugen);
    }
    until(() => stage(p, 'sigli') === 2, 60);
    drain(p);
    check('the Draugen beaten: its essence in the talisman', [stage(p, 'sigli'), H.invCount(p, 'viking_draugen_talisman'), H.invCount(p, 'viking_draugen_talisman_uncharged'), npcsOf('viking_draugen').length], [2, 1, 0, 0]);
    p.teleport(...M41_57(36, 6), 0);
    H.tick(8);
    const before = viking(p);
    t = talk(p, 'viking_sigli');
    check('Sigli takes the talisman: his vote', [stage(p, 'sigli'), viking(p) - before, H.invCount(p, 'viking_draugen_talisman')], [3, 1, 0]);

    const l = player('frem_sigli_lost', ...M41_57(36, 6), 1);
    setStage(l, 'sigli', 2);
    t = talk(l, 'viking_sigli');
    check('the charged talisman lost: another, and hunt again', [stage(l, 'sigli'), H.invCount(l, 'viking_draugen_talisman_uncharged'), has(t, 'amateurish mistake')], [1, 1, true]);
    H.despawn(l);
}

// ===================================================================================== thorvald
function killForm(p: Player, form: string, next: string) {
    const k = npcsOf(form)
        .filter(n => n.level === p.level)
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    // With auto-retaliate on, the player's own counter-blows can finish a form while its revival line is
    // being clicked through - he is already the next one, which is what this is waiting for.
    if (!k) return npcsOf(next).some(n => n.level === p.level);
    k.levels[3] = 1;
    let ok = false;
    for (let i = 0; i < 400 && !ok; i++) {
        // A revival's line ("It seems you have some idea of combat...") waits for Continue, and nothing
        // swings until it is clicked; the player does that, so the sim must too (it passed or failed on
        // whether the pause landed before the next swing).
        if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) drain(p, [], 3);
        if (i % 8 === 0 && !(p as any).target) H.attackNpc(p, k); // a revival's dialogue stops your swing
        H.tick(1);
        ok = k.type === NpcType.getId(next);
    }
    drain(p);
    if (!ok)
        console.log(
            'killForm',
            form,
            k.type,
            k.isActive,
            k.levels[3],
            at(p),
            [k.x, k.z],
            (p as any).target?.constructor?.name,
            H.mesgs
                .filter(m => m.who === p.username)
                .slice(-5)
                .map(m => m.text),
            H.npcHits.slice(-5)
        );
    return ok;
}
if (want('thorvald')) {
    console.log('THORVALD  Koschei');
    const p = heroAt(...M41_57(42, 44), 3);
    let t = talk(p, 'viking_thorvald', [1]);
    check('Thorvald: his challenge, accepted', [stage(p, 'thorvald'), has(t, 'You must defeat him three times')], [1, true]);
    H.give(p, 'bronze_sword');
    t = clickLoc(p, ...M41_57(43, 46), 'viking_warrior_ladder', 2);
    check('a sword in the pack: not down the ladder', [p.level, has(t, 'You may not enter the battleground')], [0, true]);
    H.clearInv(p);
    H.give(p, 'lobster', 3);
    clickLoc(p, ...M41_57(43, 46), 'viking_warrior_ladder', 2);
    check('empty-handed but for food: down into the battleground', at(p), [2671, 10098, 2]);
    check(
        '  Koschei turns up',
        until(() => npcsOf('viking_enemy1').length > 0, 100),
        true
    );
    check('form one down: he gets up as form two', killForm(p, 'viking_enemy1', 'viking_enemy2'), true);
    check('form two down: form three', killForm(p, 'viking_enemy2', 'viking_enemy3'), true);
    p.levels[PlayerStat.PRAYER] = 10;
    const i3 = H.ifaces.length;
    const third = killForm(p, 'viking_enemy3', 'viking_enemy4');
    until(() => text(p, i3).includes('hold back no longer'), 30);
    drain(p);
    check('form three down: form four, and your prayer drained', [third, text(p, i3).includes('you lose your prayer'), p.levels[PlayerStat.PRAYER]], [true, true, 0]);
    // the fourth form: fight to the death - your own
    const k4 = npcsOf('viking_enemy4')
        .filter(n => n.level === 2)
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    p.levels[PlayerStat.HITPOINTS] = 1;
    const before = viking(p);
    H.attackNpc(p, k4);
    const got = until(() => stage(p, 'thorvald') === 2, 120);
    drain(p);
    check("the fourth form's last blow: the honour death, Thorvald's vote", [got, viking(p) - before, p.level, p.levels[PlayerStat.HITPOINTS] > 1, npcsOf('viking_enemy4').filter(n => n === k4).length], [true, 1, 1, true, 0]);
    check('  and no real death (items kept)', H.invCount(p, 'lobster'), 3);
    p.teleport(...M41_57(42, 44), 0);
    H.tick(1);
    t = clickLoc(p, ...M41_57(43, 46), 'viking_warrior_ladder', 2);
    check('  and afterwards: no going back down', [p.level, has(t, 'rather not go back down')], [0, true]);

    // beating form four outright
    const w = player('frem_koschei_win', 2672, 10098, 1, 2);
    setStage(w, 'thorvald', 1);
    w.enqueueScript(ScriptProvider.getByName('[queue,spawn_viking_enemy]')!, PlayerQueueType.NORMAL, 0, []);
    until(() => npcsOf('viking_enemy1').some(n => Math.abs(n.x - w.x) < 5), 20);
    killForm(w, 'viking_enemy1', 'viking_enemy2');
    killForm(w, 'viking_enemy2', 'viking_enemy3');
    killForm(w, 'viking_enemy3', 'viking_enemy4');
    const k = npcsOf('viking_enemy4')
        .filter(n => n.level === 2)
        .sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0];
    k.levels[3] = 1;
    H.attackNpc(w, k);
    until(() => stage(w, 'thorvald') === 2, 60);
    drain(w);
    check('the fourth form beaten: the vote and his blade', [stage(w, 'thorvald'), viking(w), H.invCount(w, 'viking_sword')], [2, 2, 1]);
    H.despawn(w);

    // dying to an earlier form is a safe death on this server
    const d = player('frem_koschei_die', 2672, 10098, 1, 2);
    setStage(d, 'thorvald', 1);
    H.give(d, 'lobster', 2);
    d.enqueueScript(ScriptProvider.getByName('[queue,spawn_viking_enemy]')!, PlayerQueueType.NORMAL, 0, []);
    until(() => npcsOf('viking_enemy1').some(n => Math.abs(n.x - d.x) < 5), 20);
    d.levels[PlayerStat.HITPOINTS] = 0;
    H.runProc(d, '[proc,player_die]');
    until(() => d.level === 0, 30);
    H.tick(5);
    check("killed by form one: back in Thorvald's hut, food kept, trial still on", [at(d), H.invCount(d, 'lobster'), stage(d, 'thorvald')], [[...M41_57(42, 46), 0], 2, 1]);
    H.despawn(d);
}

// ===================================================================================== peer
const RIDDLES = ['MIND', 'TREE', 'LIFE', 'FIRE', 'TIME', 'WIND'];
if (want('peer')) {
    console.log("PEER  the Seer's house");
    const p = heroAt(...M41_57(10, 21), 4);
    H.give(p, 'coins', 100);
    H.equip(p, { hat: 'bronze_med_helm' });
    let t = talk(p, 'viking_peer', [1, 1]);
    check('Peer: the challenge, and the banking spell', [stage(p, 'peer'), H.invCount(p, 'coins'), wornCount(p), has(t, 'The task is done')], [1, 0, 0, true]);
    check('  everything carried and worn is in the bank', [bankCount(p, 'coins') >= 100, bankCount(p, 'bronze_med_helm') >= 1], [true, true]);
    const riddle = (bits(p) >>> 3) & 7;
    // the riddle lock on the front door
    t = clickLoc(p, ...M41_57(7, 19), 'viking_seers_door1', 1, [1]);
    check('the front door: a combination lock with a riddle', has(t, 'metal plaque with a riddle'), true);
    H.tick(2);
    // set the four wheels, then open
    const word = RIDDLES[riddle];
    for (let i = 0; i < 4; i++) {
        const n = word.charCodeAt(i) - 65;
        for (let c = 0; c < n; c++) H.ifButton(p, `inter_200:com_${48 + i * 2}`);
    }
    H.ifButton(p, 'inter_200:com_57');
    H.tick(1);
    check(`the answer, ${word}: the riddle solved`, stage(p, 'peer'), 2);
    clickLoc(p, ...M41_57(7, 19), 'viking_seers_door1', 1);
    check('in through the front door, carrying nothing', p.z < 3667, true);
    // up the west ladder
    clickLoc(p, ...M41_57(7, 15), 'viking_seer_up_ladder', 1);
    check('up the west ladder', p.level, 2);
    clickLoc(p, ...M41_57(5, 12), 'viking_cupboardhigh', 1);
    clickLoc(p, ...M41_57(5, 12), 'viking_cupboardopen_high', 2);
    check('the cupboard: a bucket marked 5', H.invCount(p, 'viking_bucket_empty'), 1);
    clickLoc(p, ...M41_57(11, 12), 'viking_seer_chest_closed', 1);
    clickLoc(p, ...M41_57(11, 12), 'viking_seer_chest_open', 2);
    check('the chest: a jug marked 3', H.invCount(p, 'viking_jug_empty'), 1);
    // 5 and 3 make 4
    useOnLoc(p, ...M41_57(5, 13), 'viking_seers_tap', 'viking_bucket_empty');
    useHeld(p, 'viking_bucket_5', 'viking_jug_empty');
    check('fill the bucket, pour it into the jug', [H.invCount(p, 'viking_bucket_2'), H.invCount(p, 'viking_jug_3')], [1, 1]);
    useOnLoc(p, ...M41_57(5, 14), 'viking_seers_drain', 'viking_jug_3');
    useHeld(p, 'viking_bucket_2', 'viking_jug_empty');
    check('empty the jug, pour the 2 across', [H.invCount(p, 'viking_bucket_empty'), H.invCount(p, 'viking_jug_2')], [1, 1]);
    useOnLoc(p, ...M41_57(5, 13), 'viking_seers_tap', 'viking_bucket_empty');
    useHeld(p, 'viking_bucket_5', 'viking_jug_2');
    check('fill the bucket again and top the jug up: 4 left', [H.invCount(p, 'viking_bucket_4'), H.invCount(p, 'viking_jug_3')], [1, 1]);
    useOnLoc(p, ...M41_57(8, 17), 'viking_seer_chest_closed_scales', 'viking_bucket_4');
    check('the 4 on the scales: the vase', [H.invCount(p, 'viking_airtight_vase'), bit(p, BIT.chest)], [1, 1]);
    useOnLoc(p, ...M41_57(5, 13), 'viking_seers_tap', 'viking_airtight_vase');
    check('water in the vase', H.invCount(p, 'viking_airtight_vase_water'), 1);
    // the disks
    clickLoc(p, ...M41_57(8, 12), 'viking_unimountedhead', 1);
    clickLoc(p, ...M41_57(10, 12), 'viking_bullmountedhead', 1);
    check("the unicorn's eye is a red disk, the bull's a wooden one", [H.invCount(p, 'viking_red_wooden_coin'), H.invCount(p, 'viking_uncoloured_wooden_coin')], [1, 1]);
    clickLoc(p, ...M41_57(10, 17), 'viking_seer_bookcase', 1);
    check('behind the books: a red herring', H.invCount(p, 'viking_red_herring'), 1);
    useOnLoc(p, ...M41_57(5, 15), 'viking_seer_range', 'viking_red_herring');
    check('cooked on the range: a herring and red goop', [H.invCount(p, 'herring'), H.invCount(p, 'viking_red_splat')], [1, 1]);
    useHeld(p, 'viking_red_splat', 'viking_uncoloured_wooden_coin');
    check('the goop on the wooden disk: two red disks', H.invCount(p, 'viking_red_wooden_coin'), 2);
    // down the east trapdoor to the mural
    clickLoc(p, ...M41_57(12, 15), 'viking_seer_trapdoor_closed', 1);
    clickLoc(p, ...M41_57(12, 15), 'viking_seer_trapdoor_open', 1);
    check('through the east trapdoor', p.level, 0);
    useOnLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 'viking_red_wooden_coin');
    useOnLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 'viking_red_wooden_coin');
    check('both disks in the mural: the lid falls out', [bit(p, BIT.reddisk1), bit(p, BIT.reddisk2), H.invCount(p, 'viking_vase_lid')], [1, 1, 1]);
    useHeld(p, 'viking_vase_lid', 'viking_airtight_vase_water');
    check('the lid screwed on', H.invCount(p, 'viking_airtight_vase_with_lid_water'), 1);
    clickLoc(p, ...M41_57(12, 15), 'viking_seer_down_ladder', 1);
    useOnLoc(p, ...M41_57(14, 17), 'viking_small_table_frozen', 'viking_airtight_vase_with_lid_water');
    check('the frozen table: the vase shatters, a key in ice', H.invCount(p, 'viking_key_in_ice'), 1);
    useOnLoc(p, ...M41_57(5, 15), 'viking_seer_range', 'viking_key_in_ice');
    check('the range melts the ice: the key', H.invCount(p, 'viking_key'), 1);
    clickLoc(p, ...M41_57(7, 15), 'viking_seer_trapdoor_open', 1);
    p.teleport(...M41_57(12, 18), 0);
    H.tick(1);
    const before = viking(p);
    t = clickLoc(p, ...M41_57(12, 19), 'viking_seers_door2', 1);
    check(
        "out of the far door with the key: Peer's vote, the house's things left behind",
        [stage(p, 'peer'), viking(p) - before, p.z >= 3667, H.invCount(p, 'viking_key'), H.invCount(p, 'viking_bucket_empty') + H.invCount(p, 'viking_jug_3')],
        [3, 1, true, 0, 0]
    );
    // get the bank back for the later trials
    H.clearInv(p);
}

// ===================================================================================== olaf
if (want('olaf')) {
    console.log('OLAF  the lyre');
    const p = heroAt(...M41_57(48, 35), 5);
    let t = talk(p, 'viking_olaf', [1]);
    check('Olaf: his challenge, accepted', [stage(p, 'olaf'), has(t, 'impress the revellers')], [1, true]);
    t = talk(p, 'viking_olaf', [4]);
    check('  and how: the tree, the troll, the Fossegrimen, the stage', [bit(p, BIT.learnedOlaf), has(t, 'unusually musical tree'), has(t, 'raw shark, manta ray, or sea turtle')], [1, true, true]);
    t = talk(p, 'viking_lalli_troll', [1]);
    check('Lalli: "Other human?" - Askeladden', [stage(p, 'olaf'), has(t, 'Human call itself Askeladden')], [2, true]);
    t = talk(p, 'viking_askelapen');
    check('Askeladden: the pet rock', [stage(p, 'olaf'), H.invCount(p, 'vt_useless_rock'), has(t, 'A pet ROCK!')], [3, 1, true]);
    t = talk(p, 'viking_lalli_troll');
    check('Lalli will not take a second rock: the soup plan', [stage(p, 'olaf'), has(t, 'an onion, a potato and a cabbage')], [4, true]);
    for (const o of ['cabbage', 'potato', 'onion']) H.give(p, o);
    const [cx, cz] = M43_56(20, 39);
    for (const o of ['vt_useless_rock', 'cabbage', 'potato', 'onion']) useOnLoc(p, cx, cz, 'viking_troll_cauldron', o);
    check('the rock, a cabbage, a potato and an onion in his stew', [bit(p, BIT.rock), bit(p, BIT.cabbage), bit(p, BIT.potato), bit(p, BIT.onion), stage(p, 'olaf')], [1, 1, 1, 1, 5]);
    t = talk(p, 'viking_lalli_troll');
    check('Lalli: the golden fleece for his stone soup', [H.invCount(p, 'viking_golden_fleece'), has(t, 'soup-making stone')], [1, true]);

    // the Rellekka wheel is for Fremenniks; the one in Seers' Village is not
    p.teleport(2617, 3660, 0);
    H.tick(1);
    t = useOnLoc(p, 2617, 3659, 'viking_spinningwheel', 'viking_golden_fleece');
    check('the Rellekka wheel: "Only Fremenniks may use this spinning wheel."', [H.invCount(p, 'viking_golden_fleece'), mesSince(p, H.mesgs.length - 3).some(m => m.includes('Only Fremenniks'))], [1, true]);
    p.teleport(2710, 3472, 1);
    H.tick(1);
    useOnLoc(p, 2710, 3471, 'spinningwheel', 'viking_golden_fleece');
    check('any other wheel: golden wool', [H.invCount(p, 'viking_golden_fleece'), H.invCount(p, 'viking_golden_wool')], [0, 1]);

    // the tree and the knife, both ways round
    H.give(p, 'rune_axe');
    H.give(p, 'knife');
    p.teleport(2737, 3637, 0);
    H.tick(1);
    clickLoc(p, 2738, 3638, 'viking_musical_tree', 1);
    clickLoc(p, 2738, 3638, 'viking_musical_tree', 1);
    check('two branches from the strangely musical tree', H.invCount(p, 'viking_musical_tree_branch'), 2);
    useHeld(p, 'knife', 'viking_musical_tree_branch');
    check('knife on branch: an unstrung lyre', H.invCount(p, 'viking_unstrung_lyre'), 1);
    useHeld(p, 'viking_musical_tree_branch', 'knife');
    check('branch on knife: the same', [H.invCount(p, 'viking_unstrung_lyre'), H.invCount(p, 'viking_musical_tree_branch')], [2, 0]);
    useHeld(p, 'viking_golden_wool', 'viking_unstrung_lyre');
    check('golden wool on the lyre: strung', [H.invCount(p, 'viking_strung_lyre'), H.invCount(p, 'viking_golden_wool')], [1, 0]);

    // the Fossegrimen
    H.give(p, 'raw_lobster');
    H.give(p, 'raw_shark');
    p.teleport(2627, 3599, 0);
    H.tick(1);
    useOnLoc(p, 2626, 3598, 'viking_lake_shrine_altar', 'raw_lobster');
    check('a lobster is not offering enough', [H.invCount(p, 'viking_strung_lyre'), H.invCount(p, 'raw_lobster')], [1, 1]);
    t = useOnLoc(p, 2626, 3598, 'viking_lake_shrine_altar', 'raw_shark');
    check('a raw shark: the Fossegrimen enchants the lyre', [H.invCount(p, 'viking_enchanted_strung_lyre'), H.invCount(p, 'viking_strung_lyre'), H.invCount(p, 'raw_shark'), npcsOf('viking_lake_spirit').length > 0], [1, 0, 0, true]);

    // the bouncer, the stage
    p.teleport(...M41_57(44, 35), 0);
    H.tick(1);
    t = clickLoc(p, ...M41_57(43, 35), 'viking_bard_backstage_door', 1);
    check('the backstage door: the bouncer lets a bard through', [p.x <= 2624 + 42, has(t, 'some kind of outerlander bard')], [true, true]);
    p.teleport(...M41_57(36, 36), 0);
    H.tick(1);
    const before = viking(p);
    held(p, 'viking_enchanted_strung_lyre', 1);
    until(() => stage(p, 'olaf') === 7, 40);
    drain(p);
    check("on the stage: the epic, and Olaf's vote; the lyre is plain again", [stage(p, 'olaf'), viking(p) - before, H.invCount(p, 'viking_enchanted_strung_lyre'), H.invCount(p, 'viking_strung_lyre'), bits(p) >>> 27], [7, 1, 0, 1, 0]);
    check('  four lines sung', H.says.filter(x => x.who === p.username).length >= 4, true);
    p.teleport(...M41_57(42, 35), 0);
    H.tick(1);
    clickLoc(p, ...M41_57(43, 35), 'viking_bard_backstage_door', 1);
    check('and out of the backstage door afterwards', p.x >= 2624 + 43, true);
    t = clickLoc(p, ...M41_57(43, 35), 'viking_bard_backstage_door', 1);
    check('  where the bouncer will not have you back', [p.x >= 2624 + 43, has(t, 'I was paid well')], [true, true]);
}

// ===================================================================================== sigmund
if (want('sigmund')) {
    console.log('SIGMUND  the chain of favours');
    const p = heroAt(...M41_57(17, 31), 6);
    let t = talk(p, 'viking_sigmund', [1]);
    check('Sigmund: a rare flower', [stage(p, 'sigmund'), has(t, 'extremely rare flower')], [1, true]);
    t = talk(p, 'viking_sigmund');
    check('  and no hint where', has(t, 'ask around the other Fremennik'), true);
    // the askings: [npc, what they tell you]
    const asks: [string, string][] = [
        ['viking_sailor', 'a romantic ballad'],
        ['viking_olaf', 'sturdy boots'],
        ['viking_clothing_shopkeeper', 'reduce the sales tax'],
        ['viking_brundt', 'Speak to Sigli then'],
        ['viking_sigli', 'custom bowstring'],
        ['viking_weapons_salesman', 'You get me that fish'],
        ['viking_fisherman1', 'secret map of the best fishing spots'],
        ['viking_hallifred', 'weather forecast from our Seer'],
        ['viking_peer', 'I require a bodyguard'],
        ['viking_thorvald', "Champions' Token"],
        ['viking_reveller_3', 'legendary cocktail'],
        ['viking_longhall_barkeep', 'NEVER EVER EVER']
    ];
    t = talk(p, 'viking_olaf', [1]);
    check('a bystander before their turn: no idea', [stage(p, 'sigmund'), has(t, "I'm sorry, no I don't.")], [1, true]);
    let n = 1;
    for (const [npc, line] of asks) {
        t = talk(p, npc, [1]);
        n++;
        check(`asking ${npc}: ${line}`, [stage(p, 'sigmund'), has(t, line)], [n, true]);
    }
    H.give(p, 'coins', 5000);
    t = talk(p, 'viking_askelapen', [1, 1]);
    check('Askeladden: his promise for 5,000 coins', [stage(p, 'sigmund'), H.invCount(p, 'viking_promissary_note2'), H.invCount(p, 'coins')], [13, 1, 0]);
    // and every trade back
    const trades: [string, string, string][] = [
        ['viking_longhall_barkeep', 'viking_promissary_note2', 'viking_legendary_cocktail'],
        ['viking_reveller_3', 'viking_legendary_cocktail', 'viking_champion_token'],
        ['viking_thorvald', 'viking_champion_token', 'viking_promissary_note3'],
        ['viking_peer', 'viking_promissary_note3', 'viking_weather_forecast'],
        ['viking_hallifred', 'viking_weather_forecast', 'viking_another_map'],
        ['viking_fisherman1', 'viking_another_map', 'viking_unique_fish'],
        ['viking_weapons_salesman', 'viking_unique_fish', 'viking_bowstring'],
        ['viking_sigli', 'viking_bowstring', 'viking_map_to_hunting_grounds'],
        ['viking_brundt', 'viking_map_to_hunting_grounds', 'viking_promissary_note'],
        ['viking_clothing_shopkeeper', 'viking_promissary_note', 'viking_new_boots'],
        ['viking_olaf', 'viking_new_boots', 'viking_song'],
        ['viking_sailor', 'viking_song', 'viking_rare_flower']
    ];
    for (const [npc, give, get] of trades) {
        talk(p, npc, [1]);
        check(`${npc}: ${give} for ${get}`, [H.invCount(p, give), H.invCount(p, get)], [0, 1]);
    }
    const before = viking(p);
    t = talk(p, 'viking_sigmund');
    check('the flower to Sigmund: his vote', [stage(p, 'sigmund'), viking(p) - before, H.invCount(p, 'viking_rare_flower')], [15, 1, 0]);

    // the goods lost on the way back
    const l = player('frem_sigmund_lost', ...M41_57(17, 31), 1);
    setStage(l, 'sigmund', 13);
    t = talk(l, 'viking_sigmund');
    check('the goods lost: start again at the beginning', [stage(l, 'sigmund'), has(t, 'start again at the beginning')], [1, true]);
    H.despawn(l);
}

// ===================================================================================== brundt
if (want('brundt')) {
    console.log('BRUNDT  seven votes');
    const p = heroAt(...M41_57(34, 21), 7);
    const qp = H.getVar(p, 'qp');
    const xp = p.stats[0];
    const from = H.ifaces.length;
    const t = talk(p, 'viking_brundt');
    H.tick(3);
    p.closeModal(); // the reward scroll; the name comes after it
    H.tick(2);
    drain(p);
    check('seven votes: Brundt welcomes you, the quest is complete', [viking(p), has(t, 'seven members of the council')], [10, true]);
    check('  3 quest points', H.getVar(p, 'qp') - qp, 3);
    check('  2,812.4 XP in attack (and nine more)', p.stats[0] - xp, 28124);
    const name = H.runProc(p, '[proc,viking_fremennik_name]');
    void name;
    check('  and a new Fremennik name', text(p, from).includes('You will now be called'), true);
    const t2 = talk(p, 'viking_brundt', [4, 4]);
    check('Brundt afterwards: brother or sister, and the history', has(t2, 'Hello again'), true);
    const j = journal(p);
    check('the journal: QUEST COMPLETE, and the name', [j.includes('QUEST COMPLETE!'), j.includes('They also gave me a new name')], [true, true]);
}

function journal(p: Player) {
    const from = H.ifaces.length;
    H.ifButton(p, 'questlist:viking');
    H.tick(1);
    return text(p, from);
}

// ===================================================================================== journal
if (want('journal')) {
    console.log('JOURNAL');
    const p = player('frem_journal', ...M41_57(34, 21), 0);
    check('not started: Chieftain Brundt', journal(p).includes('Chieftain Brundt'), true);
    H.setVar(p, 'viking', 4);
    setStage(p, 'swensen', 2);
    setStage(p, 'reveller', 2);
    setStage(p, 'sigli', 3);
    setStage(p, 'olaf', 1);
    const j = journal(p);
    check("three votes, the Bard's trial on", [j.includes('three'), j.includes("I now have the Navigator's vote"), j.includes('a lyre')], [true, true, true]);
    H.despawn(p);
}

// ===================================================================================== migrate
if (want('migrate')) {
    console.log('MIGRATE  old saves');
    const OLD = {
        manni: 0,
        sigli: 1,
        olaf: 2,
        sigmund: 3,
        thorvald: 4,
        peer: 5,
        talisman: 6,
        slain: 7,
        beaten: 12,
        planted: 13,
        olafAsked: 14,
        thorvaldAsked: 15,
        kLo: 16,
        maze: 18,
        mLo: 19,
        riddle: 24,
        askRock: 25,
        lalliRock: 26,
        swensen: 27,
        potato: 28,
        cabbage: 29,
        onion: 30
    };
    const old = (...ns: number[]) => ns.reduce((v, n) => v | (1 << n), 0);
    const migrate = (name: string, vik: number, b: number, setup?: (p: Player) => void, x = 2659, z = 3669, level = 0) => {
        const p = player(name, x, z, vik, level);
        H.setVar(p, 'viking_bits', b);
        H.setVarBit(p, 'port349_viking', 0);
        setup?.(p);
        runProtected(p, '[proc,port349_migrate_viking]');
        H.tick(1);
        return p;
    };
    const all = (p: Player) => ['swensen', 'reveller', 'sigli', 'thorvald', 'peer', 'olaf', 'sigmund'].map(t => stage(p, t));

    const f = migrate('mig_fresh', 0, 0);
    check('a fresh player: untouched, marked done', [viking(f), bits(f), H.getVarBit(f, 'port349_viking')], [0, 0, 1]);

    const c = migrate('mig_done', 10, old(0, 1, 2, 3, 4, 5, 27));
    check('complete: complete, every trial at its end, a name', [viking(c), all(c), bits(c) >>> 27], [10, [2, 2, 3, 2, 3, 7, 15], 0]);
    const cName = H.getVar(c, 'viking_name');
    runProtected(c, '[proc,port349_migrate_viking]');
    check('  twice is once (the name is kept)', [viking(c), H.getVar(c, 'viking_name')], [10, cName]);
    H.setVarBit(c, 'port349_viking', 0);
    runProtected(c, '[proc,port349_migrate_viking]');
    check('  and even re-run from scratch it stays complete', [viking(c), all(c)], [10, [2, 2, 3, 2, 3, 7, 15]]);

    const s = migrate('mig_started', 1, 0);
    check('started, nothing done: stage 1, no trial begun', [viking(s), bits(s)], [1, 0]);

    const v4 = migrate('mig_four', 1, old(OLD.manni, OLD.sigli, OLD.swensen, OLD.peer));
    check('four old votes (Manni, Sigli, Swensen, Peer): %viking 5 and those four complete', [viking(v4), all(v4)], [5, [2, 2, 3, 0, 3, 0, 0]]);

    const seven = migrate('mig_seven', 1, old(0, 1, 2, 3, 4, 5, 27) | (27 << OLD.mLo));
    check('all seven votes, Brundt not yet seen: %viking 8', [viking(seven), all(seven)], [8, [2, 2, 3, 2, 3, 7, 15]]);
    const t7 = talk(seven, 'viking_brundt');
    H.tick(3);
    drain(seven);
    check('  and Brundt finishes it', [viking(seven), has(t7, 'seven members of the council')], [10, true]);

    const m1 = migrate('mig_manni', 1, old(OLD.beaten, OLD.planted));
    check('Manni: lost the first contest, object in the pipe -> contest set up, pipe primed', [stage(m1, 'reveller'), bit(m1, BIT.firecracker)], [1, 1]);
    const s1 = migrate('mig_sigli_slain', 1, old(OLD.talisman, OLD.slain), p => H.give(p, 'viking_draugen_talisman'));
    check('Sigli: the Draugen slain -> defeated_draugen, and he takes the talisman', stage(s1, 'sigli'), 2);
    const tS = talk(s1, 'viking_sigli');
    check('  -> his vote', [stage(s1, 'sigli'), viking(s1)], [3, 2]);
    void tS;
    const s2 = migrate('mig_sigli_hunt', 1, old(OLD.talisman) | (5 << 8) | (1 << 11));
    check('Sigli: mid-hunt -> started (the hunt begins afresh)', [stage(s2, 'sigli'), bits(s2)], [1, 1 << 14]);

    const o1 = migrate('mig_olaf_asked', 1, old(OLD.olafAsked));
    check('Olaf: asked -> started, he explains again', [stage(o1, 'olaf'), bit(o1, BIT.learnedOlaf)], [1, 0]);
    const o2 = migrate('mig_olaf_rock', 1, old(OLD.olafAsked, OLD.askRock));
    check('Olaf: the rock from Askeladden -> spoken_askelapen', stage(o2, 'olaf'), 3);
    const o3 = migrate('mig_olaf_part', 1, old(OLD.olafAsked, OLD.askRock, OLD.lalliRock, OLD.potato));
    check('Olaf: rock and potato in the stew -> spoken_lalli2, those two kept', [stage(o3, 'olaf'), bit(o3, BIT.rock), bit(o3, BIT.potato), bit(o3, BIT.cabbage)], [4, 1, 1, 0]);
    const o4 = migrate('mig_olaf_stew', 1, old(OLD.olafAsked, OLD.askRock, OLD.lalliRock, OLD.potato, OLD.cabbage, OLD.onion));
    check('Olaf: the whole stew -> made_stew', stage(o4, 'olaf'), 5);
    const tL = talk(o4, 'viking_lalli_troll');
    check('  and Lalli hands over the fleece', [H.invCount(o4, 'viking_golden_fleece'), has(tL, 'soup-making stone')], [1, true]);

    const g1 = migrate('mig_sig_ask', 1, 7 << OLD.mLo);
    check('Sigmund: old step 7 (asking the fisherman) -> spoke_skul (7)', stage(g1, 'sigmund'), 7);
    const g2 = migrate('mig_sig_back', 1, 20 << OLD.mLo, p => H.give(p, 'viking_unique_fish'));
    check('Sigmund: old step 20 holding the fish -> spoke_thora (13), fish kept', [stage(g2, 'sigmund'), H.invCount(g2, 'viking_unique_fish')], [13, 1]);
    talk(g2, 'viking_weapons_salesman', [1]);
    check('  and Skulgrimen trades it on', H.invCount(g2, 'viking_bowstring'), 1);
    const g3 = migrate('mig_sig_older', 1, 17 << OLD.mLo, p => H.give(p, 'viking_champion_token'));
    check('Sigmund: old step 17 with the pre-rewrite champions token -> the contract (~viking_merchant_migrate)', [stage(g3, 'sigmund'), H.invCount(g3, 'viking_promissary_note3'), H.invCount(g3, 'viking_champion_token')], [13, 1, 0]);
    const g4 = migrate('mig_sig_14', 1, 14 << OLD.mLo, p => H.give(p, 'viking_promissary_note'));
    check('Sigmund: old step 14 with the fiscal statement Askeladden used to give -> his promise', [H.invCount(g4, 'viking_promissary_note2'), H.invCount(g4, 'viking_promissary_note')], [1, 0]);

    const w1 = migrate('mig_maze_done', 1, old(OLD.maze));
    check('Swensen: through the maze, vote not yet claimed -> complete (+1)', [stage(w1, 'swensen'), viking(w1)], [2, 2]);
    const w2 = migrate('mig_in_maze', 1, 0, undefined, 2631, 10004, 0);
    check('Swensen: standing in the maze -> started, so the exit counts', stage(w2, 'swensen'), 1);

    const k1 = migrate('mig_kosch3', 1, old(OLD.thorvaldAsked) | (3 << OLD.kLo));
    check('Thorvald: three forms down, vote not claimed -> complete (+1)', [stage(k1, 'thorvald'), viking(k1)], [2, 2]);
    const k2 = migrate('mig_kosch1', 1, old(OLD.thorvaldAsked) | (1 << OLD.kLo));
    check('Thorvald: one form down -> started (Koschei from the start)', [stage(k2, 'thorvald'), viking(k2)], [1, 1]);

    const r1 = migrate('mig_riddle', 1, old(OLD.riddle), p => H.give(p, 'viking_dummy_coin'));
    check("Peer: riddle answered -> completed_riddle, a riddle set, the old red disk -> 349's", [stage(r1, 'peer'), H.invCount(r1, 'viking_red_wooden_coin'), H.invCount(r1, 'viking_dummy_coin')], [2, 1, 0]);

    const pen = migrate('mig_pen', 1, old(OLD.olafAsked, OLD.lalliRock), undefined, 2765, 3606, 0);
    check('left in the golden sheep pen by the old version: set down outside', [pen.x, pen.z], [2770, 3622]);

    for (const q of [f, c, s, v4, seven, m1, s1, s2, o1, o2, o3, o4, g1, g2, g3, g4, w1, w2, k1, k2, r1, pen]) H.despawn(q);
}

// ===================================================================================== crabs
if (want('crabs')) {
    console.log('ROCK CRABS  (349 keeps them with this quest)');
    const rocks = npcsOf('horror_rockcrab_inactive').filter(n => n.x >= 2624 && n.x < 2752 && n.z >= 3712 && n.z < 3776);
    check('rock crabs lie on the shore north of Rellekka', rocks.length > 0, true);
    if (rocks.length) {
        const r = rocks[0];
        const c = player('frem_crab', r.x + 1, r.z, 0);
        c.levels[3] = 99;
        // what its aggressive hunt does when it spots you (a sim player has no client, so the
        // engine's player hunt - which needs an observer - never runs here)
        H.setNpcMode(r, 'APPLAYER2', c);
        const woke = until(() => r.type === NpcType.getId('horror_rockcrab'), 40);
        until(() => H.hitsFor(c.username).length > 0, 40);
        check('step beside one: the rocks get up and attack', [woke, H.hitsFor(c.username).length > 0], [true, true]);
        H.despawn(c);
    }
}

function bankCount(p: Player, objName: string) {
    const inv = p.getInventory(InvType.getId('bank'));
    const id = ObjType.getId(objName);
    if (!inv) return -1;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o && o.id === id) n += o.count;
    }
    return n;
}
function wornCount(p: Player) {
    const inv = p.getInventory(InvType.getId('worn'))!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)) n++;
    return n;
}

done();
