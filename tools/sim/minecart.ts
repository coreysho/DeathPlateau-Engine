// THE KELDAGRIM MINECART SYSTEM, ridden both ways at every station. Three stations, four tickets,
// and a coin fare from the conductor - this proves each of the seven ways through it and, more to
// the point, that every arrival tile is one a player can walk off.
//
// A cart that drops somebody on a blocked tile or behind the gate its line ends inside is the
// failure worth being certain about, which is why each leg checks the landing rather than the
// message.
//
//   npx tsx tools/sim/minecart.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';

await H.boot();

// The carts sit ON the track, which blocks, so each one is clicked from the platform beside it -
// KELDA_STAND and friends - and sets you down on a platform tile too.
const KELDA: [number, number] = [2909, 10171];
const KELDA_STAND: [number, number] = [2909, 10172];
const KELDA_LAND: [number, number] = [2910, 10172];
const ICE: [number, number] = [2995, 9836];
const ICE_STAND: [number, number] = [2995, 9837];
const ICE_LAND: [number, number] = [2996, 9837];
const WOLF: [number, number] = [2875, 9868];
const WOLF_STAND: [number, number] = [2874, 9868];
const WOLF_LAND: [number, number] = [2874, 9869];

const GD_ARRIVED = 5;
const FISHCOMP_DONE = 5;

// NOT canTravel, which is the obvious choice and wrong here. canTravel refuses every members tile
// when NODE_MEMBERS is off, and it is off in .env - so Keldagrim, the Dwarven Mine and the White
// Wolf passage are all "blocked" to a sim no matter what the map says. The map's own flags are the
// question being asked: is this tile floor, or is it wall.
const standable = (x: number, z: number, level = 0): boolean => isZoneAllocated(level, x, z) && !isMapBlocked(x, z, level);

let bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${ok ? '' : '   (want ' + JSON.stringify(want) + ')'}`);
};

const p: any = H.makePlayer('cartrun', KELDA[0], KELDA[1]);
H.tick(2);
H.maxOut(p);

// every cart is placed and carries a Ride
console.log('THE THREE CARTS');
for (const [nm, x, z] of [['keldagrim_train_cart', ...KELDA], ['icemountain_train_cart', ...ICE], ['whitewolfmountain_train_cart', ...WOLF]] as [string, number, number][]) {
    const id = LocType.getId(nm);
    check(`${nm} is at ${x},${z}`, World.getLoc(x, z, 0, id) !== null, true);
}

const goTo = (x: number, z: number) => {
    p.clearPendingAction();
    p.queueWaypoints([]);
    p.teleport(x, z, 0);
    H.tick(2);
};
const ride = (what: string, stand: [number, number], at: [number, number], loc: string, land: [number, number], ticket?: string) => {
    goTo(stand[0], stand[1]);
    if (ticket) H.give(p, ticket);
    const mark = H.mesgs.length;
    let sent = false;
    try {
        sent = H.opLoc(p, at[0], at[1], loc, 1);
    } catch (e) {
        check(what, 'op threw ' + (e as Error).message, 'rode');
        return;
    }
    for (let i = 0; i < 40 && (p.delayed || p.x !== land[0] || p.z !== land[1]); i++) H.tick(1);
    p.closeModal();
    const said = H.mesgs.slice(mark).map((m: any) => m.text).join(' | ');
    check(what, [sent, p.x, p.z, ticket ? H.invCount(p, ticket) : 0], [true, land[0], land[1], 0]);
    console.log(`        said: ${said.slice(0, 150) || '(nothing)'}`);
};

console.log('\nTHE GATE: nothing runs before The Giant Dwarf has been reached');
H.setVarBit(p, 'giantdwarf_quest', 0); // a varbit on giantdwarf_main, not a varp
goTo(KELDA_STAND[0], KELDA_STAND[1]);
H.give(p, 'dwarf_minecart_ticket_kelda_ice');
H.opLoc(p, KELDA[0], KELDA[1], 'keldagrim_train_cart', 1);
for (let i = 0; i < 10; i++) H.tick(1);
p.closeModal();
check('the hub cart refuses, and keeps the ticket', [p.x, p.z, H.invCount(p, 'dwarf_minecart_ticket_kelda_ice')], [KELDA_STAND[0], KELDA_STAND[1], 1]);
H.clearInv(p);

H.setVarBit(p, 'giantdwarf_quest', GD_ARRIVED);
H.setVar(p, 'fishingcompo', FISHCOMP_DONE);

console.log('\nTHE FOUR TICKETS');
ride('Keldagrim to the Dwarven Mine', KELDA_STAND, KELDA, 'keldagrim_train_cart', ICE_LAND, 'dwarf_minecart_ticket_kelda_ice');
ride('the Dwarven Mine back to Keldagrim', ICE_STAND, ICE, 'icemountain_train_cart', KELDA_LAND, 'dwarf_minecart_ticket_ice_kelda');
ride('Keldagrim to White Wolf Mountain', KELDA_STAND, KELDA, 'keldagrim_train_cart', WOLF_LAND, 'dwarf_minecart_ticket_kelda_whitewolf');
ride('White Wolf Mountain back to Keldagrim', WOLF_STAND, WOLF, 'whitewolfmountain_train_cart', KELDA_LAND, 'dwarf_minecart_ticket_whitewolf_kelda');

console.log('\nNO TICKET, NO RIDE');
H.clearInv(p);
goTo(KELDA_STAND[0], KELDA_STAND[1]);
let mark = H.mesgs.length;
H.opLoc(p, KELDA[0], KELDA[1], 'keldagrim_train_cart', 1);
for (let i = 0; i < 10; i++) H.tick(1);
p.closeModal();
check('the hub cart turns away a passenger with no ticket', [p.x, p.z, H.mesgs.slice(mark).some((m: any) => (m.text ?? '').includes('no ticket'))], [KELDA_STAND[0], KELDA_STAND[1], true]);

console.log('\nTHE WHITE WOLF LINE IS SHUT WITHOUT THE FISHING CONTEST');
H.setVar(p, 'fishingcompo', 0);
goTo(KELDA_STAND[0], KELDA_STAND[1]);
H.give(p, 'dwarf_minecart_ticket_kelda_whitewolf');
mark = H.mesgs.length;
H.opLoc(p, KELDA[0], KELDA[1], 'keldagrim_train_cart', 1);
for (let i = 0; i < 12; i++) H.tick(1);
p.closeModal();
check('refused, and the ticket is not taken', [p.x, p.z, H.invCount(p, 'dwarf_minecart_ticket_kelda_whitewolf')], [KELDA_STAND[0], KELDA_STAND[1], 1]);
H.setVar(p, 'fishingcompo', FISHCOMP_DONE);

// Let a script run out, clicking through chat pages and taking `picks` at menus (1-based). The
// same loop the audits use - a conductor asks one question and then talks, and nothing else drives
// a dialogue from a probe.
const drive = (picks: number[] = []): string[] => {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 400 && idle < 3; guard++) {
        const sc = p.activeScript;
        if (!sc || sc.execution !== ScriptState.PAUSEBUTTON) {
            if (!sc && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) break;
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(sc, true, true);
        }
    }
    return H.ifaces.slice(from).filter((i: any) => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map((i: any) => i.text!);
};

console.log('\nTHE CONDUCTORS, who take the fare in coins instead');
for (const [nm, x, z, lx, lz, picks] of [
    ['dwarf_city_train_conductor7', 2995, 9837, KELDA_LAND[0], KELDA_LAND[1], [1]],
    ['dwarf_city_train_conductor6', 2874, 9872, KELDA_LAND[0], KELDA_LAND[1], [1]],
    ['dwarf_city_train_conductor4', 2906, 10171, ICE_LAND[0], ICE_LAND[1], [1]]
] as [string, number, number, number, number, number[]][]) {
    H.clearInv(p);
    goTo(x + 1, z);
    H.give(p, 'coins', 500);
    const npc = H.npcNear(nm, x, z, 0);
    if (!npc) {
        check(`${nm} is spawned near ${x},${z}`, false, true);
        continue;
    }
    const before = H.invCount(p, 'coins');
    H.opNpc(p, npc, 1);
    const said = drive([...picks]);
    p.closeModal();
    check(`${nm}: a seat for 150, and it lands you`, [p.x, p.z, before - H.invCount(p, 'coins')], [lx, lz, 150]);
    console.log(`        said: ${said.join(' | ').slice(0, 160) || '(nothing)'}`);
}

// and the fare is halved by a Ring of charos(a)
H.clearInv(p);
goTo(2996, 9837);
H.give(p, 'coins', 500);
H.equip(p, { ring: 'ring_of_charos_unlocked' });
const npc7 = H.npcNear('dwarf_city_train_conductor7', 2995, 9837, 0);
if (npc7) {
    const before = H.invCount(p, 'coins');
    H.opNpc(p, npc7, 1);
    drive([1]);
    p.closeModal();
    check('a Ring of charos(a) halves the fare', before - H.invCount(p, 'coins'), 75);
}

// LAST, NOT FIRST. isZoneAllocated is false until something has been in the zone, so asking this
// before the rides reported all three arrival tiles as blocked - a probe telling itself the station
// it had not visited yet does not exist.
console.log('\nAND EVERY ARRIVAL TILE IS FLOOR, asked after a player has been in each zone');
check('the Keldagrim depot platform', standable(KELDA_LAND[0], KELDA_LAND[1]), true);
check('the Dwarven Mine station', standable(ICE_LAND[0], ICE_LAND[1]), true);
check('the White Wolf passage', standable(WOLF_LAND[0], WOLF_LAND[1]), true);

console.log(bad === 0 ? '\nall checks passed' : `\n${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
