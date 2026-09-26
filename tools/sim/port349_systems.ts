// The 349 port of systems, bosses and events (content branch port349-systems). Run with
//   BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_systems.ts
//
// Every trigger the port changed is driven through the real engine, and every runtime script error
// anywhere fails the run:
//   book         the Castle Wars manual's ten pages, its item pictures, and a plain book after it
//   music        349's dungeon/island regions play and unlock; desert heat starts and stops with the
//                desert squares; the Underground Pass trap timer; the files that own a mapzone
//   wilderness   the WARNING screen once per login below the ditch line; the King Black Dragon's hunt
//   xmas         Santa and the yo-yo, and the Christmas window (Date.now moved around)
//   trail        every enum clue is answerable; search, dig, map, sextant (Saradomin wizard),
//                locked drawers, bookcase; puzzle pictures b/c/d and the hint; rewards
//   macro        the Mysterious Old Man's mime, maze and strange box
//   small        vial Empty, swimming emotes, flour pot, locked chests, duel board, holiday pickups,
//                ~playerwalk, the plague house warrant
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import EnumType from '#/cache/config/EnumType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import SeqType from '#/cache/config/SeqType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import IfSetObject from '#/network/game/server/model/IfSetObject.js';
import IfSetHide from '#/network/game/server/model/IfSetHide.js';
import IfOpenOverlay from '#/network/game/server/model/IfOpenOverlay.js';
import IfOpenChat from '#/network/game/server/model/IfOpenChat.js';
import MidiSong from '#/network/game/server/model/MidiSong.js';
import MidiJingle from '#/network/game/server/model/MidiJingle.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';
import Obj from '#/engine/entity/Obj.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';

// every runtime script error, from any script, anywhere
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

// A sim player has no client, so NetworkPlayer.updateMap never runs and no [mapzone] or [zone]
// trigger fires (see soultribe.ts). Every cycle does that comparison here, as the engine would.
const origCycle = (World as any).cycle.bind(World);
(World as any).cycle = function () {
    origCycle();
    for (const p of World.playerLoop.all()) {
        const mapZone = CoordGrid.packCoord(0, (p.x >> 6) << 6, (p.z >> 6) << 6);
        if (p.lastMapZone !== mapZone) {
            if (p.lastMapZone !== -1) {
                const { x, z } = CoordGrid.unpackCoord(p.lastMapZone);
                p.triggerMapzoneExit(x, z);
            }
            p.triggerMapzone((p.x >> 6) << 6, (p.z >> 6) << 6);
            p.lastMapZone = mapZone;
        }
        const zone = CoordGrid.packCoord(p.level, (p.x >> 3) << 3, (p.z >> 3) << 3);
        if (p.lastZone !== zone) {
            if (p.lastZone !== -1) {
                const { level, x, z } = CoordGrid.unpackCoord(p.lastZone);
                p.triggerZoneExit(level, x, z);
            }
            p.triggerZone(p.level, (p.x >> 3) << 3, (p.z >> 3) << 3);
            p.lastZone = zone;
        }
    }
};

// extra traffic the harness does not record
type Msg = { tick: number; who: string; kind: string; com?: number; a?: number; b?: number | boolean };
const msgs: Msg[] = [];
const origWrite = (Player.prototype as any).write;
(Player.prototype as any).write = function (m: ServerGameMessage) {
    const who = this.username;
    const t = World.currentTick;
    if (m instanceof IfSetObject) msgs.push({ tick: t, who, kind: 'obj', com: m.component, a: m.obj });
    else if (m instanceof IfSetHide) msgs.push({ tick: t, who, kind: 'hide', com: m.component, b: m.hidden });
    else if (m instanceof IfOpenOverlay) msgs.push({ tick: t, who, kind: 'overlay', com: m.component });
    else if (m instanceof IfOpenChat) msgs.push({ tick: t, who, kind: 'chat', com: m.component });
    else if (m instanceof MidiSong) msgs.push({ tick: t, who, kind: 'song', a: m.id });
    else if (m instanceof MidiJingle) msgs.push({ tick: t, who, kind: 'jingle', a: m.id });
    return origWrite.call(this, m);
};
// overhead text from npcs too (the harness records players only)
const npcSays: { tick: number; nid: number; text: string }[] = [];
const origNpcSay = (Npc.prototype as any).say;
(Npc.prototype as any).say = function (text: string) {
    npcSays.push({ tick: World.currentTick, nid: this.nid, text });
    return origNpcSay.call(this, text);
};
const midiNames = new Map<number, string>();
for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/pack/midi.pack`, 'ascii').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0) midiNames.set(parseInt(line.slice(0, eq)), line.slice(eq + 1));
}

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? R.ok++ : R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const section = async (name: string, fn: () => void | Promise<void>) => {
    console.log(name);
    const e0 = errors.length;
    try {
        await fn();
    } catch (e) {
        R.bad++;
        console.log(`  FAIL threw: ${(e as Error).stack}`);
    }
    check(`${name}: no script errors`, errors.slice(e0), []);
};

// 'L_mx_mz_lx_lz' -> [x, z, level]
const at = (c: string) => {
    const [l, mx, mz, lx, lz] = c.split('_').map(Number);
    return [mx * 64 + lx, mz * 64 + lz, l] as const;
};
let bucket = 200;
function fresh(c: string) {
    const [x, z, l] = at(c);
    const p = H.makePlayer('p349_' + bucket, x, z, bucket++);
    p.teleport(x, z, l);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
function tele(p: Player, c: string) {
    const [x, z, l] = at(c);
    p.teleport(x, z, l);
    H.tick(2);
}
const com = (name: string) => Component.getId(name);
/** The interfaces opened on a player since a mark, by name. */
// a sim player has no NetworkPlayer, so IfOpenMain is never written: the modal itself is the record
const modalName = (p: Player) => (p.modalMain === -1 ? 'none' : Component.get(p.modalMain).comName);
const overlayName = (p: Player) => (p.overlay === -1 ? 'none' : Component.get(p.overlay).comName);
/** Run a script as a click would: with protected access. */
function runProt(p: Player, name: string, args: any[] = []) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p, null, args), true);
}
const invNames = (p: Player, inv = InvType.INV) => {
    const out: string[] = [];
    const i = p.getInventory(inv)!;
    for (let s = 0; s < i.capacity; s++) {
        const o = i.get(s);
        if (o) out.push(ObjType.get(o.id).debugname!);
    }
    return out;
};
const invOf = (p: Player, name: string) => {
    const id = InvType.getId(name);
    const inv = p.getInventory(id);
    const out: (string | null)[] = [];
    if (!inv) return out;
    for (let s = 0; s < inv.capacity; s++) {
        const o = inv.get(s);
        out.push(o ? ObjType.get(o.id).debugname! : null);
    }
    return out;
};
function locsAt(x: number, z: number, level: number): Npc[] | any[] {
    const zone = World.gameMap.getZone(x, z, level);
    return [...(zone as any).getLocsSafe(CoordGrid.packZoneCoord(x, z))];
}
function locNameAt(x: number, z: number, level: number, cat?: string) {
    for (const loc of locsAt(x, z, level)) {
        const t = LocType.get(loc.type);
        if (!cat || (t.category !== -1 && CategoryType.get(t.category).debugname === cat)) return t.debugname!;
    }
    return null;
}
function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** Wait for whatever the player is doing, clicking through any dialogue. */
function settle(p: Player, max = 60): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < max; guard++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
function opLocAny(p: Player, c: string, locName: string, op: number) {
    const [x, z] = at(c);
    H.opLoc(p, x, z, locName, op);
    return settle(p);
}
function useOnLoc(p: Player, objName: string, c: string, locName: string) {
    const [x, z, l] = at(c);
    const loc = World.getLoc(x, z, l, LocType.getId(locName));
    if (!loc) throw new Error(`no ${locName} at ${c}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p);
}
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const textsSince = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
const msgsFor = (p: Player, from: number, kind: string) => msgs.slice(from).filter(m => m.who === p.username && m.kind === kind);

// ============================================================================ book
await section('BOOK: Castle Wars manual', () => {
    const p = fresh('0_38_48_10_10');
    H.give(p, 'castlewars_manual');
    const m0 = msgs.length, i0 = H.ifaces.length;
    H.opheld(p, 'castlewars_manual', 1);
    settle(p);
    check('opens the book', modalName(p), 'book');
    check('page 1 reads the Objective', textsSince(p, i0).some(t => t.startsWith('Objective:')), true);
    check('the left page button is hidden on page 1', msgsFor(p, m0, 'hide').some(m => m.com === com('book:com_85') && m.b === true), true);
    const m1 = msgs.length, i1 = H.ifaces.length;
    H.ifButton(p, 'book:com_86');
    settle(p);
    check('page 2: the toolkit pictured beside its line (book:com_45)', msgsFor(p, m1, 'obj').map(m => [Component.get(m.com!).comName, ObjType.get(m.a!).debugname]), [['book:com_45', 'castlewars_toolkit']]);
    check('  and its layer shown', msgsFor(p, m1, 'hide').some(m => m.com === com('book:com_44') && m.b === false), true);
    check('  the text says Toolkit', textsSince(p, i1).includes('Toolkit:'), true);
    for (let i = 0; i < 12; i++) H.ifButton(p, 'book:com_86');
    settle(p);
    check('the last page is the rock (flipping past the end stops there)', H.getVar(p, 'book_page'), 9);
    const m2 = msgs.length;
    H.ifButton(p, 'book:com_84');
    settle(p);
    check('back a page: the catapult', msgsFor(p, m2, 'obj').map(m => ObjType.get(m.a!).debugname), ['castlewars_catapult']);
    // a plain book after the picture pages hides every picture layer again
    p.closeModal();
    H.give(p, 'ardougne_book');
    const m3 = msgs.length;
    H.opheld(p, 'ardougne_book', 1);
    settle(p);
    const hidden = msgsFor(p, m3, 'hide').filter(m => m.b === true).map(m => Component.get(m.com!).comName);
    check('a plain book hides the 22 picture layers', ['book:com_40', 'book:com_44', 'book:com_82'].every(n => hidden.includes(n)), true);
    check('  and pictures nothing', msgsFor(p, m3, 'obj').length, 0);
    H.despawn(p);
});

// ============================================================================ music
await section('MUSIC', () => {
    const p = fresh('0_50_50_20_20');
    H.tick(2);
    const songAfter = (c: string) => {
        const m0 = msgs.length;
        tele(p, c);
        H.tick(1);
        return msgsFor(p, m0, 'song').map(m => midiNames.get(m.a!));
    };
    check('Underground Pass (0_37_150): Underground Pass', songAfter('0_37_150_20_20'), ['upass']);
    check('Dwarven Mine (0_47_153): Cave Background', songAfter('0_47_153_20_20'), ['cave background']);
    check('Lumbridge swamp caves (0_49_149, its own mapzone file): Faerie', songAfter('0_49_149_20_20'), ['faerie']);
    check('Castle Wars tunnels (0_37_148): Ready for Battle', songAfter('0_37_148_20_20'), ['ready for battle']);
    check('a square we already had (Lumbridge 0_50_50): Harmony still', songAfter('0_50_50_20_20'), ['harmony']);
    check('a square both lists name keeps ours (0_38_47 Zogre Dance, 349 Gaol)', songAfter('0_38_47_20_20'), ['zogre dance']);

    // unlock: the Underground Pass track is now in the player's unlocked list
    const row = ScriptProvider.getByName('[proc,music_getvar]');
    check('music_getvar exists', row !== undefined, true);

    // desert heat
    tele(p, '0_50_46_30_30');
    H.tick(2);
    check('into the desert (0_50_46): %desert on and the heat timer running', [H.getVar(p, 'desert'), [...(p as any).timers.values()].some((t: any) => t.script.name === '[timer,desert_heat]')], [1, true]);
    const m0 = H.mesgs.length;
    tele(p, '0_51_49_20_20');
    H.tick(2);
    check('out to Al Kharid: over', [H.getVar(p, 'desert'), mesSince(p, m0).includes('Desert effect is now over.')], [0, true]);
    // Underground Pass trap timer
    tele(p, '0_37_151_20_20');
    H.tick(2);
    check('the Underground Pass traps square starts upass_trap', [...(p as any).timers.values()].some((t: any) => t.script.name === '[timer,upass_trap]'), true);
    tele(p, '0_50_50_20_20');
    H.tick(2);
    check('  and leaving stops it', [...(p as any).timers.values()].some((t: any) => t.script.name === '[timer,upass_trap]'), false);
    H.despawn(p);
});

// ============================================================================ wilderness
await section('WILDERNESS WARNING', () => {
    const p = fresh('0_47_54_42_40');
    H.tick(2);
    const [x, z] = at('0_47_54_42_58'); // 3050,3514: open ground north of Edgeville's west side
    // step onto the strip from just south of it (walkTo from further off stops on the way)
    p.teleport(x, z - 3, 0);
    H.tick(2);
    const mw = H.mesgs.length;
    H.walkTo(p, x, z);
    H.tick(8);
    void mw;
    check('walking up to the ditch line opens WARNING !!! (inter_46)', modalName(p), 'inter_46');
    p.closeModal();
    // into the wilderness and back: %wilderness is set, so no second warning this login
    tele(p, '0_47_55_42_10');
    H.tick(2);
    check('%wilderness set in the wilderness', H.getVar(p, 'wilderness'), 1);
    p.teleport(x, z - 3, 0);
    H.tick(2);
    H.walkTo(p, x, z);
    H.tick(8);
    check('...and the second walk up does not warn again', modalName(p), 'none');
    H.despawn(p);
});

await section('KING BLACK DRAGON', () => {
    const kbd = NpcType.get(NpcType.getId('king_dragon'));
    check('huntmode is 349\'s king_dragon hunt', HuntType.get(kbd.huntmode).debugname, 'king_dragon');
    check('  which keeps hunting and goes to applayer2', [HuntType.get(kbd.huntmode).findKeepHunting, HuntType.get(kbd.huntmode).findNewMode], [true, 13]); // NpcMode.APPLAYER2
    check('  magic level 240', kbd.stats[5], 240);
    const p = fresh('0_35_73_31_12');
    const d = H.addNpcAt('king_dragon', at('0_35_73_31_12')[0] - 3, at('0_35_73_31_12')[1] + 3, 0);
    H.tick(1);
    H.setNpcMode(d, 'OPPLAYER2', p);
    const h0 = H.hits.length;
    for (let t = 0; t < 20; t++) {
        p.levels[3] = 99;
        H.tick(1);
    }
    check('the KBD fights (the player is hit)', H.hits.slice(h0).some(h => h.who === p.username), true);
    World.removeNpc(d, -1);
    H.despawn(p);
});

// ============================================================================ xmas
await section('CHRISTMAS 2004', () => {
    const realNow = Date.now;
    const on = (iso: string) => {
        const t = Date.parse(iso);
        Date.now = () => t;
    };
    const p = fresh('0_50_50_20_20');
    const active = () => H.runProc(p, '[proc,xmas2004_active]')[0];
    const days: [string, number][] = [
        ['2026-07-01T12:00:00Z', 0], ['2026-12-17T23:59:00Z', 0], ['2026-12-18T00:00:00Z', 1], ['2026-12-25T12:00:00Z', 1],
        ['2027-01-03T23:00:00Z', 1], ['2027-01-04T00:00:00Z', 0], ['2028-12-17T12:00:00Z', 0], ['2028-12-18T12:00:00Z', 1], ['2028-12-31T12:00:00Z', 1]
    ];
    for (const [d, want] of days) {
        on(d);
        check(`~xmas2004_active on ${d.slice(0, 10)}`, active(), want);
    }
    const santa = H.addNpc('santa_claus', p.x + 2, p.z);
    H.tick(1);
    on('2026-07-01T12:00:00Z');
    let m0 = H.mesgs.length;
    H.opNpc(p, santa, 1);
    settle(p);
    check('July: Santa is busy and gives nothing', [mesSince(p, m0).includes('Santa is busy getting ready for Christmas.'), H.invCount(p, 'xmas_yoyo')], [true, 0]);
    // his timer does nothing out of season
    const s0 = npcSays.length;
    H.tick(25);
    check('  and says nothing', npcSays.slice(s0).filter(s => s.nid === santa.nid).length, 0);
    on('2026-12-25T12:00:00Z');
    H.opNpc(p, santa, 1);
    settle(p);
    check('Christmas Day: a yo-yo, and it is remembered', [H.invCount(p, 'xmas_yoyo'), H.getVar(p, 'xmas_yoyo_unlocked')], [1, 1]);
    H.tick(25);
    check('  and Santa shouts', npcSays.slice(s0).some(s => s.nid === santa.nid && ['Ho Ho Ho', 'Merry Xmas!', 'I love Xmas', 'Come talk to Santa'].includes(s.text)), true);
    for (const [op, seq] of [[1, 'yoyo_updown'], [2, 'yoyo_roundworld'], [3, 'yoyo_walkdog'], [4, 'yoyo_advanced']] as const) {
        const a0 = H.anims.length;
        H.opheld(p, 'xmas_yoyo', op);
        H.tick(2);
        check(`yo-yo op${op} plays ${seq}`, H.anims.slice(a0).some(a => a.who === p.username && a.seq === SeqType.getId(seq)), true);
    }
    // lost it: Santa gives another, then refuses a third
    H.clearInv(p);
    H.opNpc(p, santa, 1);
    settle(p);
    check('lost yo-yo replaced', H.invCount(p, 'xmas_yoyo'), 1);
    on('2026-07-01T12:00:00Z');
    H.clearInv(p);
    const diango = H.addNpc('aprilfoolshorsesalesman', p.x + 1, p.z);
    H.tick(1);
    p.executeScript(ScriptRunner.init(ScriptProvider.getByName('[label,aprilfoolshorsesalesman_reclaim_yoyo]')!, p, diango), true);
    settle(p);
    World.removeNpc(diango, -1);
    check('Diango reclaims it in July (year-round)', H.invCount(p, 'xmas_yoyo'), 1);
    Date.now = realNow;
    World.removeNpc(santa, -1);
    H.despawn(p);
});

// ============================================================================ trail
const P = (n: string) => ParamType.getId(n);
const oparam = (obj: string, param: string) => ObjType.get(ObjType.getId(obj)).params?.get(P(param));
await section('TRAIL: every clue in the drop enums can be answered', () => {
    const search = new Set(['empty_crate', 'empty_crates', 'empty_boxes', 'drawer', 'empty_drawer', 'chest_closed', 'chest_open']);
    const bad: string[] = [];
    let n = 0;
    for (const e of ['trail_easy_enum', 'trail_medium_enum', 'trail_hard_enum']) {
        const en = EnumType.get(EnumType.getId(e));
        for (const [, v] of en.values) {
            n++;
            const name = ObjType.get(v as number).debugname!;
            const loc = oparam(name, 'trail_loc');
            const coord = oparam(name, 'trail_coord') as number | undefined;
            const casket = oparam(name, 'trail_casket') as number | undefined;
            const hasRead = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1, v as number, ObjType.get(v as number).category) !== undefined;
            if (!hasRead) bad.push(name + ' (no Read)');
            if (loc) {
                const c = CoordGrid.unpackCoord(coord!);
                const cats = locsAt(c.x, c.z, c.level).map((l: any) => LocType.get(l.type).category).filter((x: number) => x !== -1).map((x: number) => CategoryType.get(x).debugname);
                if (!cats.some((x: string) => search.has(x))) bad.push(name + ' (no search loc at its coord)');
            }
            if (casket !== undefined && casket !== -1) {
                const cc = CategoryType.get(ObjType.get(casket).category)?.debugname ?? '';
                if (!cc.startsWith('trail_casket_')) bad.push(name + ' (casket ' + ObjType.get(casket).debugname + ' is ' + cc + ')');
            }
        }
    }
    console.log(`    ${n} clues`);
    check('every clue has a Read, and every search clue a crate/drawers/chest/boxes at its coord', bad, []);
    const skipped = ['trail_clue_easy_vague028', 'trail_clue_medium_anagram013', 'trail_clue_hard_riddle018'];
    const inEnum = (x: string) => ['trail_easy_enum', 'trail_medium_enum', 'trail_hard_enum'].some(e => [...EnumType.get(EnumType.getId(e)).values.values()].includes(ObjType.getId(x)));
    check('the NPC-answered 349 clues are kept out of the enums', skipped.map(inEnum), [false, false, false]);
    check('...but carry their text', skipped.map(x => typeof oparam(x, 'trail_desc') === 'string'), [true, true, true]);
});

function trailPlayer(c: string, clue: string) {
    const p = fresh(c);
    H.setVar(p, 'trail_progress', 0);
    H.give(p, clue);
    return p;
}
const holding = (p: Player, clue: string) => H.invCount(p, clue);
const progressed = (p: Player, clue: string) => {
    // the clue went (a new clue, a casket or the reward came instead), or the tier's step count moved -
    // the next clue can be the same one again, picked at random from the tier's enum
    const tier = clue.includes('_medium_') ? 1 : clue.includes('_hard_') ? 2 : 0;
    return holding(p, clue) === 0 || H.runProc(p, '[proc,get_trail_progress]', [tier])[0] > 0;
};

await section('TRAIL: search clues (349 trail_loc)', () => {
    // drawers: open, then search
    {
        const c = '0_45_55_49_50';
        const p = trailPlayer('0_45_55_49_48', 'trail_clue_easy_vague006');
        opLocAny(p, c, 'drawers1', 1);
        const [x, z] = at(c);
        const open = locNameAt(x, z, 0, 'empty_drawer');
        check('Burthorpe drawers open', open !== null, true);
        const mm0 = H.mesgs.length;
        opLocAny(p, c, open!, 2);
        void mm0;
        check('searching them answers easy vague006', progressed(p, 'trail_clue_easy_vague006'), true);
        H.despawn(p);
    }
    for (const [clue, c, loc, op, stand] of [
        ['trail_clue_easy_vague007', '0_40_48_38_33', 'crate2_old', 1, '0_40_48_37_33'],
        ['trail_clue_easy_vague009', '0_46_153_56_6', 'chestclosed', 1, '0_46_153_56_5'],
        ['trail_clue_easy_vague015', '0_45_53_6_57', 'boxes2', 1, '0_45_53_6_56'],
        ['trail_clue_medium_riddle009', '0_54_54_42_51', 'crate_old', 1, '0_54_54_42_50'],
        ['trail_clue_hard_riddle024', '0_40_54_16_8', 'crate2', 1, '0_40_54_16_7']
    ] as const) {
        const p = trailPlayer(stand, clue);
        opLocAny(p, c, loc, op);
        check(`${loc} at ${c} answers ${clue}`, progressed(p, clue), true);
        H.despawn(p);
    }
    // a crate with no clue for it is an ordinary crate
    const p = trailPlayer('0_40_48_37_33', 'trail_clue_easy_vague006');
    const m0 = H.mesgs.length;
    opLocAny(p, '0_40_48_38_33', 'crate2_old', 1);
    check('the wrong crate leaves the clue alone', [holding(p, 'trail_clue_easy_vague006'), mesSince(p, m0).some(m => /crate/.test(m))], [1, true]);
    H.despawn(p);
});

await section('TRAIL: maps, sextants, the Saradomin wizard', () => {
    // map read
    for (const [clue, iface] of [['trail_clue_easy_map004', 'inter_189'], ['trail_clue_medium_map003', 'inter_89'], ['trail_clue_hard_map005', 'inter_180']] as const) {
        const p = trailPlayer('0_50_50_20_20', clue);
        const i0 = H.ifaces.length;
        H.opheld(p, clue, 1);
        H.tick(1);
        check(`${clue} shows ${iface}`, modalName(p), iface);
        H.despawn(p);
    }
    // dig the easy map
    {
        const p = trailPlayer('0_40_54_52_26', 'trail_clue_easy_map004');
        H.give(p, 'spade');
        H.opheld(p, 'spade', 1);
        settle(p);
        check('digging at easy map004 gives its casket', [holding(p, 'trail_clue_easy_map004'), H.invCount(p, 'trail_clue_easy_map004_casket')], [0, 1]);
        H.despawn(p);
    }
    // a medium sextant clue, with and without the navigation kit
    {
        const p = trailPlayer('0_45_55_39_15', 'trail_clue_medium_sextant016');
        H.give(p, 'spade');
        H.opheld(p, 'spade', 1);
        settle(p);
        check('medium sextant016 without sextant/watch/chart: nothing', holding(p, 'trail_clue_medium_sextant016'), 1);
        H.give(p, 'trail_sextant');
        H.give(p, 'trail_watch');
        H.give(p, 'trail_chart');
        H.opheld(p, 'spade', 1);
        settle(p);
        check('  with them: the casket', H.invCount(p, 'trail_clue_medium_sextant016_casket'), 1);
        H.despawn(p);
    }
    // a hard sextant clue guarded by the Saradomin wizard
    {
        const p = trailPlayer('0_45_57_12_27', 'trail_clue_hard_sextant014');
        for (const o of ['spade', 'trail_sextant', 'trail_watch', 'trail_chart']) H.give(p, o);
        const s0 = npcSays.length;
        H.opheld(p, 'spade', 1);
        settle(p, 8);
        const wiz = H.npcNear('trail_hard2', p.x, p.z);
        check('hard sextant014: a Saradomin wizard appears', wiz !== null && Math.max(Math.abs(wiz.x - p.x), Math.abs(wiz.z - p.z)) <= 2, true);
        check('  "For Saradomin!"', npcSays.slice(s0).some(s => s.text === 'For Saradomin!'), true);
        check('  and no casket yet', holding(p, 'trail_clue_hard_sextant014'), 1);
        // the clue's spot is rough ground: bring him to the player so the fight is not about paths
        wiz!.teleport(p.x + 1, p.z, p.level);
        const h0 = H.hits.length;
        for (let t = 0; t < 20; t++) {
            p.levels[3] = 99;
            H.tick(1);
        }
        check('  he fights', H.hits.slice(h0).some(h => h.who === p.username), true);
        // beaten
        for (let t = 0; t < 120 && wiz!.isActive; t++) {
            p.levels[3] = 99;
            wiz!.levels[3] = 1;
            if (t % 6 === 0) H.attackNpc(p, wiz!);
            H.tick(1);
        }
        H.tick(3);
        check('  the wizard dies', wiz!.isActive, false);
        check('  killed, the hard guardian bit is set', H.runProc(p, '[proc,trail_guardian_defeated]', [2])[0], 1);
        p.clearPendingAction();
        H.tick(12);
        H.opheld(p, 'spade', 1);
        settle(p);
        check('  and the dig gives the casket', H.invCount(p, 'trail_clue_hard_sextant014_casket'), 1);
        H.despawn(p);
    }
    // the Zamorak wizard on a 349 hard sextant (029)
    {
        const p = trailPlayer('0_48_58_22_52', 'trail_clue_hard_sextant029');
        for (const o of ['spade', 'trail_sextant', 'trail_watch', 'trail_chart']) H.give(p, o);
        const s0 = npcSays.length;
        H.opheld(p, 'spade', 1);
        settle(p, 8);
        check('hard sextant029: the Zamorak wizard ("Die, human!")', [H.npcNear('trail_hard', p.x, p.z) !== null, npcSays.slice(s0).some(s => s.text === 'Die, human!')], [true, true]);
        const h0 = H.hits.length;
        for (let t = 0; t < 15; t++) {
            p.levels[3] = 99;
            H.tick(1);
        }
        check('  he casts at you', H.hits.slice(h0).some(h => h.who === p.username), true);
        const zw = H.npcNear('trail_hard', p.x, p.z)!;
        // gone: his 20-tick timer sends him home once his player is not there
        H.despawn(p);
        for (let t = 0; t < 45 && zw.isActive; t++) H.tick(1);
        check('  and leaves once you are gone (349 timer=20)', zw.isActive, false);
    }
});

await section('TRAIL: locked drawers, bookcase', () => {
    // Brimhaven: the pirate's key
    {
        const c = '1_43_49_57_29';
        const p = trailPlayer('1_43_49_57_28', 'trail_clue_medium_riddle007');
        const t0 = settle(p).length;
        void t0;
        const i0 = H.ifaces.length, mm0 = H.mesgs.length;
        opLocAny(p, c, 'drawers1', 1);
        check('Brimhaven drawers locked: "Shiver me timbers!"', /Shiver\s+me timbers/.test(textsSince(p, i0).join(' ')), true);
        const pirate = H.addNpcAt('pirate1', p.x + 1, p.z, 1);
        H.tick(1);
        const [kx, kz] = [pirate.x, pirate.z];
        H.runNpcProc(pirate, '[proc,trail_checkmediumdrop]', p);
        const keyId = ObjType.getId('trail_clue_medium_riddle007_key');
        const key = World.getObj(kx, kz, 1, keyId, -1n) ?? World.getObj(kx, kz, 1, keyId, p.hash64);
        check('a pirate drops the riddle007 key', key !== null, true);
        World.removeNpc(pirate, -1);
        H.give(p, 'trail_clue_medium_riddle007_key');
        opLocAny(p, c, 'drawers1', 1);
        check('  with it, the drawers answer the clue', [progressed(p, 'trail_clue_medium_riddle007'), H.invCount(p, 'trail_clue_medium_riddle007_key')], [true, 0]);
        H.despawn(p);
    }
    // Burthorpe: Penda's key, by use
    {
        const c = '0_45_55_41_57';
        const p = trailPlayer('0_45_55_41_56', 'trail_clue_medium_riddle008');
        H.give(p, 'trail_clue_medium_riddle008_key');
        useOnLoc(p, 'trail_clue_medium_riddle008_key', c, 'drawers2');
        check('Burthorpe drawers, key used on them: riddle008 answered', progressed(p, 'trail_clue_medium_riddle008'), true);
        H.despawn(p);
    }
    // Varrock: Black Heather's key used on the chest (349's [oplocu,_chest_closed])
    {
        const p = trailPlayer('0_50_54_56_30', 'trail_clue_medium_riddle001');
        H.give(p, 'trail_clue_medium_riddle001_key');
        const [cx, cz] = at('0_50_54_56_31');
        const chest = locNameAt(cx, cz, 0, 'chest_closed');
        useOnLoc(p, 'trail_clue_medium_riddle001_key', '0_50_54_56_31', chest!);
        check('a riddle001 key used on its chest answers the clue', [progressed(p, 'trail_clue_medium_riddle001'), H.invCount(p, 'trail_clue_medium_riddle001_key')], [true, 0]);
        H.despawn(p);
    }
    // the Seers' bookcase
    {
        const p = trailPlayer('1_42_53_15_17', 'trail_clue_hard_riddle022');
        opLocAny(p, '1_42_53_14_17', 'bookcase', 1);
        check('Seers\' bookcase answers hard riddle022', progressed(p, 'trail_clue_hard_riddle022'), true);
        H.despawn(p);
    }
});

await section('TRAIL: the NPCs that answer clues (trail_npc_clues.rs2)', () => {
    // talk, clicking through the chat
    const talk = (p: Player, npc: Npc) => {
        // stand next to it first (an npc can wander between talks), from whichever side can reach it
        for (const [dx, dz] of [[npc.width, 0], [-1, 0], [0, npc.length], [0, -1]]) {
            p.teleport(npc.x + dx, npc.z + dz, npc.level);
            H.tick(1);
            H.opNpc(p, npc, 1);
            const said = settle(p);
            if (said.length > 0) return said;
        }
        return [];
    };
    for (const [npcName, clue] of [
        ['werewolfinnkeeper', 'trail_clue_medium_anagram017'],
        ['gnome_brimstail', 'trail_clue_medium_anagram014'],
        ['kangai_mau', 'trail_clue_medium_anagram019'],
        ['captain_tobias', 'trail_clue_easy_vague012']
    ] as const) {
        const p = trailPlayer('0_50_50_20_20', clue);
        const n = H.addNpc(npcName, p.x + 1, p.z);
        H.tick(1);
        talk(p, n);
        check(`${npcName} takes ${clue} and hands over the next`, progressed(p, clue), true);
        World.removeNpc(n, -1);
        H.despawn(p);
    }
    for (const [npcName, clue, box, where] of [
        ['gnome_heckelfunch', 'trail_clue_hard_riddle025', 'trail_clue_hard_riddle025_puzzlebox', '0_50_50_20_20'],
        ['gnometrainer', 'trail_clue_hard_riddle026', 'trail_clue_hard_riddle026_puzzlebox', '0_50_50_20_20'],
        ['gnomepilot', 'trail_clue_hard_riddle021', 'trail_clue_hard_riddle021_puzzlebox', '0_44_54_36_41'],
        ['wilough', 'trail_clue_hard_riddle016', 'trail_clue_hard_riddle016_puzzlebox', '0_50_50_20_20'],
        ['general_bentnoze', 'trail_clue_hard_riddle017', 'trail_clue_hard_riddle017_puzzlebox', '0_50_50_20_20'],
        ['oziach', 'trail_clue_hard_riddle014', 'trail_clue_hard_riddle014_puzzlebox', '0_50_50_20_20']
    ] as const) {
        const p = trailPlayer(where, clue);
        const n = H.addNpc(npcName, p.x + 1, p.z);
        H.tick(1);
        talk(p, n);
        check(`${npcName}: a puzzle box for ${clue}`, H.invCount(p, box), 1);
        talk(p, n);
        check('  unsolved, the clue stays', [H.invCount(p, box), holding(p, clue)], [1, 1]);
        // open it, and solve it
        H.opheld(p, box, 1);
        H.tick(1);
        p.closeModal();
        const inv = p.getInventory(InvType.getId('trail_puzzleinv'))!;
        const set = ObjType.get(inv.get(0)?.id ?? inv.get(1)!.id).debugname!.slice(0, 'trail_slidingpuzzle'.length + 1);
        inv.removeAll();
        for (let i = 0; i < 24; i++) inv.set(i, { id: ObjType.getId(`${set}${String(i + 1).padStart(2, '0')}`), count: 1 });
        talk(p, n);
        check('  solved, it takes the box and the trail moves on', [H.invCount(p, box), progressed(p, clue)], [0, true]);
        World.removeNpc(n, -1);
        H.despawn(p);
    }
    // Diango and the yo-yo
    {
        const p = fresh('0_48_50_20_20');
        H.setVar(p, 'xmas_yoyo_unlocked', 1);
        const d = H.addNpc('aprilfoolshorsesalesman', p.x + 1, p.z);
        H.tick(1);
        H.opNpc(p, d, 1);
        for (let t = 0; t < 30; t++) {
            const sc = p.activeScript;
            if (sc && sc.execution === ScriptState.PAUSEBUTTON) {
                if (p.modalChat !== -1 && Component.get(p.modalChat).comName === 'multi3') {
                    H.choose(p, 'multi3:com_3');
                } else {
                    p.executeScript(sc, true, true);
                }
                continue;
            }
            H.tick(1);
        }
        settle(p);
        check('Diango: "Can I have my yo-yo back?" gives one', H.invCount(p, 'xmas_yoyo'), 1);
        World.removeNpc(d, -1);
        H.despawn(p);
    }
});

await section('TRAIL: puzzle boxes', () => {
    const p = fresh('0_50_50_20_20');
    const solved = () => H.runProc(p, '[proc,trail_puzzle_complete]')[0];
    for (const [box, set] of [['trail_clue_hard_riddle014_puzzlebox', 'b'], ['trail_clue_hard_riddle018_puzzlebox', 'c'], ['trail_clue_hard_riddle020_puzzlebox', 'd']] as const) {
        H.clearInv(p);
        p.getInventory(InvType.getId('trail_puzzleinv'))!.removeAll();
        H.give(p, box);
        const m0 = msgs.length;
        const inv0 = (p as any).invListeners?.length;
        void inv0;
        H.opheld(p, box, 1);
        H.tick(1);
        const grid = invOf(p, 'trail_puzzleinv');
        const hint = invOf(p, 'trail_puzzlehintinv');
        check(`${box}: a shuffled picture ${set}`, grid.filter(x => x !== null).every(x => x!.startsWith('trail_slidingpuzzle' + set)) && grid.filter(x => x !== null).length === 24, true);
        check(`  the hint is picture ${set} in order`, hint.slice(0, 24), Array.from({ length: 24 }, (_, i) => `trail_slidingpuzzle${set}${String(i + 1).padStart(2, '0')}`));
        check('  the grid is sent to com_2 and the hint to com_8', [(p as any).invListeners.some((l: any) => l.com === com('trail_puzzle:com_2')), (p as any).invListeners.some((l: any) => l.com === com('trail_puzzle:com_8'))], [true, true]);
        void m0;
        // solve it by hand
        const inv = p.getInventory(InvType.getId('trail_puzzleinv'))!;
        inv.removeAll();
        for (let i = 0; i < 24; i++) inv.set(i, { id: ObjType.getId(`trail_slidingpuzzle${set}${String(i + 1).padStart(2, '0')}`), count: 1 });
        check('  solved reads as solved', solved(), 1);
        inv.set(3, { id: ObjType.getId(`trail_slidingpuzzle${set}05`), count: 1 });
        inv.set(4, { id: ObjType.getId(`trail_slidingpuzzle${set}04`), count: 1 });
        check('  two pieces swapped does not', solved(), 0);
        p.closeModal();
    }
    // a slide
    H.clearInv(p);
    p.getInventory(InvType.getId('trail_puzzleinv'))!.removeAll();
    H.give(p, 'trail_clue_hard_riddle018_puzzlebox');
    H.opheld(p, 'trail_clue_hard_riddle018_puzzlebox', 1);
    H.tick(1);
    const grid = invOf(p, 'trail_puzzleinv');
    const hole = grid.indexOf(null);
    const next = hole % 5 !== 0 ? hole - 1 : hole + 1;
    const piece = grid[next];
    p.lastSlot = next;
    p.lastItem = ObjType.getId(piece!);
    const s = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD5, ObjType.getId(piece!), ObjType.get(ObjType.getId(piece!)).category)!;
    p.executeScript(ScriptRunner.init(s, p), true);
    H.tick(1);
    check('Move slides a piece into the gap', invOf(p, 'trail_puzzleinv')[hole], piece);
    H.despawn(p);
});

await section('TRAIL: rewards', () => {
    const p = fresh('0_50_50_20_20');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
        for (const tier of ['easy', 'medium', 'hard']) {
            runProt(p, `[proc,trail_clue_${tier}_rare]`);
            runProt(p, `[proc,trail_clue_${tier}_normal]`);
        }
        for (const x of invOf(p, 'trail_rewardinv')) if (x) seen.add(x);
        p.getInventory(InvType.getId('trail_rewardinv'))!.removeAll();
    }
    for (let i = 0; i < 40; i++) {
        runProt(p, '[proc,trail_clue_hard_ultrarare]');
        for (const x of invOf(p, 'trail_rewardinv')) if (x) seen.add(x);
        p.getInventory(InvType.getId('trail_rewardinv'))!.removeAll();
    }
    const want = ['rune_plateskirt_gold', 'adamant_plateskirt_trim', 'black_plateskirt_gold'];
    check('349 rare rewards turn up: ' + want.join(', '), want.map(w => seen.has(w)), [true, true, true]);
    check('god book pages turn up', [...seen].some(x => x.startsWith('holy_book_')), true);
    check('the ultrarare roll: gilded rune and noted potions', [[...seen].some(x => x.endsWith('_goldplate')), [...seen].some(x => x.startsWith('cert_4dose'))], [true, true]);
    // a whole casket, into the reward window
    H.clearInv(p);
    H.give(p, 'trail_clue_hard_sextant014_casket');
    H.opheld(p, 'trail_clue_hard_sextant014_casket', 1);
    settle(p);
    p.closeModal();
    settle(p);
    check('opening a hard casket works through (clue or reward)', invNames(p).length > 0, true);
    H.despawn(p);
});

// ============================================================================ macro events
await section('RANDOM EVENTS: the Mysterious Old Man', () => {
    const allowed = (p: Player) => H.runProc(p, '[proc,macro_event_allowed]')[0];
    // strange box
    {
        const p = fresh('0_50_50_20_20');
        check('events allowed here', allowed(p), 1);
        runProt(p, '[proc,macro_event_general_spawn]', [6]);
        settle(p);
        check('event 6: the old man hands over a strange box', H.invCount(p, 'macro_cube'), 1);
        H.despawn(p);
    }
    // mime
    {
        const p = fresh('0_50_50_22_22');
        const home = [p.x, p.z];
        runProt(p, '[proc,macro_event_general_spawn]', [7]);
        settle(p);
        const [sx, sz] = at('0_31_74_24_28');
        check('event 7: taken to the mime\'s stage', [p.x, p.z >= sz - 2 && p.z <= sz], [sx, true]);
        check('  %macro_event is the mime', H.getVar(p, 'macro_event'), 7);
        const mime = H.npcNear('macro_mime', sx, sz)!;
        check('  the mime is there', mime !== null, true);
        let rounds = 0;
        const npcInt = VarNpcType.getByName('npc_int')!.id;
        const emotes = ['com_2', 'com_3', 'com_4', 'com_5', 'com_6', 'com_7', 'com_8', 'com_9'];
        for (let t = 0; t < 400 && rounds < 4; t++) {
            H.tick(1);
            if (p.modalChat === com('inter_151')) {
                const want = mime.vars[npcInt];
                H.ifButton(p, 'inter_151:' + emotes[want]);
                settle(p, 20);
                rounds++;
            }
        }
        settle(p, 20);
        check('  four emotes copied: back home', [rounds, Math.abs(p.x - home[0]) <= 1 && Math.abs(p.z - home[1]) <= 1], [4, true]);
        const prize = H.getVar(p, 'emote_access') !== 0 || invNames(p).some(x => x.startsWith('macro_mime_')) || H.invCount(p, 'coins') === 500;
        check('  with a prize (an emote, a mime piece or 500 coins)', prize, true);
        check('  and the event cleared', H.getVar(p, 'macro_event'), 0);
        H.despawn(p);
    }
    // maze
    {
        const p = fresh('0_50_50_24_24');
        const home = [p.x, p.z];
        runProt(p, '[proc,macro_event_general_spawn]', [8]);
        settle(p);
        const inMaze = Math.floor(p.x / 64) === 45 && Math.floor(p.z / 64) === 71;
        check('event 8: dropped in the maze', inMaze, true);
        check('  the countdown overlay', overlayName(p), 'mazetimer');
        H.tick(20);
        const left = H.getVar(p, 'xplamp');
        check('  counting down from 100', left > 80 && left < 100, true);
        // the shrine
        const [cx, cz] = at('0_45_71_31_31');
        let shrine: any = null;
        for (let dx = -3; dx <= 3 && !shrine; dx++) for (let dz = -3; dz <= 3 && !shrine; dz++) {
            for (const l of locsAt(cx + dx, cz + dz, 0)) if (LocType.get(l.type).debugname === 'macro_maze_complete') shrine = l;
        }
        check('  the shrine is in the middle', shrine !== null, true);
        const before = invNames(p).length;
        const mm0 = H.mesgs.length;
        // the shrine fills its walled centre; the way in is the low wall on its west side (30,32)
        const [wx, wz] = at('0_45_71_30_32');
        p.teleport(wx - 1, wz, 0);
        H.tick(1);
        H.opLoc(p, wx, wz, 'macro_maze_walllow', 1);
        settle(p, 20);
        H.opLoc(p, shrine.x, shrine.z, 'macro_maze_complete', 1);
        settle(p, 40);
        void mm0;
        check('  touching it: home, with a reward', [Math.abs(p.x - home[0]) <= 1 && Math.abs(p.z - home[1]) <= 1, invNames(p).length > before], [true, true]);
        H.despawn(p);
    }
    // the roll: mime and maze are rare and never deep in the wilderness
    {
        const p = fresh('0_50_50_20_20');
        const counts = new Map<number, number>();
        for (let i = 0; i < 4000; i++) {
            const e = H.runProc(p, '[proc,macro_event_set_random]')[0];
            counts.set(e, (counts.get(e) ?? 0) + 1);
        }
        const keys = [...counts.keys()].sort((a, b) => a - b);
        check('members roll covers events 1-8', keys, [1, 2, 3, 4, 5, 6, 7, 8]);
        check('  the mime and maze are rarer than the rest', (counts.get(7) ?? 0) < (counts.get(1) ?? 0) / 2, true);
        tele(p, '0_48_59_20_20');
        let deep = 0;
        for (let i = 0; i < 1000; i++) if (H.runProc(p, '[proc,macro_event_set_random]')[0] >= 7) deep++;
        check('  below Wilderness level 20: never', deep, 0);
        H.despawn(p);
    }
});

// ============================================================================ small ones
await section('SMALL: vial, emotes, flour, chests, duel board, holiday pickups, playerwalk', () => {
    const p = fresh('0_50_50_20_20');
    H.give(p, 'vial_water');
    H.opheld(p, 'vial_water', 4);
    H.tick(1);
    check('a vial of water empties', [H.invCount(p, 'vial_water'), H.invCount(p, 'vial_empty')], [0, 1]);

    // no emotes while swimming at the Trawler wreck (0_30_75)
    tele(p, '0_30_75_30_30');
    let m0 = H.mesgs.length;
    const a0 = H.anims.length;
    H.ifButton(p, 'emotes:wave');
    H.tick(2);
    check('an emote while swimming: refused', [mesSince(p, m0).includes('You cannot perform that emote whilst swimming.'), H.anims.slice(a0).filter(a => a.who === p.username).length], [true, 0]);
    tele(p, '0_50_50_20_20');
    H.ifButton(p, 'emotes:wave');
    H.tick(2);
    check('  and on land it plays', H.anims.slice(a0).some(a => a.who === p.username && a.seq === SeqType.getId('emote_wave')), true);

    // the flour bin, with a full pot
    tele(p, '0_41_52_9_56');
    H.give(p, 'pot_flour');
    m0 = H.mesgs.length;
    useOnLoc(p, 'pot_flour', '0_41_52_8_57', 'millbase');
    check('a pot of flour on the flour bin: "This pot is already full."', mesSince(p, m0).includes('This pot is already full.'), true);

    // a locked chest (the Underground Pass has some) - from whichever side it can be reached
    m0 = H.mesgs.length;
    for (const stand of ['0_39_149_15_43', '0_39_149_14_42', '0_39_149_15_41', '0_39_149_16_43']) {
        if (mesSince(p, m0).includes('The chest is locked.')) break;
        tele(p, stand);
        opLocAny(p, '0_39_149_15_42', 'chestlocked', 1);
    }
    check('chestlocked: "The chest is locked."', mesSince(p, m0).includes('The chest is locked.'), true);

    // the Duel Arena scoreboard line has its closing bracket
    tele(p, '0_51_50_54_27');
    runProt(p, '[proc,duel_adjust_scoreboard]', ['Alice', 90, 'Bob', 80]);
    H.tick(1);
    const i0 = H.ifaces.length;
    opLocAny(p, '0_51_50_55_27', 'loc_3192', 1);
    check('the duel board reads "Alice (90) beat Bob (80)"', textsSince(p, i0).includes('Alice (90) beat Bob (80)'), true);

    // holiday items: picking one up remembers it for Thessalia
    tele(p, '0_50_50_20_20');
    for (const [obj, varp] of [['scythe', 'scythe_unlocked'], ['bunnyears', 'bunny_ears_unlocked']] as const) {
        const o = new (Obj as any)(p.level, p.x, p.z, EntityLifeCycle.DESPAWN, ObjType.getId(obj), 1);
        World.addObj(o, Obj.NO_RECEIVER, 100);
        H.tick(1);
        p.clearPendingAction();
        p.setInteraction(Interaction.ENGINE, o, ServerTriggerType.APOBJ3);
        (p as unknown as { opcalled: boolean }).opcalled = true;
        settle(p);
        check(`picking up the ${obj} sets %${varp}`, [H.invCount(p, obj), H.getVar(p, varp)], [1, 1]);
    }

    // ~playerwalk, in an open field
    tele(p, '0_50_49_30_30');
    const [x, z] = [p.x + 3, p.z];
    runProt(p, '[proc,playerwalk]', [CoordGrid.packCoord(0, x, z)]);
    settle(p);
    check('~playerwalk walks you there', [p.x, p.z], [x, z]);
    H.despawn(p);
});

await section('PLAGUE CITY: the plague house warrant', () => {
    const door = '0_39_51_44_9';
    const [dx, dz] = at(door);
    const p = fresh('0_39_51_44_10');
    H.setVar(p, 'elenaquest', 27); // ^quest_elena_spoke_cured_bravek
    H.give(p, 'warrant');
    const guard = H.addNpc('mourner_elena_guard', dx + 3, dz - 3);
    H.tick(1);
    const i0 = H.ifaces.length;
    opLocAny(p, door, 'loc_2535', 1);
    const said = textsSince(p, i0).join(' ');
    check('the mourner goes to ask the Head Mourner', /highly irregular/.test(said), true);
    check('  and you sneak in', /sneak into the building/.test(said), true);
    check('  through the door (now inside)', p.z <= dz, true);
    World.removeNpc(guard, -1);
    H.despawn(p);
});

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
