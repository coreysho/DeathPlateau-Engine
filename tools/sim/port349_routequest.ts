// In Search of the Myreque, as ported from PlagueCityRS 349, start to finish on the real engine:
// Vanstrom in the Hair of the Dog (and his Nature Spirit requirement), the steel weapons, Cyreg's
// four pages of persuasion, the druid pouch and the planks, both boats, the tree and the rotten
// bridge (a rung breaking, Repair on the broken one and on the whole one), Curpile's quiz failed and
// passed, the wooden doors, the stalagmite, Veliaf and the five introductions, the ambush cutscene,
// the skeleton hellhound, the way out through the false wall and the cellar ladder, the stranger and
// the reward - then the save migration from this server's old version of the quest.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_routequest.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Component from '#/cache/config/Component.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { isMapBlocked } from '#/engine/GameMap.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

// A sim player is not a NetworkPlayer, so no IfOpenMain is ever written for it: note the opens here.
const opened: { who: string; com: number }[] = [];
const origOpen = (Player.prototype as any).openMainModal;
(Player.prototype as any).openMainModal = function (com: number) {
    opened.push({ who: this.username, com });
    return origOpen.call(this, com);
};
const jumps: { who: string; x: number; z: number; level: number }[] = [];
const origJump = (Player.prototype as any).teleJump;
(Player.prototype as any).teleJump = function (x: number, z: number, level: number) {
    jumps.push({ who: this.username, x, z, level });
    return origJump.call(this, x, z, level);
};
const wasOpened = (p: Player, name: string) => opened.some(o => o.who === p.username && o.com === Component.getId(name));

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const S = {
    not_started: 0, started: 5, spoke_to_boatman: 10, boatman_agreed: 15, boatman_repaired: 20, entered_hollowed: 25,
    found_guard: 52, answered_questions: 55, entered_underground: 60, introduced_veliaf: 65, enter_cutscene: 70,
    ambush: 80, saved_myreque: 85, told_exit_route: 90, discovered_wall: 95, found_exit: 97, spoke_to_stranger: 100, complete: 105
};
const stage = (p: Player) => H.getVar(p, 'routequest');
const at = (p: Player) => [p.x, p.z, p.level];
const free = (p: Player) => !isMapBlocked(p.x, p.z, p.level);
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'druidspirit', 110); // Nature Spirit done
    H.tick(1);
    return p;
}

type Pick = number | ((header: string) => number);
const headerCom = Component.getId('multi5:com_0');

/** Let the player's script run out, clicking through chat and taking `picks` at each menu. */
function drive(p: Player, picks: Pick[] = [], idleTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 800 && idle < idleTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            let pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open + ' after ' + H.ifaces.slice(from).filter(i => i.who === p.username && i.text).map(i => i.text).slice(-6).join(' / '));
            if (typeof pick === 'function') {
                const hs = H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.com === headerCom);
                pick = pick(hs.length ? hs[hs.length - 1].text ?? '' : '');
            }
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.length);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

function findNpc(npcName: string, p: Player): Npc {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    return npc;
}

function talk(p: Player, npcName: string, picks: Pick[] = []): string[] {
    const from = H.ifaces.length;
    const npc = findNpc(npcName, p);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
        if (isMapBlocked(npc.x + dx, npc.z + dz, npc.level)) continue;
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    drive(p, picks);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

/** Run a proc as the login script would: with protected access to the player. */
function runLogin(p: Player, name: string) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p), true);
    drive(p);
}

function op(p: Player, x: number, z: number, locName: string, n = 1, picks: Pick[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}

// chat text is split over lines (components), so look for it in all of them run together
const has = (texts: string[], s: string) => texts.join(' ').replace(/\s+/g, ' ').includes(s);
const weapons = (p: Player) => {
    H.give(p, 'steel_longsword');
    H.give(p, 'steel_sword');
    H.give(p, 'steel_sword');
    H.give(p, 'steel_dagger');
    H.give(p, 'steel_mace');
    H.give(p, 'steel_warhammer');
};

// Curpile's questions and their answers (the option number in the five-way menu).
function answer(header: string, right = true): number {
    const key: [string, number][] = [
        ['youngest', 2], ['female', 1], ['leader', 3], ['scholar', 4], ["boatman's name", 4], ['family', 2]
    ];
    for (const [k, n] of key) if (header.includes(k)) return right ? n : 5;
    throw new Error('unknown question: ' + header);
}

// places
const CHAIR = [3503, 3477];
const MORTTON_BOAT = [3523, 3284];
const HOLLOWS_BOAT = [3498, 3377];
const TREE_S = [3502, 3426], TREE_N = [3502, 3431];
const DOORS = [3509, 3447];
const STALAGMITE = [3492, 9824];

// ============================================================================================
console.log('VANSTROM KLAUSE, THE HAIR OF THE DOG');
const p = player('myreque', CHAIR[0] + 1, CHAIR[1]);
{
    H.setVar(p, 'druidspirit', 0);
    let t = talk(p, 'multi_vanstrom_stranger_entity');
    check('without Nature Spirit he keeps it to himself', [stage(p), has(t, 'do not meet all of the requirements')], [0, true]);
    H.setVar(p, 'druidspirit', 110);
    // friends? (1) - why do they need help? (2) - perhaps I could help (4) - what weapons (2) - yes (4)
    t = talk(p, 'multi_vanstrom_stranger_entity', [1, 2, 4, 2, 4]);
    check('"Yes, I\'ll do it!": started', stage(p), S.started);
    check('  it was Vanstrom Klause in the chair', has(t, 'Vanstrom Klause'), true);
    check('  and the quest tab row is no longer red (the journal opens)', (() => { H.ifButton(p, 'questlist:routequest'); drive(p); return true; })(), true);
    t = talk(p, 'multi_vanstrom_stranger_entity', [3]);
    check('  talked to again: "what am I supposed to do again?"', has(t, 'boatman in Mort\'ton'), true);
}

console.log('CYREG PADDLEHORN');
{
    let t = talk(p, 'route_cyreg_paddlehorn');
    check('no weapons: "doesn\'t look as if you\'ve got the right sort"', [stage(p), has(t, 'right sort of weapons')], [S.started, true]);
    weapons(p);
    // prologue -> first page: "they'll just die" (2) -> second page: "resourceful enough" (2)
    // -> third: "their deaths are on your head" (3) -> fourth: "what kind of a man" (3)
    t = talk(p, 'route_cyreg_paddlehorn', [2, 2, 3, 3]);
    check('persuaded, but no druid pouch: stage 15', [stage(p), has(t, "don't have anything which I can use against them")], [S.boatman_agreed, true]);
    H.give(p, 'druid_pouch', 3);
    t = talk(p, 'route_cyreg_paddlehorn');
    check('  a pouch with three in it is not enough', [stage(p), has(t, "doesn't seem to be many charges")], [S.boatman_agreed, true]);
    H.give(p, 'druid_pouch', 2);
    t = talk(p, 'route_cyreg_paddlehorn');
    check('  five, but no planks: told to bring them', [stage(p), has(t, 'The bridge you cross later is rotten')], [S.boatman_agreed, true]);
    H.give(p, 'woodplank', 6);
    t = talk(p, 'route_cyreg_paddlehorn', [1]);
    check('three planks handed over: stage 20', [stage(p), H.invCount(p, 'woodplank')], [S.boatman_repaired, 3]);
    t = talk(p, 'route_cyreg_paddlehorn', [1, 5]);
    check('  and afterwards he answers questions', has(t, 'look for an unusual tree'), true);
}

console.log('THE BOAT');
{
    p.teleport(MORTTON_BOAT[0] - 1, MORTTON_BOAT[1] + 1, 0);
    H.tick(1);
    let t = op(p, MORTTON_BOAT[0], MORTTON_BOAT[1], 'route_rowboat_mortton', 1, [1]);
    check('no coins: "No money, no boat!"', [stage(p), has(t, 'No money, no boat')], [S.boatman_repaired, true]);
    H.give(p, 'coins', 25);
    op(p, MORTTON_BOAT[0], MORTTON_BOAT[1], 'route_rowboat_mortton', 1, [1]);
    check('Board, pay ten: the Hollows, stage 25, ten gold gone', [stage(p), at(p), H.invCount(p, 'coins')], [S.entered_hollowed, [3498, 3380, 0], 15]);
    check('  on a free tile', free(p), true);
    check('  the boat journey was shown', wasOpened(p, 'inter_230'), true);
    p.teleport(HOLLOWS_BOAT[0], HOLLOWS_BOAT[1] + 3, 0);
    H.tick(1);
    op(p, HOLLOWS_BOAT[0], HOLLOWS_BOAT[1], 'route_rowboat_hollows');
    check('the Hollows boat takes you back to Mort\'ton, free, stage kept', [at(p), H.invCount(p, 'coins'), stage(p)], [[3522, 3284, 0], 15, S.entered_hollowed]);
    p.teleport(MORTTON_BOAT[0] - 1, MORTTON_BOAT[1] + 1, 0);
    H.tick(1);
    op(p, MORTTON_BOAT[0], MORTTON_BOAT[1], 'route_rowboat_mortton', 2);
    check('Board ( Pay 10 ): back to the Hollows, ten more gone', [at(p), H.invCount(p, 'coins'), stage(p)], [[3498, 3380, 0], 5, S.entered_hollowed]);
}

console.log('THE TREE AND THE BRIDGE');
{
    p.teleport(TREE_S[0], TREE_S[1] - 1, 0);
    H.tick(1);
    op(p, TREE_S[0], TREE_S[1], 'harmless_dead_palm_mid', 1);
    check('climb the southern tree: onto the bridge', at(p), [3502, 3427, 0]);
    H.give(p, 'hammer');
    H.give(p, 'nails', 30);
    let t = op(p, 3502, 3428, 'swamp_bridge1', 1);
    check('walk onto an unmended board: it breaks, you stay put', [at(p), has(t, 'break apart beneath your feet'), !!World.getLoc(3502, 3428, 0, LocType.getId('spooky_tree_base_forbridge'))], [[3502, 3427, 0], true, true]);
    op(p, 3502, 3428, 'spooky_tree_base_forbridge', 1);
    check('Repair the broken board: a plank and ten nails, and across it', [H.getVarBit(p, 'bridgerung1'), H.invCount(p, 'woodplank'), H.invCount(p, 'nails'), at(p)], [1, 2, 20, [3502, 3428, 0]]);
    op(p, 3502, 3429, 'swamp_bridge1', 5);
    check('Repair on the next (still whole-looking) board', [H.getVarBit(p, 'bridgerung2'), H.invCount(p, 'nails'), at(p)], [1, 10, [3502, 3429, 0]]);
    op(p, 3502, 3430, 'swamp_bridge1', 5);
    check('  and the last', [H.getVarBit(p, 'bridgerung3'), H.invCount(p, 'woodplank'), H.invCount(p, 'nails'), at(p)], [1, 0, 0, [3502, 3430, 0]]);
    op(p, TREE_N[0], TREE_N[1], 'harmless_dead_palm_mid', 2);
    check('climb down the northern tree: stage 52', [stage(p), at(p)], [S.found_guard, [3503, 3432, 0]]);
    check('  on a free tile', free(p), true);
    // and back again, which a mended bridge allows with nothing in hand
    op(p, TREE_N[0], TREE_N[1], 'harmless_dead_palm_mid', 1);
    op(p, 3502, 3429, 'swamp_bridge1', 1);
    check('a mended bridge is walked', at(p), [3502, 3429, 0]);
}

console.log('CURPILE FYOD');
{
    let t = talk(p, 'route_curpile_fyod', [5]);
    check('"I have to go."', [stage(p), has(t, 'be on your way')], [S.found_guard, true]);
    // a failed quiz knocks you out and you wake in Mort'ton
    t = talk(p, 'route_curpile_fyod', [1, h => answer(h, false), h => answer(h, false), h => answer(h, false)]);
    for (let i = 0; i < 20; i++) H.tick(1);
    check('three wrong: knocked out, awake in Mort\'ton, stage kept', [stage(p), at(p), has(t, 'you got them all wrong')], [S.found_guard, [3522, 3285, 0], true]);
    p.teleport(3508, 3441, 0);
    H.tick(1);
    t = talk(p, 'route_curpile_fyod', [1, h => answer(h), h => answer(h), h => answer(h)]);
    check('three right: stage 55', [stage(p), has(t, "I'll unlock it for you")], [S.answered_questions, true]);
}

console.log('THE HOLLOWS');
{
    const lvl = H.getVar(p, 'routequest');
    void lvl;
    p.teleport(DOORS[0], DOORS[1] - 1, 0);
    H.tick(1);
    op(p, DOORS[0], DOORS[1], 'freedomfighterentrancer');
    check('the wooden doors: underground, stage 60', [stage(p), at(p)], [S.entered_underground, [3500, 9811, 0]]);
    p.setLevel(16, 24); // agility
    p.teleport(STALAGMITE[0] - 1, STALAGMITE[1], 0);
    H.tick(1);
    let t = op(p, STALAGMITE[0], STALAGMITE[1], 'route_stalagmite_cave_entrace', 2);
    check('Squeeze-past at 24 Agility: refused', [has(t, 'Agility level of 25'), p.level], [true, 0]);
    p.setLevel(16, 99);
    op(p, STALAGMITE[0], STALAGMITE[1], 'route_stalagmite_cave_entrace', 2);
    check('at 25+: into the hideout, where all six are', at(p), [3505, 9832, 3]);
    t = talk(p, 'route_sani_piliu');
    if (!has(t, "You'd best go and talk with Veliaf")) console.log('    sani said: ' + t.join(' / '));
    check('Sani sends you to Veliaf first', [has(t, "You'd best go and talk with Veliaf"), H.getVar(p, 'routequest_myreque_bits')], [true, 0]);
    t = talk(p, 'route_veliaf_hurtz', [5]);
    check('Veliaf: stage 65, go and introduce yourself', stage(p), S.introduced_veliaf);
    t = talk(p, 'route_veliaf_hurtz', [3]);
    check('  "who else?": the list', has(t, 'You must introduce yourself'), true);
    for (const n of ['route_sani_piliu', 'route_harold_evans', 'route_radigad_ponfit', 'route_polmafi_ferdygris', 'route_ivan_strom']) talk(p, n, [1, 5]);
    check('all five introduced', H.getVar(p, 'routequest_myreque_bits'), 31);
}

console.log('THE AMBUSH');
{
    const hound = NpcType.getId('skeleton_hellhound');
    H.clearLogs();
    talk(p, 'route_veliaf_hurtz');
    check('weapons handed over, the cutscene plays out: stage 80', stage(p), S.ambush);
    check('  the weapons are gone', ['steel_longsword', 'steel_sword', 'steel_dagger', 'steel_mace', 'steel_warhammer'].map(o => H.invCount(p, o)), [0, 0, 0, 0, 0]);
    check('  you come out on the ground floor of the hideout', [p.level, Math.abs(p.x - 3506) <= 3 && Math.abs(p.z - 9837) <= 5], [0, true]);
    const said = mesSince(p, 0).join('|');
    check('  Vanstrom said his lines', ['you took me straight to them', 'Sorry, Harold, you too!', 'With my little pet!'].map(l => said.includes(l) || H.ifaces.some(i => i.who === p.username && (i.text ?? '').includes(l))), [true, true, true]);
    check('  and the room was cleared behind you', World.npcs ? [...World.npcs].filter(n => n && n.isActive && n.level === 2 && NpcType.get(n.type).debugname?.startsWith('route_')).length : -1, 0);
    check('  Vanstrom has left the chair in Canifis', H.getVarBit(p, 'thsfm_vanstrom_hide'), 1);
    const dog = [...World.npcs].find(n => n && n.isActive && n.type === hound);
    check('  a skeleton hellhound is loose', !!dog, true);
    const t = talk(p, 'route_radigad_ponfit');
    check('  Radigad cannot talk now', mesSince(p, 0).some(m => m.includes("isn't able to talk")) || t.length === 0, true);
    if (dog) {
        const e0 = errors.length;
        H.attackNpc(p, dog);
        for (let i = 0; i < 400 && dog.isActive; i++) {
            H.tick(1);
            if (!p.target && !p.delayed && i % 8 === 7) H.attackNpc(p, dog);
            if (p.levels[3] < 40) p.levels[3] = 99;
        }
        for (let i = 0; i < 10; i++) H.tick(1);
        check('the hellhound killed: stage 85', stage(p), S.saved_myreque);
        const objs = (name: string) => {
            let n = 0;
            const id = ObjType.getId(name);
            for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
                const zone = World.gameMap.getZone(dog.x + dx, dog.z + dz, 0);
                for (const o of zone.getAllObjsSafe()) if (o.type === id && o.x === dog.x + dx && o.z === dog.z + dz) n += o.count;
            }
            return n;
        };
        check('  four big bones and two uncut rubies', [objs('big_bones'), objs('uncut_ruby')], [4, 2]);
        check('  no script errors in the fight', errors.length - e0, 0);
    }
}

console.log('THE WAY OUT');
{
    let t = talk(p, 'route_ivan_strom');
    if (!has(t, 'thank Saradomin')) console.log('    ivan said: ' + t.join(' / '));
    check('Ivan, after', has(t, 'thank Saradomin'), true);
    t = talk(p, 'route_veliaf_hurtz', [3, 5]);
    check('Veliaf: "How do I get out of here?" - stage 90', [stage(p), has(t, 'search the wall')], [S.told_exit_route, true]);
    t = talk(p, 'route_veliaf_hurtz', [2, 5]);
    check('  and he still talks after', has(t, 'Vanstrom will expect that we\'re dead'), true);
    // out of the hideout by its tunnel, then along the corridor to the false wall
    op(p, 3505, 9831, 'route_cavewalltunnel');
    check('the hideout\'s tunnel: beside the stalagmite', at(p), [3491, 9824, 0]);
    p.teleport(3480, 9836, 0);
    H.tick(1);
    op(p, 3480, 9837, 'thrttavernbasementfalsewall');
    check('Search the wall: through into the inn basement, stage 95', [stage(p), at(p)], [S.discovered_wall, [3480, 9837, 0]]);
    p.teleport(3477, 9845, 0);
    H.tick(1);
    op(p, 3477, 9846, 'thrttavernbasementladder');
    check('the basement ladder: out beside the Hair of the Dog, stage 97', [stage(p), Math.abs(p.x - 3494) <= 1 && Math.abs(p.z - 3464) <= 1, p.level], [S.found_exit, true, 0]);
    op(p, 3494, 3464, 'thrt_tavern_trap_door');
    check('the trapdoor now opens: the basement', at(p), [3477, 9845, 0]);
}

console.log('THE STRANGER, AND THE END');
{
    const qp0 = H.getVar(p, 'qp');
    const xp0 = [0, 1, 2, 3, 12].map(s => p.stats[s]);
    const t = talk(p, 'multi_vanstrom_stranger_entity');
    for (let i = 0; i < 5; i++) H.tick(1);
    drive(p);
    check('"I thought you were that dirty murderer Vanstrom": complete', [stage(p), has(t, 'score to settle')], [S.complete, true]);
    check('  two quest points', H.getVar(p, 'qp') - qp0, 2);
    check('  600 xp in Attack, Defence, Strength, Hitpoints, Crafting', [0, 1, 2, 3, 12].map((s, i) => p.stats[s] - xp0[i]), [6000, 6000, 6000, 6000, 6000]);
    check('  the quest complete scroll', wasOpened(p, 'inter_238'), true);
    const t2 = talk(p, 'multi_vanstrom_stranger_entity');
    drive(p);
    if (!has(t2, 'been through this before')) console.log('    stranger said: ' + t2.join(' / '));
    check('the stranger afterwards; paid once', [has(t2, 'been through this before'), H.getVar(p, 'qp') - qp0, p.stats[0] - xp0[0]], [true, 2, 6000]);
    const t3 = talk(p, 'route_cyreg_paddlehorn');
    check('Cyreg afterwards', has(t3, 'I feel so guilty'), true);
    p.teleport(MORTTON_BOAT[0] - 1, MORTTON_BOAT[1] + 1, 0);
    H.tick(1);
    H.give(p, 'coins', 10);
    op(p, MORTTON_BOAT[0], MORTTON_BOAT[1], 'route_rowboat_mortton', 2);
    check('the boat afterwards does not reset the quest', [stage(p), at(p)], [S.complete, [3498, 3380, 0]]);
    // In Aid of the Myreque picks Veliaf up
    p.teleport(3505, 9833, 0);
    H.tick(1);
    const t4 = talk(p, 'route_veliaf_hurtz', [1]);
    check('Veliaf hands over to In Aid of the Myreque', [H.getVarBit(p, 'myreque_2_quest') > 0, has(t4, 'Burgh de Rott')], [true, true]);
}

console.log('A STALLED CUTSCENE AND THE ROOMS');
{
    // someone who logs out mid-cutscene is saved in a cutscene room at stage 70
    const q = player('stalled', 3506, 9837, 2);
    H.setVar(q, 'routequest', S.enter_cutscene);
    op(q, 3505, 9831, 'route_cavewalltunnel');
    check('the room\'s tunnel mouth leads back out of the hideout', at(q), [3491, 9824, 0]);
    // and each of the four ambush rooms has somewhere to stand
    const rooms = [[2, 3506, 9837], [1, 3468, 9807], [1, 3506, 9837], [2, 3468, 9837]];
    check('the four ambush rooms: Veliaf\'s tile is open in each', rooms.map(([l, x, z]) => !isMapBlocked(x, z + 1, l)), [true, true, true, true]);
    // and stage 70 plays the cutscene again from Veliaf
    q.teleport(3506, 9836, 3);
    H.tick(1);
    talk(q, 'route_veliaf_hurtz');
    check('  Veliaf at stage 70: the cutscene again, stage 80', stage(q), S.ambush);
    // the hellhound comes back if you leave and return before killing it
    for (const n of [...World.npcs]) if (n && n.isActive && n.type === NpcType.getId('skeleton_hellhound')) World.removeNpc(n, -1);
    q.teleport(STALAGMITE[0] - 1, STALAGMITE[1], 0);
    H.tick(1);
    op(q, STALAGMITE[0], STALAGMITE[1], 'route_stalagmite_cave_entrace', 2);
    check('  back in past the stalagmite at stage 80: the ground floor, a new hellhound', [at(q), [...World.npcs].some(n => n && n.isActive && n.type === NpcType.getId('skeleton_hellhound'))], [[3505, 9832, 0], true]);
}

console.log('THE OTHER THREE AMBUSH ROOMS');
{
    // the cutscene takes the first empty room of four; fill them one at a time
    const rooms = [[2, 3506, 9837], [1, 3468, 9807], [1, 3506, 9837], [2, 3468, 9837]];
    const sitters: Player[] = [];
    for (let r = 1; r < 4; r++) {
        const [l, x, z] = rooms[r - 1];
        const sitter = player('sitter' + r, x, z + 3, l);
        sitters.push(sitter);
        const q = player('room' + (r + 1), 3506, 9836, 3);
        H.setVar(q, 'routequest', S.introduced_veliaf);
        H.setVar(q, 'routequest_myreque_bits', 31);
        weapons(q);
        const e0 = errors.length;
        talk(q, 'route_veliaf_hurtz');
        const j = jumps.filter(o => o.who === q.username);
        const into = j.length ? [j[0].level, Math.abs(j[0].x - rooms[r][1]) <= 3, Math.abs(j[0].z - rooms[r][2]) <= 3] : null;
        check(`room ${r + 1}: played there, stage 80, back on the ground floor, no errors`, [into, stage(q), q.level, errors.length - e0], [[rooms[r][0], true, true], S.ambush, 0, 0]);
        for (const n of [...World.npcs]) if (n && n.isActive && n.type === NpcType.getId('skeleton_hellhound')) World.removeNpc(n, -1);
    }
    // all four taken: Veliaf asks you to come back later
    const [l, x, z] = rooms[3];
    player('sitter4', x, z + 3, l);
    const q = player('roomfull', 3506, 9836, 3);
    H.setVar(q, 'routequest', S.introduced_veliaf);
    H.setVar(q, 'routequest_myreque_bits', 31);
    weapons(q);
    const t = talk(q, 'route_veliaf_hurtz');
    check('no cutscene npcs are left behind in any room', [...World.npcs].filter(n => n && n.isActive && (n.level === 1 || n.level === 2) && Math.floor(n.x / 64) === 54 && Math.floor(n.z / 64) === 153).length, 0);
    check('all four rooms in use: "come and chat with me again", stage 70, weapons taken', [has(t, 'come and chat with me again'), stage(q), H.invCount(q, 'steel_sword'), q.level], [true, S.enter_cutscene, 0, 3]);
}

// ============================================================================================
console.log('SAVE MIGRATION');
{
    const mig = (name: string, old: Record<string, number>, bits: Record<string, number> = {}, druid = 110) => {
        const m = player(name, 3494, 3470);
        H.setVarBit(m, 'port349_routequest', 0);
        H.setVar(m, 'druidspirit', druid);
        for (const [k, v] of Object.entries(old)) H.setVar(m, k, v);
        for (const [k, v] of Object.entries(bits)) H.setVarBit(m, k, v);
        runLogin(m, '[proc,port349_login]');
        return m;
    };
    const snap = (m: Player) => [stage(m), H.getVar(m, 'routequest_myreque_bits'), H.getVarBit(m, 'bridgerung1'), H.getVarBit(m, 'bridgerung2'), H.getVarBit(m, 'bridgerung3'), H.getVarBit(m, 'thsfm_vanstrom_hide'), H.getVarBit(m, 'routequestionscorrect'), H.getVarBit(m, 'routequestionsanswered'), H.getVarBit(m, 'roomnum'), H.getVarBit(m, 'port349_routequest')];

    const fresh = player('migfresh', 3494, 3470);
    check('a fresh player: untouched, and marked done at login', snap(fresh), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

    const done = mig('migdone', { routequest: 5, routequest_myreque_bits: 7 }, { bridgerung1: 1, bridgerung2: 1, bridgerung3: 1, thsfm_vanstrom_hide: 1, routequestionscorrect: 3, routequestionsanswered: 3 });
    check('old complete (5): complete (105), bridge mended, all met, Vanstrom gone', snap(done), [105, 31, 1, 1, 1, 1, 0, 0, 0, 1]);
    const qpDone = H.getVar(done, 'qp');
    runLogin(done, '[proc,port349_login]');
    check('  logging in again changes nothing', snap(done), [105, 31, 1, 1, 1, 1, 0, 0, 0, 1]);
    const d0 = done.stats[0];
    const t = talk(done, 'multi_vanstrom_stranger_entity');
    drive(done);
    check('  the stranger does not pay the reward again', [has(t, 'been through this before'), done.stats[0] - d0, H.getVar(done, 'qp') - qpDone], [true, 0, 0]);
    runLogin(done, '[proc,update_questpoints]');
    check('  and it counts for its quest points', H.getVar(done, 'qp') >= 2, true);

    const route = mig('migroute', { routequest: 3, routequest_myreque_bits: 3 }, { bridgerung1: 1, bridgerung2: 1, routequestionscorrect: 3, routequestionsanswered: 3, roomnum: 2 });
    check('old underway (3), Nature Spirit done: started (5), old bits cleared, mended rungs kept', snap(route), [5, 0, 1, 1, 0, 0, 0, 0, 0, 1]);
    runLogin(route, '[proc,port349_login]');
    check('  logging in again changes nothing', snap(route), [5, 0, 1, 1, 0, 0, 0, 0, 0, 1]);
    for (const old of [1, 2, 4]) {
        const m = mig('migold' + old, { routequest: old, routequest_myreque_bits: old === 4 ? 7 : 0 }, { routequestionscorrect: 2, routequestionsanswered: 3 });
        check(`old ${old}: started (5)`, snap(m), [5, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    }
    const nodruid = mig('mignodruid', { routequest: 2 }, { routequestionscorrect: 3, routequestionsanswered: 3 }, 0);
    check('old underway without Nature Spirit: not started', snap(nodruid), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    const t2 = talk(route, 'multi_vanstrom_stranger_entity', [3]);
    check('  a migrated player at 5 carries on with Vanstrom', has(t2, 'boatman in Mort\'ton'), true);
    const rq = H.getVar(fresh, 'routequest');
    runLogin(fresh, '[proc,port349_login]');
    check('a fresh player twice: still untouched', [rq, snap(fresh)], [0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]]);
}

console.log('QUEST LIST');
{
    const q = player('qlist', 3494, 3470);
    H.setVar(q, 'routequest', S.spoke_to_stranger);
    runLogin(q, '[proc,update_questpoints]');
    const a = H.getVar(q, 'qp');
    H.setVar(q, 'routequest', S.complete);
    runLogin(q, '[proc,update_questpoints]');
    check('complete counts for 2 quest points, 100 does not', H.getVar(q, 'qp') - a, 2);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
if (errors.length) console.log('script errors:\n' + errors.join('\n'));
process.exit(R.bad || errors.length ? 1 : 0);
