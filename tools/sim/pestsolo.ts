// Pest Control, solo - the whole game against the real engine and the real map.
// Usage: npx tsx tools/sim/pestsolo.ts   (exit code is the verdict)
//
// WHY THIS EXISTS. This one needed a sim more than anything else in the round. The island was one
// of three fully isolated map squares on the server - nothing had ever stood on it - so every
// coordinate in configs/pest_solo.constant is a tile nobody has ever walked, chosen by scanning the
// square's collision rather than by playing there. And the game is a timer, four npcs and a drain
// loop: a compile proves the script parses, not that the knight dies on schedule or that four
// portals actually appear where the scan said they would.
//
// It plays the game by hand: start it, check what spawned, kill portals with npc_damage, and run
// the clock out.
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import Component from '#/cache/config/Component.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const LUMBRIDGE = [3222, 3222];
let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const settle = (n = 1) => {
    for (let t = 0; t < n; t++) H.tick(1);
};

// H.runProc runs a proc UNPROTECTED and ~pest_solo_start writes varps and teleports, both of which
// the engine refuses without protected access. This is the two pointers a real trigger is given
// plus Player.protect, which is what the click handlers set. (Same helper as tools/sim/jewellery.ts
// - if a third sim needs it, it belongs in the harness.)
function runProtected(p: Player, name: string, args: unknown[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = p.protect;
    p.protect = true;
    const state = ScriptRunner.init(script, p, null, args as never[]);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    p.protect = was;
    return (state as unknown as { intStack: number[]; isp: number }).intStack.slice(0, (state as unknown as { isp: number }).isp);
}

/** Kill an npc by FIGHTING it, which is the only way that actually works and the better test.
 *
 * Two shortcuts were tried first and both are dead ends worth recording. applyDamage alone sets
 * hitpoints to 0, draws the splat and stops - nothing removes the npc. Calling [proc,npc_death]
 * directly does not finish either: it ends in npc_anim, npc_delay(1), npc_del, and a synchronously
 * executed script stops at the delay and never reaches the del.
 *
 * So the player attacks it. A portal cannot fight back (attack and strength are 1 in the OSRS
 * cache, and this build's config copies that), so this is safe, and it proves something the
 * shortcuts could not: that a portal is attackable at all - op2=Attack, real hitpoints, real
 * defence. The damage is dealt by hand to keep the tick count sane; the engine's own death path
 * does the rest.
 */
function killNpc(p: Player, npc: Npc): boolean {
    H.attackNpc(p, npc);
    for (let t = 0; t < 250; t++) {
        if (!npc.isActive) return true;
        if (npc.levels[3] > 1) npc.applyDamage(npc.levels[3] - 1, 1); // leave it on 1
        H.tick(1);
        if (!npc.isActive) return true;
        // one more point, delivered by the fight, is what runs the engine's death path
        if (!p.target) H.attackNpc(p, npc);
    }
    return !npc.isActive;
}

/** Click through any modal the content opened (a ~mesbox pauses on a button, like a menu does).
 *
 * This matters more than it looks: a NORMAL [timer,...] only runs while Player.canAccess() is
 * true, and canAccess is !protect && !busy, and busy() includes "has a modal open". So a sim that
 * starts the game and leaves its opening mesbox on screen freezes the game's own clock - which is
 * not what happens to a player, who clicks it away.
 */
function dismiss(p: Player) {
    for (let t = 0; t < 8; t++) {
        const st = p.activeScript;
        if (st && st.execution === ScriptState.PAUSEBUTTON) {
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            if (names.length) {
                p.lastCom = Component.getId(names[0]);
                p.executeScript(st, true, true);
                continue;
            }
        }
        if (!p.containsModalInterface()) return;
        p.closeModal();
        H.tick(1);
    }
}

/** Walk a dialogue to its question and answer it.
 *
 * A chat line (~chatnpc / ~chatplayer) and a question (~p_choiceN) both suspend on PAUSEBUTTON;
 * the difference is how many resume buttons there are. So this continues through the one-button
 * pauses and picks on the first multi-button one - which is what a player clicking through a
 * conversation does, and what [label,pest_buy] needs, because it says a line before it asks.
 */
function answer(p: Player, pick: number): boolean {
    for (let t = 0; t < 12; t++) {
        const st = p.activeScript;
        if (st && st.execution === ScriptState.PAUSEBUTTON) {
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            if (names.length > 1) {
                // Prefer the interface the modal itself is on, which is what a client clicks.
                const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
                const iface = names.find((n: string) => n.startsWith(open + ':'))?.split(':')[0];
                if (iface && H.choose(p, `${iface}:com_${pick}`)) return true;
                // FALLBACK: find the button whose own name ends in com_<pick>. A two-option
                // ~p_choice2 sits on a different chat interface from a five-option one, so
                // matching by the modal's name finds nothing for some of them - and "found no
                // interface" is not the same as "there was nothing to click".
                //
                // BY NAME, NOT BY POSITION: p.resumeButtons is not in option order, so taking
                // names[pick-1] clicked "Changed my mind" when it meant to confirm - the purchase
                // went through the dialogue and bought nothing, which is exactly the failure that
                // would look like a content bug.
                const byName = names.find((n: string) => n.endsWith(`:com_${pick}`));
                if (byName) return H.choose(p, byName);
            }
            if (names.length === 1) {
                p.lastCom = Component.getId(names[0]);
                p.executeScript(st, true, true);
                continue;
            }
            // A chat line's "click to continue" suspends with NO resume buttons at all and the
            // modal open - there is no button to press, so it is resumed directly. This is what
            // made ~chatnpc stall the first time: the diagnostic showed execution=PAUSEBUTTON,
            // resumeButtons=0, modalChat set.
            if (names.length === 0 && p.modalChat !== -1) {
                p.lastCom = p.modalChat;
                p.executeScript(st, true, true);
                continue;
            }
        }
        H.tick(1);
    }
    return false;
}

/** Every live npc inside this player's instance whose type name starts with `prefix`. */
function inGame(p: Player, prefix: string): Npc[] {
    const out: Npc[] = [];
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        const nm = NpcType.get(npc.type).debugname ?? '';
        if (!nm.startsWith(prefix)) continue;
        // Within 90 tiles of the player is "this player's instance": instance slots are 128 tiles
        // apart, and the island is 64 across, so nothing from the slot next door can qualify.
        if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > 90) continue;
        out.push(npc);
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
console.log('== the island, the knight and four portals');
let started: Player;
{
    const p = player('pest1');
    started = p;
    const from = H.mesgs.length;
    runProtected(p, '[proc,pest_solo_start]');
    settle(1);
    dismiss(p);
    settle(2);
    const inst = H.getVar(p, 'pest_solo_instance');
    // A coord-typed varp reads -1 when null, not 0 - which is worth stating because the obvious
    // guess costs a run to find out.
    check('an instance was built', inst !== -1, true);
    check('the player is on the island', p.x !== LUMBRIDGE[0] || p.z !== LUMBRIDGE[1], true);
    check('the clock is running', H.getVar(p, 'pest_solo_ticks') > 0, true);
    check('the knight has 200 hitpoints', H.getVar(p, 'pest_solo_knight_hp'), 200);
    // The opening line is a ~mesbox, which is a modal rather than a chat message and so never
    // lands in H.mesgs - an earlier version of this check asserted that an array's length was
    // >= 0, which is true of every array. What the start is actually meant to leave behind is a
    // player who is not still sitting in Lumbridge with a clock that never started, and those are
    // checked above. This asserts the one thing left: the timer is registered.
    check(
        'the tick timer is registered',
        [...(p as unknown as { timers: Map<number, { script?: { name?: string } }> }).timers.values()].some(t => t.script?.name === '[timer,pest_solo_tick]'),
        true
    );
    void from;

    const portals = inGame(p, 'pest_portal_');
    check('four portals spawned', portals.length, 4);
    const knights = inGame(p, 'pest_voidknight_control');
    check('one void knight spawned', knights.length, 1);

    // A portal has to be attackable, tough, harmless and still - all four are config, and all four
    // are things a typo would quietly undo.
    // THE STATS ARE READ OFF THE LIVE NPCS, not off NpcType: the decoded config does not expose
    // hitpoints/attack/defence as named fields (they read null), and what matters anyway is what
    // the engine actually loaded into the npc standing on the island. Npc.levels is indexed by
    // NpcStat: 0 attack, 1 defence, 2 strength, 3 hitpoints.
    for (const portal of portals) {
        const n = NpcType.get(portal.type).debugname ?? '?';
        // 50 and 10, not Old School's 250 and 120 - tuned for one player against the clock.
        // See configs/pest_solo.constant and content tools/genpeststats.py for the measurement.
        check(`${n}: 50 hitpoints and 10 defence`, [portal.levels[3], portal.levels[1]], [50, 10]);
        check(`${n}: cannot fight back`, [portal.levels[0], portal.levels[2]], [1, 1]);
        check(`${n}: op2 is Attack`, ((NpcType.get(portal.type) as unknown as Record<string, unknown>).op as string[])?.[1], 'Attack');
    }

    // The scan picked these tiles; this is the part no compile can check. Portal positions are
    // template-relative, so compare the offsets rather than the absolute coords.
    const base = [p.x - 35, p.z - 19]; // the landing is template 35,19
    const offsets = portals.map(n => `${n.x - base[0]},${n.z - base[1]}`).sort();
    check('portals are on the scanned tiles', offsets, ['10,55', '21,4', '54,51', '58,11'].sort());
    const k = knights[0];
    check('the knight is on his tile', `${k.x - base[0]},${k.z - base[1]}`, '32,22');
    check('the player landed 3 tiles from him', Math.max(Math.abs(p.x - k.x), Math.abs(p.z - k.z)), 3);
}

// ---------------------------------------------------------------------------------------------
console.log('== the knight drains while portals are open, and faster with more of them');
{
    const p = started;
    const before = H.getVar(p, 'pest_solo_knight_hp');
    // 36 ticks is three drains at the 12-tick interval, which is four portals x 3 = 12 hitpoints.
    settle(36);
    const after = H.getVar(p, 'pest_solo_knight_hp');
    check('he lost hitpoints', after < before, true);
    // 4 portals, one hitpoint each per 8 ticks: 40 ticks is 5 drains of 4 = 20.
    check('four portals cost him 12 over 36 ticks', before - after, 12);

    // Kill two portals; the drain should halve.
    const portals = inGame(p, 'pest_portal_');
    for (const portal of portals.slice(0, 2)) killNpc(p, portal);
    settle(2);
    check('two portals left', inGame(p, 'pest_portal_').length, 2);
    const mid = H.getVar(p, 'pest_solo_knight_hp');
    settle(36);
    check('two portals cost him 6 over 36 ticks', mid - H.getVar(p, 'pest_solo_knight_hp'), 6);
}

// ---------------------------------------------------------------------------------------------
console.log('== pests come out of the open portals, and stop when it closes');
{
    const p = started;
    settle(30);
    const pests = inGame(p, 'pest_');
    const monsters = pests.filter(n => {
        const nm = NpcType.get(n.type).debugname ?? '';
        return !nm.startsWith('pest_portal') && !nm.startsWith('pest_voidknight');
    });
    check('pests spawned', monsters.length > 0, true);
    // The cap is enforced when a pest SPAWNS, not by despawning one later, so pests outlive the
    // portal that produced them. The ceiling is therefore 2 per portal that has ever been open in
    // this game, which is all four.
    check('never more than 2 per portal ever opened', monsters.length <= 8, true);
    const families = [...new Set(monsters.map(n => (NpcType.get(n.type).debugname ?? '').replace(/_\d[ab]?$/, '')))];
    check(
        'they are pest families',
        families.every(f => ['pest_shifter', 'pest_torcher', 'pest_defiler', 'pest_splatter'].includes(f)),
        true
    );
    // Every pest has combat stats, which is the whole of content tools/genpeststats.py: all 54
    // records had full art, animations and vislevels and not one combat stat before this round.
    check(
        'every pest has hitpoints',
        monsters.every(n => n.levels[3] > 0),
        true
    );
    check(
        'every pest has a defence level',
        monsters.every(n => n.levels[1] > 0),
        true
    );
}

// ---------------------------------------------------------------------------------------------
console.log('== killing the last portal wins, and pays commendation points');
{
    const p = started;
    const pts = H.getVar(p, 'pest_commendation');
    // Set the knight's hitpoints so the bonus is deterministic: the earlier drain checks have
    // already taken him below the threshold, and "3 or 4" is not an assertion.
    H.setVar(p, 'pest_solo_knight_hp', 200);
    for (const portal of inGame(p, 'pest_portal_')) killNpc(p, portal);
    // npc_death ends in npc_anim, npc_delay(1), npc_del, so a portal is still in the world for a
    // tick or two after the killing blow. Wait for it to actually go before judging the win.
    for (let t = 0; t < 60 && inGame(p, 'pest_portal_').length > 0; t++) H.tick(1);
    check('every portal is gone', inGame(p, 'pest_portal_').length, 0);
    settle(6);
    dismiss(p);
    settle(2);
    check('the game ended', H.getVar(p, 'pest_solo_instance'), -1);
    check('the player is off the island', Math.abs(p.x - 2659) < 40 || Math.abs(p.z - 2644) < 40, true);
    const won = H.getVar(p, 'pest_commendation') - pts;
    // 3 for the win plus 1 for bringing the knight out above half.
    check('points paid, with the healthy-knight bonus', won, 4);
    check('the clock was cleared', H.getVar(p, 'pest_solo_ticks'), 0);
}

// ---------------------------------------------------------------------------------------------
console.log('== doing nothing loses, before the clock runs out');
{
    const p = player('pest2');
    runProtected(p, '[proc,pest_solo_start]');
    settle(1);
    dismiss(p);
    settle(2);
    check('started', H.getVar(p, 'pest_solo_instance') !== -1, true);
    const pts = H.getVar(p, 'pest_commendation');
    // 4 portals x 1 hitpoint every 12 ticks is a third of a hitpoint a tick, so 200 of them are
    // gone in 600 - before the 800-tick clock. This is the arithmetic
    // configs/pest_solo.constant claims, checked rather than trusted.
    let ended = -1;
    for (let t = 1; t <= 820; t++) {
        H.tick(1);
        dismiss(p);
        if (H.getVar(p, 'pest_solo_instance') === -1) {
            ended = t;
            break;
        }
    }
    check('the game ended on its own', ended > 0, true);
    check('it ended on the knight, around tick 600', ended >= 580 && ended <= 620 ? true : ended, true);
    check('no points for a loss', H.getVar(p, 'pest_commendation'), pts);
}

// ---------------------------------------------------------------------------------------------
console.log('== the combat level gate and the exchange');
{
    const p = player('pest3');
    for (const [, stat] of [
        ['ATTACK', PlayerStat.ATTACK],
        ['STRENGTH', PlayerStat.STRENGTH],
        ['DEFENCE', PlayerStat.DEFENCE],
        ['HITPOINTS', PlayerStat.HITPOINTS],
        ['RANGED', PlayerStat.RANGED],
        ['MAGIC', PlayerStat.MAGIC],
        ['PRAYER', PlayerStat.PRAYER]
    ] as [string, number][]) {
        p.setLevel(stat, 1);
    }
    p.setLevel(PlayerStat.HITPOINTS, 10);
    const from = H.mesgs.length;
    runProtected(p, '[proc,pest_solo_start]');
    settle(2);
    check('a low-level player is refused', H.getVar(p, 'pest_solo_instance'), -1);
    void from;
}
{
    // THE EXCHANGE, THROUGH THE REAL NPC. Calling [label,pest_buy] directly does not work from a
    // sim: ~chatplayer suspends on a button, and a script run straight through ScriptRunner never
    // registers that pause on the player, so there is nothing to answer. Clicking op3 on an actual
    // Void Knight goes through OpNpcHandler like a client does, which is also the wiring worth
    // testing - op3=Exchange on all four knights was a dead option until this round.
    const p = player('pest4');
    p.teleport(2660, 2644, 0); // the outpost, where the four knights stand
    settle(4);
    const knight = H.npcNear('pest_voidknight_1', p.x, p.z, 0);
    check('a Void Knight is on the outpost', knight !== null, true);
    if (knight) {
        p.teleport(knight.x + 1, knight.z, 0);
        settle(3);
        H.setVar(p, 'pest_commendation', 400);
        check('op3 was accepted', H.opNpc(p, knight, 3), true);
        settle(2);
        // THREE dialogue steps, not two: "You have 400 commendation points." is a line to click
        // through, then the five-row shelf, then the confirmation. Option 1 is the right answer at
        // every one of them - the 250 top on the shelf, "Yes, 250 points." on the confirmation -
        // so this walks until the purchase lands rather than counting the steps.
        let bought = false;
        for (let step = 0; step < 6 && !bought; step++) {
            answer(p, 1);
            settle(2);
            bought = H.invCount(p, 'void_knight_top') === 1;
        }
        check('the top was handed over', H.invCount(p, 'void_knight_top'), 1);
        check('250 points were taken', H.getVar(p, 'pest_commendation'), 150);
    }
    void InvType;
    void ObjType;
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad === 0 ? 0 : 1);
