// Temple of Ikov: why the Fire Warrior of Lesarkus arrives and is gone two ticks later.
//
// The quest manifest's nearnpc step sees him at 2646,9868 and its fight step, which ticks twice
// before it looks, does not. Nothing in fire_warrior_of_leskarus.rs2 despawns him and the door
// gives him a thousand ticks, so this walks the ticks one at a time and says which one loses him.
//
//   NODE_MEMBERS=true npx tsx tools/sim/ikovwarrior.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

const p: any = H.makePlayer('ikfw', 2647, 9869);
H.tick(2);
p.teleport(2647, 9869, 0);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.setVar(p, 'ikov', 30); // ^ikov_pulled_lever: the stage the door summons him at
H.tick(1);

const id = NpcType.getId('ikov_firewarrior');
const find = () => {
    for (const npc of World.npcs) {
        if (npc && npc.type === id) {
            return npc;
        }
    }
    return null;
};

console.log('');
console.log('IKOV FIRE WARRIOR');
console.log('  before the door: ' + (find() ? 'present' : 'absent'));

H.opLoc(p, 2646, 9870, 'ikov_firewarriordoor', 1);
for (let t = 1; t <= 14; t++) {
    H.tick(1);
    const n: any = find();
    console.log(
        '  tick ' + String(t).padStart(2) + '  ' +
            (n
                ? 'present at ' + n.x + ',' + n.z + ' L' + n.level +
                  '  active=' + n.isActive + ' hp=' + (n.levels ? n.levels[3] : '?') + ' mode=' + n.mode +
                  ' lifecycle=' + n.lifecycle + ' tele=' + n.lifecycleTick
                : 'GONE')
    );
}
