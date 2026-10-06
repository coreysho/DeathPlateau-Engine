// THE TWO RANDOM EVENTS THIS ROUND ADDED, and the setting that now survives a logout.
//
//   npx tsx tools/sim/randomevents.ts
//
// content/tools/randomevents.py counts 2006scape's list against the content and says what is in;
// this is the half that cannot be read off a file - whether the two new ones actually happen.
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ObjType from '#/cache/config/ObjType.js';
import * as A from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import EnumType from '#/cache/config/EnumType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import SeqType from '#/cache/config/SeqType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import LocType from '#/cache/config/LocType.js';

// H.npcNear searches the WHOLE WORLD for the nearest npc of a type, with no radius - so a check
// that simply asks "is there a Niles?" answers yes for one standing in another kingdom. Every spawn
// test here wants the one that just appeared beside the player.
/** What Dr Ford is asking this player for: his own %npc_int2, through the enum he picked it from. */
const wanted = (npc: any): string => {
    const slot = npc.vars[VarNpcType.getByName('npc_int2')!.id];
    const id = EnumType.get(EnumType.getId('macro_dr_ford_wants')).values.get(slot) as number;
    return ObjType.get(id).debugname!;
};

/** Talk to THIS npc, not to the nearest one of its type in the world, which is what a1lib's talk
 * does - and which walked the player away from their own event to a Rick Turpentine standing
 * somewhere else entirely, where the click said nothing at all. */
const talkToThis = (p: any, npc: any, picks: (number | string)[] = []): string[] => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return A.drive(p, picks);
};

const nearby = (name: string, p: any, within = 6) => {
    const npc = H.npcNear(name, p.x, p.z, p.level);
    if (!npc) return null;
    return Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= within ? npc : null;
};

let badCoins = 0;
const check0 = (ok: boolean, got: number) => { if (!ok) { badCoins++; console.log(`       coins out of range: ${got}`); } };

/** Run a proc the way a click does, so a p_delay inside it is resumed instead of abandoned. */
function runToEnd(p: any, name: string, ticks = 8) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p), true);
    for (let i = 0; i < ticks && (p.activeScript || p.delayed); i++) H.tick(1);
    H.tick(1);
}

await H.boot();

// ============================================================ auto retaliate survives a logout
console.log('AUTO RETALIATE IS REMEMBERED');
{
    // The whole of the fix is the varp's scope: it had none, a varp with none defaults to temp, and
    // every login turned the setting back on. Asserted against the packed cache rather than the
    // source line, so a config that fails to pack cannot pass this.
    const nodef = VarPlayerType.getByName('option_nodef')!;
    check('the setting is a varp the client is told about', nodef.transmit, true);
    check('  ...and it is saved rather than dropped at logout', nodef.scope, VarPlayerType.SCOPE_PERM);

    // and the button still flips it, both ways, without needing protected access
    const p: any = player('retaliate', 3222, 3222);
    H.setVar(p, 'option_nodef', 0);
    H.runProc(p, '[proc,toggle_auto_retaliate]');
    check('the button turns it off', H.getVar(p, 'option_nodef'), 1);
    H.runProc(p, '[proc,toggle_auto_retaliate]');
    check('  ...and on again', H.getVar(p, 'option_nodef'), 0);
}

// ============================================================================ the spade breaks
console.log('');
console.log('A SPADE BREAKS WHILE FARMING, AND GOES BACK TOGETHER');
{
    const p: any = player('spadebreak', 3222, 3222);
    H.clearInv(p);
    H.give(p, 'spade', 1);
    const from = mark();
    // THROUGH executeScript, NOT runProc. The event ends on p_delay while the head is still in the
    // air - runProc calls ScriptRunner.execute directly and nothing ever resumes the suspended
    // script, so the obj_add at the end of it never happens and the head never lands.
    runToEnd(p, '[proc,macro_event_lost_spade_spawn]');
    const said = mesSince(p, from);
    check('the spade comes apart in your hands', [H.invCount(p, 'spade'), H.invCount(p, 'spade_handle')], [0, 1]);
    check('  ...and says so', said.some(m => m === 'You dig into the soil.'), true);

    // the head is on the ground somewhere near, which is the half a player has to go and fetch
    const headId = ObjType.getId('spade_head');
    let onFloor = false;
    for (let dx = -8; dx <= 8 && !onFloor; dx++) {
        for (let dz = -8; dz <= 8 && !onFloor; dz++) {
            if (World.getObj(p.x + dx, p.z + dz, p.level, headId, p.hash64)) onFloor = true;
        }
    }
    check('  ...and the head lands on the floor nearby', onFloor, true);

    H.give(p, 'spade_head', 1);
    const from2 = mark();
    H.useHeldOn(p, 'spade_head', 'spade_handle');
    check('using the two together rebuilds the spade',
        [H.invCount(p, 'spade'), H.invCount(p, 'spade_handle'), H.invCount(p, 'spade_head')], [1, 0, 0]);
    check('  ...and either way round', mesSince(p, from2).some(m => m.startsWith('You carefully attach')), true);

    // the other way round, which is the half that used to be missed
    H.clearInv(p);
    H.give(p, 'spade_handle', 1);
    H.give(p, 'spade_head', 1);
    H.useHeldOn(p, 'spade_handle', 'spade_head');
    check('  ...including handle onto head', H.invCount(p, 'spade'), 1);

    // NO SPADE, NO BREAK. The roll falls through to a general event instead of taking apart a tool
    // you were not using - a farmer raking a patch has no spade in hand.
    H.clearInv(p);
    runToEnd(p, '[proc,macro_event_lost_spade_spawn]');
    check('with no spade it takes nothing apart', H.invCount(p, 'spade_handle'), 0);
}

// =========================================================================== the Evil Chicken
console.log('');
console.log('AN EVIL CHICKEN TURNS UP AND MEANS IT');
{
    const p: any = player('evilchicken', 3222, 3226);
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [6]); // ^macro_evil_chicken
    H.tick(2);

    const chicken = H.npcNear('macro_evil_chicken_6', p.x, p.z, p.level);
    check('one spawns beside you', chicken !== null, true);
    if (chicken) {
        const t = NpcType.get(chicken.type);
        check('  ...at the bracket for a maxed player', t.debugname, 'macro_evil_chicken_6');
        check('  ...and it is something you can fight', [t.vislevel, t.stats[NpcStat.HITPOINTS]], [159, 170]);
    }
    check('  ...and it is the one holding you, so the PJ timer knows', H.getVar(p, 'aggressive_npc') !== 0, true);
}

console.log('');
// ============================================================== Call follower, on the equipment tab
console.log('');
console.log('CALL FOLLOWER BRINGS THE PET TO YOU');
{
    const p: any = player('callpet', 3230, 3222);
    H.clearInv(p);
    const from0 = mark();
    H.runProc(p, '[proc,call_follower]');
    check('with no pet out it says so', mesSince(p, from0).join(' | '), "You don't have a follower.");

    H.give(p, 'bosspet_kbd_item', 1);
    H.opheld(p, 'bosspet_kbd_item', 5);
    H.tick(2);
    const pet = H.followerOf(p);
    check('the pet is out', pet !== null, true);

    // STRAND IT SOMEWHERE IT CANNOT WALK BACK FROM, but close enough and on the same floor that
    // ~follower_keepup will not fetch it - which is the whole gap this button fills.
    pet!.teleport(p.x + 4, p.z + 4, p.level);
    H.tick(1);
    const away = Math.max(Math.abs(pet!.x - p.x), Math.abs(pet!.z - p.z));
    const from = mark();
    H.runProc(p, '[proc,call_follower]');
    H.tick(1);
    const near = Math.max(Math.abs(pet!.x - p.x), Math.abs(pet!.z - p.z));
    check('calling it brings it to your feet', [away > 1, near <= 1], [true, true]);
    check('  ...and says so', mesSince(p, from).join(' | '), 'You call your follower.');
    check('  ...and it is following again, not standing there', pet!.targetOp, NpcMode.PLAYERFOLLOW);
}


// ======================================================= the four talking randoms this round added
console.log('');
console.log('FOUR PEOPLE WALK UP AND TALK TO YOU');
{
    // The ids in macro_events.constant: 7 Rick Turpentine, 8 Cap'n Hand, 9 a certer, 10 Dr Ford.
    const EVENTS: [number, string, string][] = [
        [7, 'macro_highwayman', 'Rick Turpentine'],
        [8, 'macro_pirate', "Cap'n Hand"],
        [10, 'macro_doctor', 'Dr Ford']
    ];
    for (const [id, npcName, who] of EVENTS) {
        const p: any = player(`talk${id}`, 3222 + id, 3230, 0);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [id]);
        H.tick(2);
        const npc = nearby(npcName, p);
        check(`${who} turns up`, npc !== null, true);
        if (!npc) continue;
        check('  ...and comes to you rather than wandering off', npc.targetOp, NpcMode.PLAYERFOLLOW);
    }

    // A CERTER IS ONE OF THREE BROTHERS, so the check is that it is one of them rather than which.
    const p: any = player('talkcerter', 3240, 3230, 0);
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [9]);
    H.tick(2);
    const brothers = ['macro_niles', 'macro_miles', 'macro_giles']
        .map(n => nearby(n, p)).filter(Boolean);
    check('one of the three certers turns up', brothers.length, 1);
}

// ============================================================== the shared random event drop table
console.log('');
console.log('AND THEY ALL PAY FROM ONE TABLE');
{
    const p: any = player('eventloot', 3250, 3230, 0);
    const seen = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
        const out = H.runProc(p, '[proc,macro_event_reward]');
        const [item, count] = out.slice(-2);
        const n = ObjType.get(item).debugname ?? String(item);
        seen.set(n, (seen.get(n) ?? 0) + 1);
        if (n === 'coins') check0(count >= 80 && count <= 640, count);
    }
    console.log(`       ${[...seen].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${(c / 60).toFixed(1)}%`).join(', ')}`);
    check('every branch of the table is reachable', [...seen.keys()].sort(),
        ['coins', 'cosmic_talisman', 'kebab', 'keyhalf1', 'keyhalf2', 'spinach_roll',
            'uncut_diamond', 'uncut_emerald', 'uncut_ruby', 'uncut_sapphire'].sort());
    const pct = (n: string) => (seen.get(n) ?? 0) / 60;
    check('  ...a third of it is coins, and the gems thin out in order',
        pct('coins') > 32 && pct('coins') < 42
        && pct('uncut_sapphire') > pct('uncut_emerald')
        && pct('uncut_emerald') > pct('uncut_ruby')
        && pct('uncut_ruby') > pct('uncut_diamond'), true);
    check('  ...and no coin drop is outside 80-640', badCoins, 0);
}

// ================================================== a members event never lands on a free world
console.log('');
console.log('AND EVERY ID THE ROLL CAN GIVE HAS AN NPC BEHIND IT');
{
    // Both tables have holes in them now - 5 and 6 are members' - which is the whole reason the
    // _pick enums exist: the roll used to be 1..count over the npc table, which required the ids to
    // run with no gaps. This world is a members one, so what it proves is that the roll and the npc
    // lookup agree; the free table's own holes are read straight out of general_macro_events_free.
    const free: number[] = [];
    const p: any = player('freeroll', 3260, 3230, 0);
    for (let i = 0; i < 400; i++) free.push(H.runProc(p, '[proc,macro_event_set_random]')[0]);
    const kinds = [...new Set(free)].sort((a, b) => a - b);
    console.log(`       400 rolls gave ids ${kinds.join(', ')} (members world)`);
    check('every id rolled is one the world has an npc for',
        kinds.every(id => H.runProc(p, '[proc,macro_event_npc]', [id])[0] > 0), true);
}


// ============================================== and talking to them is what actually pays out
console.log('');
console.log('AND TALKING TO THEM IS THE POINT');
{
    const invCount = (p: any) => {
        const inv = p.getInventory(InvType.INV)!;
        let n = 0;
        for (let k = 0; k < inv.capacity; k++) if (inv.get(k)) n++;
        return n;
    };

    // RICK TURPENTINE pays off the shared table for nothing but the courtesy of a reply.
    {
        const p: any = player('rickchat', 3222, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [7]);
        H.tick(2);
        // NOT ASSERTED ON WHAT HE SAYS. drive() collects the chat from the SECOND page on - the page
        // the click itself opens is already gone by the time it starts - and Rick's whole dialogue is
        // one page, so there is nothing to read. What he DOES is the thing worth checking anyway.
        const rick = nearby('macro_highwayman', p)!;
        talkToThis(p, rick);
        check('Rick Turpentine hands something over', invCount(p) > 0, true);
        // And only once: the done marker is what stops him being a tap you can turn on again.
        const after = invCount(p);
        talkToThis(p, rick);
        check('  ...and not twice', invCount(p), after);
    }

    // DR FORD, both ways: he takes the thing he asked for, and leaves quietly when you have none.
    {
        const p: any = player('fordchat', 3232, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [10]);
        H.tick(2);
        const empty = talkToThis(p, nearby('macro_doctor', p)!);
        check('Dr Ford takes no for an answer', empty.some(m => m.includes('Thank you anyway')), true);
        check('  ...and goes away empty-handed when you have none', invCount(p), 0);
    }
    {
        const p: any = player('fordgive', 3236, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [10]);
        H.tick(2);
        const npc = nearby('macro_doctor', p, 8)!;
        // HE SETTLES ON WHAT HE WANTS AT SPAWN and keeps it in %npc_int2, so he asks for the same
        // thing every time you click him rather than a fresh one. That is also how this test knows
        // what to carry - reading the npc's own var instead of guessing from the list.
        const wants = wanted(npc);
        H.give(p, wants, 1);
        const before = invCount(p);
        const said = talkToThis(p, npc);
        check('given what he asked for, Dr Ford takes it', H.invCount(p, wants), 0);
        check('  ...and pays for it', said.some(m => m.includes('Marvellous')), true);
        check('  ...so you are no worse off', invCount(p) >= before, true);
    }
}


// ===================================================== the sandwich lady, her tray and her baguette
console.log('');
console.log('THE SANDWICH LADY OFFERS YOU ONE THING AND MEANS IT');
{
    const FOODS = ['baguette', 'triangle_sandwich', 'square_sandwich', 'chocolate_bar',
        'kebab', 'roll', 'meat_pie'];
    const KO = SeqType.getId('macro_sandwich_lady_knockout');

    // THE TRAY, read back out of the script rather than out of the file it was written in. slot(7)
    // is off the end of a seven-slot tray and has to answer null, because multiobj7 would otherwise
    // be handed a component id of 0.
    {
        const p: any = player('tray', 3270, 3230, 0);
        const got: string[] = [];
        for (let i = 0; i < 7; i++) {
            const out = H.runProc(p, '[proc,macro_sandwich_lady_slot]', [i]);
            got.push(ObjType.get(out[0]).debugname!);
        }
        check('seven foods on the tray, in her order', got, FOODS);
        check('  ...and nothing past the seventh', H.runProc(p, '[proc,macro_sandwich_lady_slot]', [7])[0], -1);
    }

    // THE INTERFACE EXISTS AND HAS THE COMPONENTS THE PROC ADDRESSES. multiobj7 is new, and a .if
    // and a pack that disagree would only show up as a throw the first time somebody met her.
    for (let i = 0; i <= 16; i++) {
        if (Component.getId(`multiobj7:com_${i}`) === -1) {
            check(`multiobj7:com_${i} is in the pack`, false, true);
        }
    }
    check('multiobj7 is built: 7 models, 7 labels, a title and two swords', true, true);

    // HER KNOCKOUT IS THE CACHE'S OWN, not something written here: human_death's frames with a
    // shorter hold at the end. If that ever stops being true the comment in her script is wrong.
    {
        const ko = SeqType.get(KO);
        const death = SeqType.get(SeqType.getId('human_death'));
        check('she knocks you out with a seq out of the cache, not one written here', ko.frames.join(','), death.frames.join(','));
        check('  ...held for less time than a death', ko.delay[ko.delay.length - 1] < death.delay[death.delay.length - 1], true);
    }

    /** Click her, then take slot $slot off the tray - or close it, with slot -1. Returns where the
     * player stood when the tray opened, so "did she teleport you" is measured from there rather
     * than from where they logged in: getting next to her to click her is itself a move.
     *
     * Which modal is open is what says the tray is up. The resume buttons do NOT clear when it
     * closes - the page of dialogue after it still lists multiobj7s - so a test that went by those
     * would answer the next question by clicking a sandwich. */
    const takeFromTray = (p: any, npc: any, slot: number): { x: number; z: number } => {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.teleport(npc.x + dx, npc.z + dz, npc.level);
            H.tick(1);
            H.opNpc(p, npc, 1);
            for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
            if (p.activeScript) break;
        }
        const stood = { x: p.x, z: p.z };
        const tray = Component.getId('multiobj7');
        let opened = false;
        for (let guard = 0; guard < 60; guard++) {
            const s = p.activeScript;
            if (s && s.execution === ScriptState.PAUSEBUTTON) {
                if (p.modalChat === tray) {
                    opened = true;
                    // last_com of -1 is what closing the tray without choosing leaves behind, and
                    // multiobj7 answers that with null.
                    if (slot < 0) { p.lastCom = -1; p.executeScript(s, true, true); }
                    else if (!H.choose(p, `multiobj7:com_${2 + slot}`)) throw new Error('the tray would not take a click');
                } else {
                    p.executeScript(s, true, true);
                }
                continue;
            }
            if (!s && !p.delayed && [...p.queue.all()].length === 0) break;
            H.tick(1);
        }
        // Without this, a tray that never opened would make every outcome below pass by default.
        if (!opened) throw new Error('the tray never opened');
        return stood;
    };

    /** The slot she decided on at spawn, read off her own var the way Dr Ford's is. */
    const offered = (npc: any): number => npc.vars[VarNpcType.getByName('npc_int2')!.id];

    // TAKE THE RIGHT ONE and you get it - exactly it, and nothing else.
    {
        const p: any = player('sandwichok', 3270, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [11]);
        H.tick(2);
        const lady = nearby('macro_sandwich_lady_npc', p);
        check('the sandwich lady turns up', lady !== null, true);
        if (lady) {
            check('  ...and comes to you rather than wandering off', lady.targetOp, NpcMode.PLAYERFOLLOW);
            const slot = offered(lady);
            const was = takeFromTray(p, lady, slot);
            check('  ...taking the one she offered gets you it', H.invCount(p, FOODS[slot]), 1);
            const others = FOODS.filter((_, i) => i !== slot).reduce((n, f) => n + H.invCount(p, f), 0);
            check('  ...and only it', others, 0);
            for (let i = 0; i < 12; i++) H.tick(1);
            check('  ...and she does not teleport you anywhere', [p.x, p.z], [was.x, was.z]);
            check('  ...and does not knock you down either', H.anims.some(a => a.who === p.username && a.seq === KO), false);
        }
    }

    // TAKE THE WRONG ONE and she baguettes you across the map. Nothing is taken from you.
    {
        const p: any = player('sandwichbad', 3280, 3240, 0);
        H.clearInv(p);
        H.give(p, 'coins', 5000);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [11]);
        H.tick(2);
        const lady = nearby('macro_sandwich_lady_npc', p)!;
        const slot = offered(lady);
        const wrong = (slot + 3) % 7;
        const was = takeFromTray(p, lady, wrong);
        check('she calls you a thief', H.saysFor('macro_sandwich_lady_npc')
            .some(s => s.text.includes('Thief! Thief! Thief!')), true);
        check('  ...and knocks you down, with the seq the cache keeps for it',
            H.anims.some(a => a.who === p.username && a.seq === KO), true);
        for (let i = 0; i < 12; i++) H.tick(1);
        check('  ...and you wake up somewhere else', Math.abs(p.x - was.x) + Math.abs(p.z - was.z) > 20, true);
        check('  ...with your coins still on you', H.invCount(p, 'coins'), 5000);
        check('  ...and none of her food', FOODS.reduce((n, f) => n + H.invCount(p, f), 0), 0);
    }

    // WALK AWAY FROM THE TRAY and she is not robbed, so nothing happens to you at all.
    {
        const p: any = player('sandwichshut', 3290, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [11]);
        H.tick(2);
        const lady = nearby('macro_sandwich_lady_npc', p)!;
        const was = takeFromTray(p, lady, -1);
        for (let i = 0; i < 12; i++) H.tick(1);
        check('closing the tray is not stealing', [p.x, p.z], [was.x, was.z]);
        check('  ...and you get nothing', FOODS.reduce((n, f) => n + H.invCount(p, f), 0), 0);
    }
}

// ============================================== Leo's cemetery: the first random event with a place
console.log('');
console.log('THE GRAVEDIGGER PUTS FIVE COFFINS IN THE WRONG HOLES');
{
    // The room was built long before this script: five graves, five headstones two tiles north of
    // them, a mausoleum and Leo, in map square 30_78. These are the tiles the map puts them on, read
    // off tools/sim/roommap.ts, and a check that they are still there is the first thing worth
    // making - the event is a script hung on a room somebody else placed.
    const GRAVE: [number, number, string][] = [
        [1924, 4996, 'loc_12721'], [1926, 4999, 'loc_12722'], [1928, 4996, 'loc_12723'],
        [1930, 4999, 'loc_12724'], [1932, 4996, 'loc_12725']
    ];
    const STONE: [number, number, string][] = [
        [1924, 4998, 'loc_12716'], [1926, 5001, 'loc_12717'], [1928, 4998, 'loc_12718'],
        [1930, 5001, 'loc_12719'], [1932, 4998, 'loc_12720']
    ];
    // A grave is two tiles long and forceapproach=south, so the player has to be standing on the
    // tile below it before the click will take. Walking there would work too and takes thirty ticks
    // a grave; this is the same shortcut talkToThis uses.
    const atGrave = (p: any, i: number) => {
        p.teleport(GRAVE[i][0], GRAVE[i][1] - 1, 0);
        H.tick(1);
    };
    // TICK UNTIL THE PLAYER IS ACTUALLY FREE, queue included. A fixed number of ticks and then one
    // more is not enough here: the arrival is a queued script with a delay in it, so the first click
    // landed while the player was still being dragged to the graveyard and every click after it was
    // one behind - which read as "only some of the graves open".
    const settle = (p: any) => {
        for (let t = 0; t < 40; t++) {
            // t < 2 because a click does nothing on the tick it is made: opLoc only sets the
            // interaction, and a settle that returned straight away measured the state before
            // anything had happened. Then wait for the player to be free of it - target included,
            // or an interaction that takes a step first is read as finished.
            if (t >= 2 && !p.activeScript && !p.delayed && !p.target
                && [...p.queue.all()].length === 0) return;
            H.tick(1);
        }
        throw new Error('the player never became idle');
    };
    const grave = (p: any, i: number) => H.getVarBit(p, `macro_digger_grave_${i + 1}`);
    const wants = (p: any, i: number) => H.getVarBit(p, `macro_digger_coffin_${i + 1}`);
    const coffinObj = (trade: number) => `macro_digger_coffin_object_${trade}`;

    {
        const missing = [...GRAVE, ...STONE].filter(([x, z, name]) =>
            !World.getLoc(x, z, 0, LocType.getId(name)));
        check('the cemetery is still where the map put it', missing.map(m => m[2]), []);
        check('  ...and the mausoleum with it',
            World.getLoc(1927, 5004, 0, LocType.getId('loc_12731')) !== null, true);
    }

    // THE ARRANGEMENT. Five headstones get a shuffle of the five trades and the five graves get
    // another, and the second is rotated if it came out matching - a cemetery that is already
    // finished is an event the player wins by standing still.
    // The arrival is queued rather than done in the spawn proc - p_teleport needs protected access
    // and [timer,general_macro_events] has none - so the ticks after it are part of starting.
    const started = (p: any) => {
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [12]);
        settle(p);
    };
    {
        const p: any = player('digger', 3222, 3250, 0);
        H.clearInv(p);
        started(p);
        check('Leo takes you to his graveyard', [p.x, p.z, p.level], [1929, 5003, 0]);
        check('  ...and Leo is there when you arrive', nearby('macro_gravedigger', p, 8) !== null, true);
        const held = [0, 1, 2, 3, 4].map(i => grave(p, i));
        const asked = [0, 1, 2, 3, 4].map(i => wants(p, i));
        check('every grave starts with a coffin in it', held.filter(v => v >= 1 && v <= 5).length, 5);
        check('  ...one of each trade', [...held].sort().join(','), '1,2,3,4,5');
        check('  ...and every headstone asks for a different one', [...asked].sort().join(','), '1,2,3,4,5');
        check('  ...and it is never finished already', held.join(',') !== asked.join(','), true);
    }

    // SHUFFLED, not dealt in an order. 200 cemeteries; if the headstones came out the same way twice
    // in a row the puzzle would be the same puzzle every time.
    {
        const p: any = player('diggerroll', 3226, 3250, 0);
        const seen = new Set<string>();
        for (let i = 0; i < 200; i++) {
            H.runProc(p, '[proc,macro_digger_setup]');
            seen.add([0, 1, 2, 3, 4].map(k => wants(p, k)).join(''));
            const solved = [0, 1, 2, 3, 4].every(k => grave(p, k) === wants(p, k));
            if (solved) check('a cemetery came out already finished', false, true);
        }
        console.log(`       200 cemeteries gave ${seen.size} different headstone orders`);
        check('the headstones are shuffled, not dealt', seen.size > 60, true);
    }

    // DIGGING. Take-Coffin empties the grave and hands you the coffin of whatever was in it; using
    // that coffin on an empty hole puts it back.
    {
        const p: any = player('diggerdig', 3230, 3250, 0);
        H.clearInv(p);
        started(p);
        const was = [0, 1, 2, 3, 4].map(i => grave(p, i));

        // The loc on the tile never changes: what changes is the varbit the client draws it through.
        // A loc_change here would have been visible to everyone else in the cemetery.
        const typeBefore = World.getLoc(GRAVE[0][0], GRAVE[0][1], 0, LocType.getId(GRAVE[0][2]))!.type;
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            H.opLoc(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], 1);
            settle(p);
        }
        check('all five coffins come out', [0, 1, 2, 3, 4].map(i => grave(p, i)), [0, 0, 0, 0, 0]);
        check('  ...and you are carrying them',
            was.map(trade => H.invCount(p, coffinObj(trade))), [1, 1, 1, 1, 1]);
        check('  ...and the grave on the tile is the same loc it always was',
            World.getLoc(GRAVE[0][0], GRAVE[0][1], 0, LocType.getId(GRAVE[0][2]))!.type, typeBefore);

        // CHECK is the only way to tell two coffins apart: every grave good is called "Item" and
        // examines as "It seems bleached with age".
        // Check opens a window and leaves it open, so this reads the inv and then shuts it - the
        // next coffin cannot be checked with the last one's lid still up.
        const inside = (trade: number): string[] => {
            H.opheld(p, coffinObj(trade), 1);
            for (let i = 0; i < 4; i++) H.tick(1);
            check(`  the window opens for coffin ${trade}`, p.modalMain, Component.getId('macro_digger_coffin'));
            const inv = p.getInventory(InvType.getId('macro_digger_coffin_inv'))!;
            const out: string[] = [];
            for (let k = 0; k < inv.capacity; k++) {
                const o = inv.get(k);
                if (o) out.push(ObjType.get(o.id).debugname!);
            }
            p.closeModal();
            H.tick(1);
            return out;
        };
        const cook = inside(1);
        check("the cook's coffin holds the cook's things", cook,
            ['macro_digger_skull', 'macro_digger_bones', 'macro_digger_chefshat',
                'macro_digger_apron', 'macro_digger_cake', 'macro_digger_kebab']);
        const miner = inside(4);
        check('  ...and the miner holds his own, not the cook’s', miner,
            ['macro_digger_skull', 'macro_digger_bones', 'macro_digger_pick_axe', 'macro_digger_nuggets']);
        // Every trade's coffin, and no item in two of them: the goods are what identifies a coffin,
        // so a good that turns up twice makes two coffins impossible to tell apart.
        const all = [1, 2, 3, 4, 5].map(inside);
        const goods = all.flat().filter(n => n !== 'macro_digger_skull' && n !== 'macro_digger_bones');
        check('  ...and no grave good is in two coffins', goods.length, new Set(goods).size);
        check('  ...with a body in every one of them',
            all.every(c => c[0] === 'macro_digger_skull' && c[1] === 'macro_digger_bones'), true);

        // PUTTING THEM BACK. Each coffin into the grave whose headstone asks for it.
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            A.useOn(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], coffinObj(wants(p, i)));
            settle(p);
        }
        check('every coffin goes where its headstone asks',
            [0, 1, 2, 3, 4].map(i => grave(p, i)), [0, 1, 2, 3, 4].map(i => wants(p, i)));
        check('  ...and none are left in your pack',
            [1, 2, 3, 4, 5].reduce((n, trade) => n + H.invCount(p, coffinObj(trade)), 0), 0);
        check('  ...so Leo calls it done', H.runProc(p, '[proc,macro_digger_done]')[0], 1);

        // AND LEO PAYS. Two things off the zombie list, and home.
        const before = H.invCount(p, 'macro_digger_mask') + H.invCount(p, 'macro_digger_shirt')
            + H.invCount(p, 'macro_digger_legs') + H.invCount(p, 'macro_digger_gloves')
            + H.invCount(p, 'macro_digger_boots');
        talkToThis(p, nearby('macro_gravedigger', p, 10)!);
        for (let t = 0; t < 10; t++) H.tick(1);
        const after = H.invCount(p, 'macro_digger_mask') + H.invCount(p, 'macro_digger_shirt')
            + H.invCount(p, 'macro_digger_legs') + H.invCount(p, 'macro_digger_gloves')
            + H.invCount(p, 'macro_digger_boots');
        const emotes = H.getVarBit(p, 'emote_zombie_walk') + H.getVarBit(p, 'emote_zombie_dance');
        check('Leo pays two things off the zombie list', after - before + emotes, 2);
        check('  ...and sends you back where he found you', [p.x, p.z], [3230, 3250]);
        check('  ...and lets go of the event, so randoms can happen again',
            H.getVar(p, 'macro_event'), 0);
    }

    // AND NOT BEFORE. A cemetery one coffin short of right pays nothing - which is the check that
    // says the five-way comparison is really being made.
    {
        const p: any = player('diggerhalf', 3234, 3250, 0);
        H.clearInv(p);
        started(p);
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            H.opLoc(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], 1);
            settle(p);
        }
        // Four right, and the last two swapped.
        const order = [wants(p, 0), wants(p, 1), wants(p, 2), wants(p, 4), wants(p, 3)];
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            A.useOn(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], coffinObj(order[i]));
            settle(p);
        }
        check('two coffins swapped is not finished', H.runProc(p, '[proc,macro_digger_done]')[0], 0);
        // "I'll keep at it" is the first of the two he offers.
        talkToThis(p, nearby('macro_gravedigger', p, 10)!, [1]);
        settle(p);
        // NOT asserted on what he says: drive() only collects the chat from the second page on, and
        // the line that turns him down is on the first. Where the player ends up is the thing that
        // matters, and it is not something a wrong assertion could make true by accident.
        check('  ...and Leo leaves you in the graveyard rather than paying',
            [p.x >= 1921 && p.x <= 1934, p.z >= 4993 && p.z <= 5007], [true, true]);
        check('  ...and the event is still running', H.getVar(p, 'macro_event'), 12);
        check('  ...with nothing to show for it',
            H.invCount(p, 'macro_digger_mask') + H.invCount(p, 'macro_digger_shirt')
            + H.invCount(p, 'macro_digger_legs') + H.invCount(p, 'macro_digger_gloves')
            + H.invCount(p, 'macro_digger_boots'), 0);
    }
}

console.log(`RANDOMEVENTS ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
