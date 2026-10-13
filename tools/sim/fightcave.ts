// THE FIGHT CAVE'S REFIGHT SHORTCUT - suggestion #21, "fight TzTok-Jad only".
//
//   npx tsx tools/sim/fightcave.ts
//
// WHAT THE SHORTCUT IS. Someone who has cleared the cave once can enter at wave 63 instead of
// wave 1. That is three varp writes and a chat menu, and it would be a two-line change if it were
// not for the two things that go wrong quietly:
//
//   THE PAYOUT. Entering at wave 63 leaves %fightcave_wave at 63, and every exit from the cave -
//   leaving, dying, killing Jad - pays ~fightcave_tokkul_for of the waves survived. Unguarded,
//   walking straight back out of a shortcut run pays 62 * 63 = 3,906 Tokkul for fighting nothing,
//   and the kill pays the full-clear 8,032. So the run has to remember HOW it was entered, which
//   is what %fightcave_jad_only is for, and the three exits all read it through one guard in
//   ~fightcave_pay. Both numbers are checked below, and so is the full run's 8,032, because the
//   guard must not touch it.
//
//   THE UNLOCK. All four fightcave varps are temp, deliberately - they point into an instance that
//   does not survive a restart - so none of them can answer "have you done this before". The
//   answer comes from the collection log, which already records the Fire cape and is kept forever,
//   and which therefore credits every account that cleared the cave before today. Checked here
//   from both sides: no cape in the log, no menu at all; cape in the log, menu.
//
// AND IT KILLS JAD, for real, through the shortcut: the player is kept alive each tick the way
// zulrahkill.ts keeps its archer alive, and everything in the instance is attacked until nothing
// is left - the healers included, because four of them healing 10 apiece will out-heal a whip.
// That is the only way to prove the shortcut's run ends in the cape rather than in a cave that
// never finishes.
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const ENTRANCE: [number, number] = [2437, 5166]; // loc_9356, m38_80 local 5,46
const OUTSIDE: [number, number] = [2437, 5167]; // ^fightcave_outside
const JAD_WAVE = 63; // ^fightcave_jad_wave
const FULL_RUN_TOKKUL = 8032; // ^fightcave_full_run_tokkul
const JAD_TOKKUL = 4000; // ^fightcave_tokkul_jad
const TIER_PARAM = ParamType.getId('fightcave_tier');
// A null coord varp reads back as -1, not 0.
const NO_INSTANCE = -1;
const HP = NpcStat.HITPOINTS;
const JAD = 'tzhaar_fightcave_swarm_boss';
const TZKIH = 'tzhaar_fightcave_swarm_1a'; // the Tz-Kih, tier 1

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, OUTSIDE[0], OUTSIDE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
/** Tick until the player is idle again. The first two ticks are unconditional: a click sets an
 * interaction and the script does not start until the tick after, so a settle that checks first
 * reads "idle" and returns having run nothing. */
function settle(q: Player, n = 20) {
    H.tick(2);
    for (let t = 0; t < n; t++) {
        if (!q.delayed && !q.activeScript) return;
        H.tick(1);
    }
}
const mesFor = (q: Player) => H.mesgs.filter(m => m.who === q.username).map(m => m.text);
const said = (q: Player, fragment: string) => mesFor(q).some(t => t.includes(fragment));

/** Answer a p_choice menu with its option `pick` (1-based); false if no menu is open. */
function pickMenu(q: Player, pick: number): boolean {
    for (let t = 0; t < 8; t++) {
        const s = q.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            const names = q.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = q.modalChat === -1 ? '' : (Component.get(q.modalChat).comName ?? '');
            const iface = names.find((n: string) => n.startsWith(open + ':'))?.split(':')[0];
            return iface ? H.choose(q, `${iface}:com_${pick}`) : false;
        }
        H.tick(1);
    }
    return false;
}
/** True once a chat menu is waiting for an answer. */
function menuOpen(q: Player): boolean {
    for (let t = 0; t < 8; t++) {
        const s = q.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) return true;
        H.tick(1);
    }
    return false;
}
/** The option text the server wrote into the open chat menu, header first. */
function menuText(q: Player): string[] {
    const open = q.modalChat === -1 ? '' : (Component.get(q.modalChat).comName ?? '');
    const iface = open.split(':')[0];
    const out: string[] = [];
    for (const e of H.ifaces) {
        if (e.kind !== 'text' || e.who !== q.username) continue;
        const m = new RegExp(`^${iface}:com_(\\d+)$`).exec(Component.get(e.com)?.comName ?? '');
        if (m) out[+m[1]] = e.text ?? '';
    }
    return out.filter(t => t !== undefined);
}
function runProtected(q: Player, name: string, args: unknown[] = []): void {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = q.protect;
    q.protect = true;
    const state = ScriptRunner.init(script, q, null, args as never[]);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    q.protect = was;
}
const enter = (q: Player) => H.opLoc(q, ENTRANCE[0], ENTRANCE[1], 'loc_9356', 1);
const wave = (q: Player) => H.getVar(q, 'fightcave_wave');
const jadOnly = (q: Player) => H.getVar(q, 'fightcave_jad_only');
/** Pack plus bank, because ~obj_giveorbank banks what will not fit - nothing the cave pays may
 * fall on the floor of an instance that is about to be deleted. InvType has named constants only
 * for inv and worn, so the bank is looked up by name. */
const BANK = InvType.getId('bank');
const held = (q: Player, objName: string) => H.invCount(q, objName) + (q.getInventory(BANK)?.getItemCount(ObjType.getId(objName)) ?? 0);
const tokkul = (q: Player) => held(q, 'tzhaar_token');
const capes = (q: Player) => held(q, 'tzhaar_cape_fire');

/** The player's own instance, as a [x, z] south-west corner, or null when not inside. */
function instanceBase(q: Player): [number, number] | null {
    const packed = H.getVar(q, 'fightcave_instance');
    if (packed <= 0) return null;
    const c = CoordGrid.unpackCoord(packed);
    return [c.x, c.z];
}
/** Every cave monster alive in this player's instance. */
function monsters(q: Player): Npc[] {
    const base = instanceBase(q);
    if (!base) return [];
    const out: Npc[] = [];
    for (const n of (World as unknown as { npcs: (Npc | null)[] }).npcs) {
        if (!n || !n.isActive) continue;
        if (NpcType.get(n.type).params.get(TIER_PARAM) === undefined) continue;
        if (n.x < base[0] || n.x >= base[0] + 64 || n.z < base[1] || n.z >= base[1] + 64) continue;
        out.push(n);
    }
    return out;
}
const monsterNames = (q: Player) =>
    monsters(q)
        .map(n => NpcType.get(n.type).debugname ?? '?')
        .sort();

// ============================================================ 1. the unlock
console.log('== the collection log is the record of a cleared cave');
{
    const p = player('fresh');
    const unlocked = () => H.runProc(p, '[proc,fightcave_jad_unlocked]');
    const logged = () => H.runProc(p, '[proc,collection_log_has]', [ObjType.getId('tzhaar_cape_fire')]);
    check('a fresh account has no Fire cape in the log', logged(), [0]);
    check('and the shortcut is locked', unlocked(), [0]);
    // ~collection_log_add is what ~fightcave_reward calls on a Jad kill, and the only thing that
    // ever puts a Fire cape in the log - the cave is the cape's only source.
    runProtected(p, '[proc,collection_log_add]', [ObjType.getId('tzhaar_cape_fire'), 1]);
    check('one logged Fire cape unlocks it', [logged(), unlocked()], [[1], [1]]);
    // THE LOG RECORDS WHAT WAS OBTAINED, not what is owned - which is what makes the unlock
    // survive exchanging the cape away at TzHaar-Mej-Jal, or losing it, or never having carried
    // one at all, as this player never has.
    check('while owning no cape at all', capes(p), 0);
    H.despawn(p);
}

// ============================================================ 2. no unlock, no menu
console.log('== without the unlock the cave starts at wave 1, with nothing to choose');
{
    const p = player('firsttimer');
    H.clearLogs();
    check('the entrance takes the click', enter(p), true);
    check('and asks nothing', menuOpen(p), false);
    settle(p, 30);
    check('wave 1', [wave(p), jadOnly(p)], [1, 0]);
    check('and says so', said(p, 'Wave 1'), true);
    // Wave 1 is one tier-1 monster, by the subtraction rule in fightcave.constant - which in the
    // 377 cache is called tzhaar_fightcave_swarm_1a and is the Tz-Kih.
    check('one Tz-Kih in the cave', monsterNames(p), [TZKIH]);
    H.despawn(p);
}

// ============================================================ 3. the menu
console.log('== with the unlock, three options');
{
    const p = player('veteran');
    runProtected(p, '[proc,collection_log_add]', [ObjType.getId('tzhaar_cape_fire'), 1]);
    H.clearLogs();
    enter(p);
    check('a menu opens', menuOpen(p), true);
    check('with the header and the three options', menuText(p), ['How would you like to enter?', 'Start from wave 1.', 'Fight TzTok-Jad only.', 'Cancel.']);

    // Cancel builds nothing: an instance is one of 1024 and leaking one on a misclick would be
    // the worst kind of bug to find.
    pickMenu(p, 3);
    settle(p, 30);
    check('Cancel builds no cave', [H.getVar(p, 'fightcave_instance'), wave(p)], [NO_INSTANCE, 0]);
    check('and leaves the player outside', [p.x, p.z], OUTSIDE);
    H.despawn(p);
}

console.log('== option 1 is the cave as it always was');
{
    const p = player('longway');
    runProtected(p, '[proc,collection_log_add]', [ObjType.getId('tzhaar_cape_fire'), 1]);
    H.clearLogs();
    enter(p);
    pickMenu(p, 1);
    settle(p, 30);
    check('wave 1, and not marked as a shortcut run', [wave(p), jadOnly(p)], [1, 0]);
    check('one Tz-Kih', monsterNames(p), [TZKIH]);
    H.despawn(p);
}

console.log('== option 2 is TzTok-Jad, alone');
{
    const p = player('shortcut');
    runProtected(p, '[proc,collection_log_add]', [ObjType.getId('tzhaar_cape_fire'), 1]);
    H.clearLogs();
    enter(p);
    pickMenu(p, 2);
    settle(p, 30);
    check('wave 63, marked as a shortcut run', [wave(p), jadOnly(p)], [JAD_WAVE, 1]);
    check('and the only thing in the cave is Jad', monsterNames(p), [JAD]);

    // WALKING STRAIGHT BACK OUT PAYS NOTHING. Unguarded this is 62 * 63 = 3,906 Tokkul for
    // fighting nothing at all, which is more than half a real clear.
    const base = instanceBase(p)!;
    H.clearLogs();
    H.opLoc(p, base[0] + 44, base[1] + 62, 'loc_9357', 1);
    settle(p, 30);
    check('leaving a shortcut run pays no Tokkul', tokkul(p), 0);
    check('and puts the player outside', [p.x, p.z], OUTSIDE);
    check('and frees the instance', H.getVar(p, 'fightcave_instance'), NO_INSTANCE);
    H.despawn(p);
}

// ============================================================ 3b. the guard covers every exit
console.log('== and the payout guard covers dying, not just the door');
{
    // ~fightcave_pay is the one thing leaving, dying and killing Jad all do, which is why the
    // guard is in it rather than at the three call sites. Driven directly here because the third
    // exit - dying - is the one a sim cannot stage cheaply, and it is the same call.
    const a = player('paid');
    H.setVar(a, 'fightcave_jad_only', 0);
    runProtected(a, '[proc,fightcave_pay]', [JAD_WAVE - 1]);
    check('62 waves fought honestly pay for 62 waves', tokkul(a), (JAD_WAVE - 1) * JAD_WAVE);
    const b = player('unpaid');
    H.setVar(b, 'fightcave_jad_only', 1);
    runProtected(b, '[proc,fightcave_pay]', [JAD_WAVE - 1]);
    check('and a shortcut run pays none of it, however it ends', tokkul(b), 0);
    H.despawn(a, b);
}

// ============================================================ 4. the arena is multi-way
console.log('== the arena is multi-way, which is what makes the healers killable');
{
    // FOUND WHILE BUILDING THE SHORTCUT, and it is not the shortcut's bug: m37_79 was not in
    // maps/multiway.csv, so the cave was single-way. Jad's four Yt-HurKot healers walk up and
    // melee, and in a single-way area a healer touching the player is what refuses the player a
    // re-attack on anything else - GameMap.isMulti's own comment describes exactly this from
    // Zulrah's shrine. The healers could not be killed, so Jad was healed 40 a round by monsters
    // that were effectively invulnerable, which is not the fight the content describes. Before
    // the csv lines, the kill below ran 4000 ticks and left Jad above 100 hitpoints.
    const p = player('multicheck');
    runProtected(p, '[proc,collection_log_add]', [ObjType.getId('tzhaar_cape_fire'), 1]);
    enter(p);
    pickMenu(p, 2);
    settle(p, 30);
    const base = instanceBase(p)!;
    const tpl = CoordGrid.packCoord(0, 37 * 64 + 26, 79 * 64 + 31); // ^fightcave_spawn_c
    check('the template square is marked', World.gameMap.isMulti(tpl), true);
    // AND THE INSTANCE ANSWERS THROUGH IT. An instance sits past x 6400 where no map square
    // exists, so a csv line addressed to its own coordinates could never match - the lookup goes
    // back to the zone it was copied from, which is the whole reason marking the template works.
    check("and the player's own copy of it is multi-way too", World.gameMap.isMulti(CoordGrid.packCoord(0, base[0] + 26, base[1] + 31)), true);
    check('the cave the player is standing in, specifically', World.gameMap.isMulti(CoordGrid.packCoord(0, p.x, p.z)), true);
    H.despawn(p);
}

// ============================================================ 5. a real kill through the shortcut
console.log('== and killing Jad through it');
{
    const bystander = player('watcher');
    const p = player('jadslayer');
    runProtected(p, '[proc,collection_log_add]', [ObjType.getId('tzhaar_cape_fire'), 1]);
    H.equip(p, { rhand: 'abyssal_whip' });
    H.runProc(p, '[proc,player_combat_stat]');
    enter(p);
    pickMenu(p, 2);
    settle(p, 30);
    H.clearLogs();

    let ticks = 0;
    for (; ticks < 4000; ticks++) {
        const alive = monsters(p);
        if (!alive.length) break;
        // Healers first: four of them restoring 10 apiece will out-heal a whip, so whatever is
        // not Jad dies before Jad does.
        const target = alive.find(n => (NpcType.get(n.type).debugname ?? '') !== JAD) ?? alive[0];
        if (p.target !== target) H.attackNpc(p, target);
        H.tick(1);
        p.levels[PlayerStat.HITPOINTS] = p.baseLevels[PlayerStat.HITPOINTS]; // the player, and only the player
    }
    settle(p, 30);
    // On a failure this says what is still standing and on how much health, which is the only
    // useful thing to know: before the arena was multi-way it read "Jad on 109".
    const standing = monsters(p).map(n => `${NpcType.get(n.type).debugname} on ${n.levels[HP]}`);
    check(`the cave emptied, in ${ticks} ticks`, standing, []);
    check('and said Jad was beaten', said(p, 'defeated TzTok-Jad'), true);
    check('the cape is the reward', capes(p), 1);
    check(`and Jad's own ${JAD_TOKKUL} Tokkul, with nothing for the 62 skipped waves`, tokkul(p), JAD_TOKKUL);
    check('the run is over and the instance is gone', [wave(p), H.getVar(p, 'fightcave_instance')], [0, NO_INSTANCE]);

    // THE BROADCAST IS FOR THE RUN, NOT THE KILL. A shortcut kill is a couple of minutes, so it
    // keeps quiet - which is only observable from somebody else's chatbox.
    check('nobody else was told', H.mesgs.filter(m => m.who === bystander.username && m.text.includes('Fire cape!')).length, 0);
    H.despawn(p, bystander);
}

// ============================================================ 6. the full run is untouched
console.log('== and a full run still pays for its 62 waves');
{
    const bystander = player('watcher2');
    const p = player('purist');
    enter(p); // no unlock, so straight to wave 1
    settle(p, 30);
    // Stand the run where a real one would be after 62 waves: at Jad, entered the long way. Only
    // the two varps are moved - ~fightcave_finish does the rest exactly as the last kill would.
    H.setVar(p, 'fightcave_wave', JAD_WAVE);
    check('entered the long way, so not a shortcut run', jadOnly(p), 0);
    H.clearLogs();
    runProtected(p, '[proc,fightcave_finish]');
    settle(p, 30);
    check(`a full clear still pays ${FULL_RUN_TOKKUL}`, tokkul(p), FULL_RUN_TOKKUL);
    check('the cape too', capes(p), 1);
    check('and the world hears about it', H.mesgs.filter(m => m.who === bystander.username && m.text.includes('Fire cape!')).length, 1);
    H.despawn(p, bystander);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
