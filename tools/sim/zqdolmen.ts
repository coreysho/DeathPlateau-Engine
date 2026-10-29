// WHY DOES TOUCHING RASHILIYIA'S DOLMEN SUMMON NOTHING? Stand in the tomb with the quest at the
// stage the walk reaches, click the dolmen, and print every npc near the player tick by tick.
//   NODE_MEMBERS=true npx tsx tools/sim/zqdolmen.ts [beads 0|1]
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import { drive } from './a1lib.js';

await H.boot();

const WEAR_BEADS = (process.argv[2] ?? '1') === '1';

const p: any = H.makePlayer('zqdolmen', 2892, 9486);
H.tick(2);
p.teleport(2892, 9486, 0);
p.applyDamage = function () {};
H.maxOut(p);
H.runProc(p, '[proc,player_combat_stat]');
H.setVar(p, 'zombiequeen', 12); // ^zombiequeen_unlocked_tombdoor
H.setVar(p, 'zq_map_mechanisms', Number(process.argv[3] ?? 384));
H.equip(p, { rhand: 'dragon_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
if (WEAR_BEADS) H.equip(p, { front: 'zqdeadbeads' });
H.tick(2);

const near = (r: number) => {
    const out: string[] = [];
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > r) continue;
        out.push((NpcType.get(npc.type).debugname ?? String(npc.type)) + '@' + npc.x + ',' + npc.z);
    }
    return out.join(' ');
};

console.log('beads worn:', H.invCount(p, 'zqdeadbeads'), 'worn slot:', p.getInventory(3) ? 'inv' : '-');
console.log('player at', p.x, p.z, ' stage', H.getVar(p, 'zombiequeen'), ' near:', near(8));
const mark = H.mesgs.length;
H.opLoc(p, 2892, 9487, 'zqrashdolmen', 2);
try {
    for (const l of drive(p, [])) if (!/^(Zqdolmen|126|2,277|Total XP|[0-9]+ \/ 108|Collections|Game mode|Players online|[0-9]+$)/.test(l)) console.log('  SAID ' + l);
} catch (e) {
    console.log('drive threw:', String(e).slice(0, 160));
}
for (const m of H.mesgs.slice(mark)) console.log('  MES  ' + m.text);
for (let t = 1; t <= 4; t++) {
    H.tick(10);
    console.log('after ' + t * 10 + ' ticks: at ' + p.x + ',' + p.z + '  near: ' + near(10) + '  mech=' + H.getVar(p, 'zq_map_mechanisms'));
}
// --- and the summon on its own, from the same tile and the same state
console.log('--- calling [label,summon_nazastarool] directly');
try {
    H.runProc(p, '[label,summon_nazastarool]');
} catch (e) {
    console.log('runProc threw:', String(e).slice(0, 200));
}
for (let t = 1; t <= 3; t++) {
    H.tick(10);
    console.log('after ' + t * 10 + ' more: near: ' + near(10));
}
process.exit(0);
