// A GAME OF SKULLBALL, played to the whistle.
//
// Ten goals in a fixed order on the field behind the werewolf trapdoor. The order is the one thing
// neither the cache nor the wiki states outright - the cache places thirty loc pieces in ten
// threes and says nothing about sequence, and the wiki gives a route of moves rather than
// coordinates. The order in skullball.constant was derived by walking that route and seeing which
// goal each leg passes through, so the strongest test of it is to play the route and watch all ten
// score in turn.
//
// The ball is struck from whichever side the player stands on, so each shot here puts the player
// on the far side of the ball from where it should go and then clicks it.
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import { getExpByLevel } from '#/engine/entity/Player.js';

await H.boot();

const AGILITY = 16;

const K: Record<string, number> = {};
const C: Record<string, [number, number, number]> = {};
for (const line of readFileSync('../content/scripts/minigames/game_skullball/configs/skullball.constant', 'utf8').split(/\r?\n/)) {
    let m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
    if (m) {
        C[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
        continue;
    }
    m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line);
    if (m) K[m[1]] = Number(m[2]);
}

const GOALS = Number(K.skullball_goals_total);
const progress = VarPlayerType.getByName('skullball_goals')!.id;

function setAgility(p: any, level: number) {
    p.stats[AGILITY] = level <= 1 ? 0 : getExpByLevel(level);
    p.baseLevels[AGILITY] = level;
    p.levels[AGILITY] = level;
}

const ball = () => H.npcNear('waa_skullball', 3560, 9890, 0);

/** Every skullball in the world, so a trace that follows the wrong one is visible. */
function allBalls(): string[] {
    const id = NpcType.getId('waa_skullball');
    const out: string[] = [];
    for (const n of World.npcs) {
        if (n && n.type === id) out.push(n.x + ',' + n.z);
    }
    return out;
}

/** Stand on the far side of the ball from `dir` and hit it with `op`. */
function strike(p: any, dir: 'n' | 's' | 'e' | 'w', op: number) {
    const b = ball();
    if (!b) return false;
    const behind: Record<string, [number, number]> = { n: [0, -1], s: [0, 1], e: [-1, 0], w: [1, 0] };
    const [dx, dz] = behind[dir];
    // PRIMITIVES, NOT THE LIVE NPC. npcNear hands back the Npc itself, so reading b.x after the op
    // reports where the ball ENDED for both halves of a before/after line.
    const bx = b.x;
    const bz = b.z;
    p.teleport(bx + dx, bz + dz, 0);
    H.tick(1);
    H.opNpc(p, b, op);
    // ENOUGH TICKS FOR THE STRIKE TO LAND. Four was not: the interaction resolves over a tick or
    // two and p_arrivedelay costs more, so strikes queued and ran a click behind, which looked
    // exactly like the ball moving in impossible directions.
    H.tick(12);
    const after = ball();
    if (process.env.SB_TRACE) {
        for (const m of H.mesgs.filter(m => m.who === p.username && m.text && m.text.startsWith('SBDEBUG')).slice(-1)) {
            console.log('          ' + m.text);
        }
        console.log('        ' + dir + ' op' + op + ': player ' + (bx + dx) + ',' + (bz + dz) +
            '   ball ' + bx + ',' + bz + ' -> ' + (after ? after.x + ',' + after.z : 'gone') +
            '   balls in world: [' + allBalls().join('] [') + ']');
    }
    return true;
}

const TAP = 1;
const KICK = 3;
const SHOOT = 4;

console.log('\n================ WEREWOLF SKULLBALL');

console.log('\n  the pitch is already on the map');
check('    the Skullball Boss is at 3549,9867', H.npcNear('werewolf_skullballboss', 3549, 9867, 0) !== null, true);
check('    and a Skullball Trainer is out on the field', H.npcNear('werewolf_trainer_1', 3554, 9886, 0) !== null, true);

console.log('\n  the boss wants the ring, the quest and the level');
const p: any = player('skullball', 3549, 9868, 0);
H.setVar(p, 'tutorial', 1000);
setAgility(p, K.skullball_level);
{
    const boss = H.npcNear('werewolf_skullballboss', 3549, 9867, 0)!;
    H.setVar(p, 'fenk_quest', 0);
    let from = H.ifaces.length;
    H.opNpc(p, boss, 1);
    H.tick(6);
    let said = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('    an unfinished quest gets nothing', A.saw(said, 'werewolf'), true);
    check('    and no ball appears', ball() === null, true);

    H.setVar(p, 'fenk_quest', 99);
    from = H.ifaces.length;
    H.opNpc(p, boss, 1);
    H.tick(6);
    said = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('    a bare finger gets nothing', A.saw(said, 'ring'), true);

    H.equip(p, { ring: 'ring_of_charos' });
    setAgility(p, K.skullball_level - 1);
    from = H.ifaces.length;
    H.opNpc(p, boss, 1);
    H.tick(6);
    said = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check(`    and ${K.skullball_level - 1} agility gets nothing`, A.saw(said, 'Agility'), true);

    setAgility(p, K.skullball_level);
    H.opNpc(p, boss, 1);
    H.tick(6);
    const b = ball();
    check('    with all three, a skull appears', b !== null, true);
    if (b) {
        check(`    at the spawn ${C.skullball_spawn[0]},${C.skullball_spawn[1]}`,
            `${b.x},${b.z}`, `${C.skullball_spawn[0]},${C.skullball_spawn[1]}`);
    }
}

console.log('\n  and the clock has not started');
check('    no goals yet', p.getVar(progress), 0);

// THE WIKI'S OWN ROUTE, leg by leg. Each entry is the moves for one goal; after each the goal
// count must have gone up by exactly one.
const ROUTE: [string, ['n' | 's' | 'e' | 'w', number][]][] = [
    ['1  shoot north', [['n', SHOOT]]],
    ['2  kick north, tap east, kick north', [['n', KICK], ['e', TAP], ['n', KICK]]],
    ['3  tap east x2, shoot north', [['e', TAP], ['e', TAP], ['n', SHOOT]]],
    ['4  tap west, shoot north', [['w', TAP], ['n', SHOOT]]],
    ['5  tap east, shoot north', [['e', TAP], ['n', SHOOT]]],
    ['6  kick east, tap north x2, shoot east', [['e', KICK], ['n', TAP], ['n', TAP], ['e', SHOOT]]],
    ['7  kick east, shoot south', [['e', KICK], ['s', SHOOT]]],
    ['8  tap west, shoot south x2', [['w', TAP], ['s', SHOOT], ['s', SHOOT]]],
    ['9  tap east, shoot south', [['e', TAP], ['s', SHOOT]]],
    ['10 shoot south, taps, shoot west', [['s', SHOOT], ['w', TAP], ['w', TAP], ['w', TAP], ['s', TAP], ['s', TAP], ['w', SHOOT]]]
];

console.log('\n  the wiki route, leg by leg');
const xpBefore = p.stats[AGILITY];
let played = true;
for (let i = 0; i < ROUTE.length; i++) {
    const [label, moves] = ROUTE[i];
    const was = p.getVar(progress);
    for (const [dir, op] of moves) {
        if (!strike(p, dir, op)) break;
    }
    const now = p.getVar(progress);
    const b = ball();
    // the tenth goal ends the game and clears the counter, so the last leg is the one that must
    // read nothing rather than ten
    const last = i === ROUTE.length - 1;
    const want = last ? 0 : was + 1;
    check(`    ${label.padEnd(38)} -> ${last ? 'the whistle' : now + '/' + GOALS}` +
        `${b ? ` ball at ${b.x},${b.z}` : ''}`, now, want);
    if (now !== want) {
        played = false;
        break;
    }
}
check('    all ten, in the order the constants give', played, true);

console.log('\n  and the whistle paid');
{
    const paid = p.stats[AGILITY] - xpBefore;
    check(`    ${paid / 10} experience, at most the published ${K.skullball_reward / 10}`,
        paid > 0 && paid <= K.skullball_reward, true);
    check('    the ball is gone', ball() === null, true);
    check('    and the counter is clear for the next game', p.getVar(progress), 0);
}

H.despawn(p);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
