// Charter ships, end to end through the real triggers. Scratch scenario for the feat-charter work.
import World from '#/engine/World.js';
import * as H from '../sim/harness.js';
import Component from '#/cache/config/Component.js';
import LocType from '#/cache/config/LocType.js';
import IfSetHide from '#/network/game/server/model/IfSetHide.js';
import Player from '#/engine/entity/Player.js';
import { isMapBlocked, findPath } from '#/engine/GameMap.js';

await H.boot();
H.loginOrder();
const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const hidden = new Map<string, boolean>();
const origWrite = (Player.prototype as any).write;
(Player.prototype as any).write = function (m: any) {
    if (m instanceof IfSetHide) hidden.set(Component.get(m.component).comName ?? String(m.component), m.hidden);
    return origWrite.call(this, m);
};
const at = (p: any) => `${p.x},${p.z},${p.level}`;
const cont = (p: any) => {
    // a chat page's "click here to continue" resumes whatever is paused on it
    if (!p.activeScript) return false;
    p.executeScript(p.activeScript, true, true);
    return true;
};
const coins = (p: any) => H.invCount(p, 'coins');
const isOpen = (p: any, name: string) => p.modalMain === Component.getId(name);
const openCharter = (p: any, crew: any, op: number) => {
    hidden.clear();
    H.opNpc(p, crew, op);
    for (let t = 0; t < 15 && !isOpen(p, 'charter'); t++) H.tick(1);
};
const walk = (p: any, x: number, z: number) => {
    p.clearPendingAction();
    p.queueWaypoints(findPath(p.level, p.x, p.z, x, z));
};
const shown = (k: string) => hidden.get(`charter:${k}_port`) === false;
let bucket = 1;

// --- Port Sarim to Catherby: 1,000 coins, and the deck beside Catherby's gangplank
console.log('PORT SARIM -> CATHERBY');
{
    const p = H.makePlayer('sailor', 3040, 3193, bucket++);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'coins', 1500);
    const crew = H.npcNear('trader_crewmember_1', 3042, 3192);
    console.log('  crewmember 1 on the Sarim pier at', crew ? `${crew.x},${crew.z},${crew.level}` : 'MISSING');
    openCharter(p, crew!, 4);
    check('the charter map opened', isOpen(p, 'charter'), true);
    check('origin', H.getVar(p, 'charter_origin'), 0);
    check('shown: sarim (here), catherby, brimhaven, khazard', ['sarim', 'catherby', 'brimhaven', 'khazard'].map(shown), [true, true, true, true]);
    check('hidden: musa (no route), phasmatys/shipyard/tyras (quests)', ['musa', 'phasmatys', 'shipyard', 'tyras'].map(shown), [false, false, false, false]);
    check('crandor shown', hidden.get('charter:crandor_port'), false);
    H.clearLogs();
    H.ifButton(p, 'charter:catherby');
    H.tick(1);
    const header = H.ifaces.filter(i => i.kind === 'text' && Component.get(i.com).comName === 'multi3:com_0').map(i => i.text);
    check('the fare quoted', header, ['Sailing to Catherby costs 1000 coins.']);
    const m0 = H.mesgs.length;
    hidden.clear();
    check('Okay', H.choose(p, 'multi3:com_1'), true);
    const t0 = World.currentTick;
    for (let t = 0; t < 12 && p.z < 3300; t++) H.tick(1);
    console.log('  voyage ticks:', World.currentTick - t0);
    H.tick(1);
    check('coins after', coins(p), 500);
    check('landed on', at(p), '2792,3417,1');
    console.log('  messages:', H.mesgs.slice(m0).filter(m => m.who === 'sailor').map(m => m.text));
    check('the voyage showed sarim and catherby only', ['sarim', 'catherby', 'brimhaven', 'khazard'].map(shown), [true, true, false, false]);
    check('...and nothing to click', [hidden.get('charter:catherby'), hidden.get('charter:close_frame')], [true, true]);
    cont(p);
    H.tick(1);
    const plankOff = LocType.getId('charter_gangplank_off');
    const offAt: string[] = [];
    for (let x = 2785; x <= 2800; x++) for (let z = 3410; z <= 3425; z++) for (let l = 0; l < 2; l++) if (World.getLoc(x, z, l, plankOff)) offAt.push(`${x},${z},${l}`);
    console.log('  charter_gangplank_off at', offAt);
    if (offAt.length) {
        const [gx, gz] = offAt[0].split(',').map(Number);
        H.opLoc(p, gx, gz, 'charter_gangplank_off', 1);
        for (let t = 0; t < 10 && p.level !== 0; t++) H.tick(1);
        H.tick(1);
        check('crossed the gangplank onto the pier', [p.level, isMapBlocked(p.x, p.z, 0)], [0, false]);
        console.log('  now at', at(p));
    }
    H.despawn(p);
}

// --- not enough coins
console.log('NOT ENOUGH COINS');
{
    const p = H.makePlayer('skint', 3040, 3193, bucket++);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'coins', 999);
    const crew = H.npcNear('trader_crewmember_2', 3039, 3193);
    openCharter(p, crew!, 4);
    H.ifButton(p, 'charter:catherby');
    H.tick(1);
    const s0 = H.ifaces.length;
    H.choose(p, 'multi3:com_1');
    H.tick(3);
    const said = H.ifaces.slice(s0).filter(i => i.kind === 'text').map(i => i.text);
    check('refused', said.some(t => (t ?? '').includes('enough coins')), true);
    check('coins kept', coins(p), 999);
    check('still in Port Sarim', [p.level, p.z < 3200], [0, true]);
    H.despawn(p);
}

// --- discounts: Cabin Fever halves, the ring of Charos (a) halves again
console.log('DISCOUNTS');
{
    const p = H.makePlayer('thrifty', 3040, 3193, bucket++);
    H.tick(1);
    H.setVar(p, 'fever_quest', 7);
    H.equip(p, { ring: 'ring_of_charos_unlocked' });
    check('Sarim -> Catherby with both', H.runProc(p, '[proc,charter_fare]', [0, 2]), [250]);
    H.setVar(p, 'fever_quest', 0);
    check('Sarim -> Catherby with the ring', H.runProc(p, '[proc,charter_fare]', [0, 2]), [500]);
    check('Sarim -> Musa (no route)', H.runProc(p, '[proc,charter_fare]', [0, 4]), [-1]);
    H.despawn(p);
}

// --- the talk, the refusals, the quest ports, Crandor, the shop
console.log('TALK AND RULES');
{
    const p = H.makePlayer('talker', 3040, 3193, bucket++);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'coins', 5000);
    const stan = H.npcNear('trader_stan', 3041, 3193);
    check('Trader Stan on the Sarim pier', stan ? `${stan.x},${stan.z}` : 'MISSING', stan ? `${stan.x},${stan.z}` : 'x');
    // Talk-To, "Yes, I would like to charter a ship."
    const texts = () => H.ifaces.filter(i => i.kind === 'text').map(i => i.text ?? '');
    H.clearLogs();
    H.opNpc(p, stan!, 1);
    for (let t = 0; t < 10 && !texts().includes('Can I help you?'); t++) H.tick(1);
    cont(p);
    H.tick(1);
    H.choose(p, 'multi3:com_2');
    H.tick(1);
    for (let i = 0; i < 4 && !isOpen(p, 'charter'); i++) { cont(p); H.tick(1); }
    check('Talk-To, charter: "Certainly, sir" and the map', [texts().some(t => t.startsWith('Certainly, sir.')), isOpen(p, 'charter')], [true, true]);
    // the port you are at
    H.clearLogs();
    H.ifButton(p, 'charter:sarim');
    H.tick(1);
    check('choosing Port Sarim at Port Sarim', texts().some(t => t.includes('Why do you want to travel')), true);
    cont(p);
    H.tick(1);
    H.choose(p, 'multi2:com_1');
    H.tick(1);
    check('...and choosing again reopens the map', isOpen(p, 'charter'), true);
    // Crandor
    H.clearLogs();
    H.ifButton(p, 'charter:crandor');
    H.tick(1);
    check('Crandor', texts().some(t => t.startsWith('Crandor? Are you crazy?')), true);
    cont(p);
    H.tick(2);
    // the quest ports appear with their quests
    H.setVar(p, 'priestperil', 60);
    H.setVar(p, 'mm_main', 1);
    H.setVar(p, 'regicide_quest', 15);
    openCharter(p, stan!, 4);
    check('with Priest in Peril, Monkey Madness started and Regicide: phasmatys, shipyard, tyras shown', ['phasmatys', 'shipyard', 'tyras'].map(shown), [true, true, true]);
    H.ifButton(p, 'charter:tyras');
    H.tick(1);
    H.choose(p, 'multi3:com_1');
    for (let t = 0; t < 12 && p.x > 2500; t++) H.tick(1);
    H.tick(1);
    check('Port Sarim -> Port Tyras for 3,200', [at(p), coins(p)], ['2142,3125,1', 1800]);
    cont(p);
    H.tick(1);
    p.closeModal();
    // the rum
    p.teleport(3040, 3193, 0);
    H.give(p, 'karamja_rum', 1);
    H.tick(1);
    H.clearLogs();
    openCharter(p, stan!, 4);
    H.tick(2);
    check('carrying rum: refused, no map', [texts().some(t => t.includes('smuggle that rum')), isOpen(p, 'charter')], [true, false]);
    cont(p);
    H.tick(1);
    // Trade
    H.clearLogs();
    H.opNpc(p, stan!, 3);
    for (let t = 0; t < 10 && !isOpen(p, 'shop_template'); t++) H.tick(1);
    check("Trade opens Trader Stan's Trading Post", [isOpen(p, 'shop_template'), texts().includes("Trader Stan's Trading Post.")], [true, true]);
    H.despawn(p);
}

// --- every port
console.log('EVERY PORT');
const PORTS: [string, number, string, number, number, number, number][] = [
    // key, id, a crewmember, crew x, z, an inland tile x, z
    ['sarim', 0, 'trader_crewmember_1', 3042, 3192, 3027, 3217],
    ['brimhaven', 1, 'trader_crewmember_5', 2759, 3239, 2772, 3226],
    ['catherby', 2, 'trader_crewmember_3', 2796, 3415, 2809, 3435],
    ['musa', 4, 'trader_crewmember_2', 2954, 3156, 2946, 3150],
    ['khazard', 5, 'trader_crewmember_6', 2673, 3144, 2665, 3151],
    ['phasmatys', 6, 'trader_crewmember_4', 3701, 3502, 3690, 3497],
    ['shipyard', 7, 'trader_crewmember_1', 3001, 3033, 3000, 3049],
    ['tyras', 8, 'trader_crewmember_5', 2145, 3122, 2173, 3150],
];
for (const [key, id, npc, cx, cz, ix, iz] of PORTS) {
    const crew = H.npcNear(npc, cx, cz);
    check(`${key}: ${npc} spawned near ${cx},${cz}`, crew ? Math.max(Math.abs(crew.x - cx), Math.abs(crew.z - cz)) <= 2 : 'MISSING', true);
    const w = H.makePlayer('walker' + id, cx, cz, bucket++);
    H.tick(1);
    walk(w, ix, iz);
    for (let t = 0; t < 120 && !(w.x === ix && w.z === iz); t++) H.tick(1);
    check(`${key}: walked from the pier to ${ix},${iz}`, at(w), `${ix},${iz},0`);
    H.despawn(w);
    const p = H.makePlayer('lander' + id, cx, cz, bucket++);
    H.tick(1);
    H.maxOut(p);
    const arrive = H.runProc(p, '[proc,charter_arrive]', [id])[0];
    const ax = (arrive >> 14) & 0x3fff, az = arrive & 0x3fff, al = (arrive >>> 28) & 3;
    p.teleport(ax, az, al);
    H.tick(2);
    const plankOff = LocType.getId('charter_gangplank_off');
    let off: [number, number] | null = null;
    for (let x = ax - 4; x <= ax + 4; x++) for (let z = az - 4; z <= az + 4; z++) if (World.getLoc(x, z, al, plankOff)) off = [x, z];
    check(`${key}: landing ${ax},${az},${al} is open deck with a gangplank off in reach`, [isMapBlocked(ax, az, al), off !== null], [false, true]);
    if (off) {
        H.opLoc(p, off[0], off[1], 'charter_gangplank_off', 1);
        for (let t = 0; t < 10 && p.level !== 0; t++) H.tick(1);
        H.tick(1);
        check(`${key}: across the gangplank to ${at(p)}`, [p.level, isMapBlocked(p.x, p.z, 0)], [0, false]);
        // and back aboard by the pier-side one
        const plankOn = LocType.getId('charter_gangplank_on');
        let on: [number, number] | null = null;
        for (let x = p.x - 4; x <= p.x + 4; x++) for (let z = p.z - 4; z <= p.z + 4; z++) if (World.getLoc(x, z, 0, plankOn)) on = [x, z];
        if (on) {
            H.opLoc(p, on[0], on[1], 'charter_gangplank_on', 1);
            for (let t = 0; t < 10 && p.level !== 1; t++) H.tick(1);
            H.tick(1);
            check(`${key}: back aboard to ${at(p)}`, [p.level, isMapBlocked(p.x, p.z, 1)], [1, false]);
        } else check(`${key}: a gangplank on beside the pier`, false, true);
    }
    if (crew) {
        H.clearLogs();
        // stand on a free pier tile beside the crewmember
        const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !isMapBlocked(crew.x + dx, crew.z + dz, 0))!;
        p.teleport(crew.x + free[0], crew.z + free[1], 0);
        H.tick(1);
        openCharter(p, crew, 4);
        check(`${key}: the map knows where it is`, H.getVar(p, 'charter_origin'), id);
        p.closeModal();
    }
    H.despawn(p);
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
