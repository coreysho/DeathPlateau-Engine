// A LOC THAT SPAWNS SOMETHING, WATCHED TICK BY TICK. Three approaches to one loc, printing where
// the player ended up, what the script is doing, and whether the npc is there yet.
//
// Written for Elemental Workshop I's elemental rock, which reported ok and woke nothing three runs
// running while this probe woke it every time. The difference was the runner, not the content:
// drive() stops after three idle ticks and a player with a combat target is never idle, so the loc
// step spent its whole 600-tick guard on a fight that an immune sim player and an aggressive npc
// cannot finish - and npc_add had given the elemental 500 ticks to live. questrun grew a `brief`
// option for the loc step out of this.
import * as H from './harness.js';
import { travel } from './questrun.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

const ROCK: [number, number] = [2693, 9906];
const want = NpcType.getId('earth_elemental_rock_version');
const wander = NpcType.getId('elemental_earth');

const p: any = H.makePlayer('ewrock', 2698, 9904);
H.tick(2);
p.teleport(2698, 9904, 0);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
for (const o of ['knife', 'bronze_pickaxe', 'thread', 'hammer', 'needle', 'leather']) H.give(p, o, 1);
H.give(p, 'coal', 4);
H.tick(1);

const rocks = () =>
    [...World.npcs]
        .filter(n => n && n.isActive && n.type === want && n.level === 0)
        .map(n => `${n.x},${n.z}`)
        .join(' ') || 'none';
const closeWanderer = () => {
    const n = [...World.npcs]
        .filter(x => x && x.isActive && x.type === wander && x.level === 0)
        .sort((a, b) => Math.max(Math.abs(a.x - p.x), Math.abs(a.z - p.z)) - Math.max(Math.abs(b.x - p.x), Math.abs(b.z - p.z)))[0];
    return n ? `${n.x},${n.z} d${Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z))}` : 'none';
};

for (const [fx, fz] of [
    [2696, 9904],
    [2694, 9906],
    [2697, 9906]
]) {
    const why = travel(p, fx, fz, 0, 48, 0);
    H.tick(2);
    const mark = H.mesgs.length;
    const imark = H.ifaces.length;
    let sent = false;
    try {
        sent = H.opLoc(p, ROCK[0], ROCK[1], 'elemental_workshop_rock', 1);
    } catch (e) {
        console.log('  opLoc threw ' + String(e).slice(0, 90));
    }
    console.log('');
    console.log(`asked to stand at ${fx},${fz} -> ${p.x},${p.z}${why ? '  (' + why + ')' : ''}  sent ${sent}  nearest wanderer ${closeWanderer()}`);
    for (let t = 0; t < 24; t++) {
        H.tick(1);
        if ([2, 5, 10, 16, 24].includes(t + 1)) {
            console.log(
                `  t${String(t + 1).padStart(2)}  at ${p.x},${p.z}  script ${p.activeScript ? p.activeScript.execution : '-'}  ` +
                    `delayed ${p.delayed ? 1 : 0}  target ${p.target ? 'yes' : 'no'}  rocks [${rocks()}]`
            );
        }
    }
    const said = H.mesgs.slice(mark).map(x => x.text);
    const iface = H.ifaces.slice(imark).filter((i: any) => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map((i: any) => i.text);
    console.log('  said [' + said.join(' | ') + ']  iface [' + iface.slice(0, 6).join(' | ') + ']');
}
process.exit(0);
