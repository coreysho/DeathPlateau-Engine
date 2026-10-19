// THE FINISHED TEMPLE WALLS AT MORT'TON, which carry Reinforce instead of Repair and had nothing
// behind it: a player who had rebuilt a segment to the top could watch it rot back out again with
// its own option doing nothing at all.
//
//   npx tsx tools/sim/morttonwall.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

function settle(p: any, max = 40) {
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) { p.executeScript(s, true, true); continue; }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) break;
    }
    p.closeModal();
}

// A wall segment of the Mort'ton temple, found on the map rather than trusted to a coordinate.
const segment = (() => {
    const ids = ['templewall_base', 'templewall_1', 'templewall_2', 'templewall_3'].map(n => LocType.getId(n));
    for (let x = 3470; x < 3520; x++) for (let z = 3270; z < 3320; z++) {
        for (const id of ids) {
            const loc = World.getLoc(x, z, 0, id);
            if (loc) return loc;
        }
    }
    throw new Error("no temple wall in Mort'ton");
})();

const p: any = H.makePlayer('mortton', segment.x + 2, segment.z);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};
const nameAt = (x: number, z: number): string => {
    for (const loc of World.gameMap.getZone(x, z, 0).getAllLocsSafe()) {
        if (loc.x === x && loc.z === z) return LocType.get(loc.type).debugname ?? String(loc.type);
    }
    return '(nothing)';
};
const clickWall = (): string => {
    const name = nameAt(segment.x, segment.z);
    const loc = World.getLoc(segment.x, segment.z, 0, LocType.getId(name));
    if (!loc) throw new Error('the wall went missing: ' + name);
    const t = LocType.get(loc.type);
    return heard(() => {
        p.teleport(segment.x + 2, segment.z, 0);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(0, p.x, p.z, loc.x, loc.z, p.width, t.width, t.length, loc.angle, loc.shape, t.forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1);
        p.opcalled = true;
        settle(p);
    });
};
const stock = () => {
    H.give(p, 'hammer', 1);
    H.give(p, 'woodplank', 8);
    H.give(p, 'limestonebrick', 8);
    H.give(p, 'swamppaste', 50);
};

console.log('');
console.log('A WALL REBUILT TO THE TOP, AND THE ONE OPTION IT HAS LEFT');
check('only the finished segments say Reinforce; every stage below says Repair',
    [(LocType.get(LocType.getId('templewall_9')).op ?? [])[0],
        (LocType.get(LocType.getId('templewall_10')).op ?? [])[0],
        (LocType.get(LocType.getId('templewallcorner_10')).op ?? [])[0]],
    ['Repair', 'Reinforce', 'Reinforce']);
check('and both of them have a trigger now',
    [ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('templewall_10'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('templewallcorner_10'), -1) !== null],
    [true, true]);

// Rebuild the segment the way a player does, two courses at a time.
H.setVar(p, 'morttonquest', 55);   // ^mortton_rebuild_temple
H.setVar(p, 'temple_repaired_p', 0);
p.setLevel(12, 20); // 12 is Crafting
H.tick(1);
stock();
let courses = 0;
while (H.getVar(p, 'temple_repaired_p') < 10 && courses < 12) {
    clickWall();
    H.tick(4);
    courses++;
    if (H.invCount(p, 'woodplank') === 0) stock();
}
check('five repairs of two courses each take a segment to the top',
    [H.getVar(p, 'temple_repaired_p'), nameAt(segment.x, segment.z)], [10, 'templewall_10']);

stock();
const xp = p.stats[12];
const planks = H.invCount(p, 'woodplank');
const paste = H.invCount(p, 'swamppaste');
let said = clickWall();
check('Reinforce spends the same plank, brick and five paste, and pays the same 40 Crafting',
    [planks - H.invCount(p, 'woodplank'), paste - H.invCount(p, 'swamppaste'), p.stats[12] - xp], [1, 5, 400]);
check('  and leaves the wall standing, which is the whole point of it',
    [nameAt(segment.x, segment.z), said.includes('stand a while longer')], ['templewall_10', true]);

H.clearInv(p);
said = clickWall();
check('with nothing in hand it asks for the hammer first', said.includes('need a hammer'), true);
H.give(p, 'hammer', 1);
said = clickWall();
check('  and then for the stone', said.includes('limestone brick'), true);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
