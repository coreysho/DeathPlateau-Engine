// Two owner reports, held to the real engine - run with `npx tsx tools/sim/npcbehave.ts [crabs|wolf]`.
// Read the verdict off the printed "N ok, M FAIL" line as well as the exit code.
//
//   crabs   "rock crabs arent attackable" / "arent agressive & dont become active when approached".
//           The Rellekka coast only ever spawns the DORMANT forms (horror_rockcrab_inactive and
//           horror_rockcrab_small_inactive, npc 1266/1268 - the awake 1265/1267 are placed in no
//           .jm2 in the build), so everything a player can see or click is the dormant one, and the
//           raw cache gave that form no ops and no huntmode at all. This walks a player onto a real
//           coast spawn and asks whether it wakes, whether what it becomes carries Attack and real
//           stats, whether it hits the player unprompted, whether the player can hit it back, and
//           whether it settles back into a rock once it is left alone. It also sweeps every dormant
//           crab in the world for a reveal handler, so a spawn that can never wake cannot creep back.
//
//   wolf    "in witches house quest the 4th experiment(wolf) phases through objects". The fight is
//           inside the witch's shed (x 2934-2937 by z 3459-3467, the `wood1` box that
//           quest_ball.rs2's own inzone check names). The engine refuses every step the collision
//           map disallows, so nothing walks THROUGH a loc - but shapeshifterwolf was the only npc in
//           the 377 cache built on model1=npc_wolf without size=2, so its 2x2 body stood on a 1x1
//           footprint and three quarters of it went through the shed's crate, sacks, trough and
//           walls. This runs the real four-form fight and asks, every tick, whether any tile the npc
//           occupies is one the collision map blocks.
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import HuntType from '#/cache/config/HuntType.js';
import Player from '#/engine/entity/Player.js';
import * as rsbuf from '#/network/rsbuf/index.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { canTravel, isFlagged } from '#/engine/GameMap.js';

await H.boot();
H.loginOrder();

// AGGRESSION NEEDS AN AUDIENCE. World's player-hunt sweep only runs for an npc that some player is
// actually being sent (`rsbuf.getNpcObservers(npc.nid) > 0`), and that count is kept by the npc-info
// encoder, which in the live server is driven from NetworkPlayer - a socket. A sim player is a plain
// Player with no socket, so nothing ever builds its npc info, every npc in every sim reads as
// unobserved, and no huntmode=player npc in the game can find anybody. Driving rsbuf.npcInfo per
// player per tick is the same call NetworkPlayer makes, with the same arguments; it is the socket
// that is stubbed here, not the hunt.
function tickSeen(n = 1) {
    for (let i = 0; i < n; i++) {
        H.tick(1);
        for (const pl of World.playerLoop.all()) {
            if (!(pl instanceof Player)) continue;
            rsbuf.npcInfo(0, pl.slot, Math.abs(pl.lastTickX - pl.x), Math.abs(pl.lastTickZ - pl.z), (pl as unknown as { lastLevel: number }).lastLevel !== pl.level);
        }
    }
}

const only = process.argv.slice(2).find(a => !a.startsWith('-'));
let ok = 0,
    bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) ok++;
    else bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const name = (n: Npc) => NpcType.get(n.type).debugname ?? String(n.type);

// ---------------------------------------------------------------- rock crabs
if (!only || only === 'crabs') {
    console.log('\n== rock crabs ==');

    // Every dormant crab type must have a reveal handler on the trigger its huntmode can reach.
    // cowardly's find_newmode is opplayer2, so [ai_opplayer2] is the one - an [ai_queue1] here would
    // be dead code, which is how the Waterbirth Boulder sat broken.
    for (const dormant of ['horror_rockcrab_inactive', 'horror_rockcrab_small_inactive']) {
        const t = NpcType.get(NpcType.getId(dormant));
        check(`${dormant} hunts for someone to wake for`, [t.huntmode >= 0, t.huntrange, t.wanderrange], [true, 1, 0]);
        check(`${dormant} has a reveal on [ai_opplayer2]`, ScriptProvider.getByTrigger(ServerTriggerType.AI_OPPLAYER2, t.id, t.category) !== null, true);
    }
    for (const awake of ['horror_rockcrab', 'horror_rockcrab_small']) {
        const t = NpcType.get(NpcType.getId(awake));
        check(`${awake} carries Attack and real stats`, [t.op?.[1] ?? null, t.stats[3]], ['Attack', 50]);
    }

    // A real coast spawn from m41_58.jm2 (the Rellekka rock crab beach).
    const dormant = H.npcNear('horror_rockcrab_inactive', 2666, 3715);
    if (!dormant) {
        check('a dormant crab is spawned on the Rellekka coast', false, true);
    } else {
        const spot = { x: dormant.x, z: dormant.z, nid: dormant.nid };
        console.log(`  found horror_rockcrab_inactive at ${spot.x},${spot.z}`);
        const p = H.makePlayer('crabber', spot.x + 4, spot.z, 91);
        H.tick(2);
        H.maxOut(p);
        H.clearInv(p);
        // A maxed player is too strong for a level 13 to hunt (cowardly's check_nottoostrong), so the
        // rock is walked past by someone it would really attack.
        p.levels.fill(5);
        p.baseLevels.fill(5);
        p.levels[3] = 50;
        p.baseLevels[3] = 50;

        // Walk right up beside it, the way a player crossing the beach does.
        H.walkTo(p, spot.x + 1, spot.z);
        tickSeen(10);
        const after = World.getNpc(spot.nid);
        const nowIs = after && after.isActive ? name(after) : '(despawned)';
        console.log(`  after walking past: nid ${spot.nid} is ${nowIs}`);
        check('the rock woke into an attackable Rock Crab', nowIs, 'horror_rockcrab');
        if (after && after.isActive) {
            check('and it woke with the Rock Crab\'s own hitpoints, not the rock\'s', after.baseLevels[3], 50);

            H.clearLogs();
            tickSeen(20);
            check('it attacked the player unprompted', H.hits.filter(h => h.who === 'crabber').length > 0, true);

            H.clearLogs();
            H.attackNpc(p, after);
            tickSeen(15);
            check('the player could attack it back', H.npcHits.filter(h => h.who === 'horror_rockcrab').length > 0, true);

            // Left alone, it hides again. Walk the player well clear first, or the 1-tile hunt wakes
            // it straight back up - which is itself the right behaviour.
            p.teleport(spot.x + 25, spot.z + 25, 0);
            tickSeen(120);
            const later = World.getNpc(spot.nid);
            check('left alone, it settles back into a rock', later && later.isActive ? name(later) : '(gone)', 'horror_rockcrab_inactive');
            check('and the rock can wake again (huntmode re-read off the type it became)', later ? later.huntMode >= 0 && later.huntrange === 1 : false, true);
        }
    }
}

// ------------------------------- the same bug in the Waterbirth Island maze
// The Boulder and the Rock down in the dagannoth maze are the same mechanic and carried the same two
// faults (an [ai_queue1] reveal a cowardly hunt can never reach, and a keepall changetype that would
// have left a 1 hitpoint boss). Walked to at a real spawn from m28_68.jm2.
if (!only || only === 'boulder') {
    console.log('\n== waterbirth boulder / rock ==');
    for (const [disguise, revealed, hp] of [
        ['giant_rockcrab_hidden_deeper', 'giant_rockcrab_deeper', 180],
        ['dagannoth_rock_lobster_2x2_loc', 'dagannoth_rock_lobster_2x2', 120]
    ] as [string, string, number][]) {
        const dt = NpcType.get(NpcType.getId(disguise));
        check(`${disguise} has a reveal on [ai_opplayer2]`, ScriptProvider.getByTrigger(ServerTriggerType.AI_OPPLAYER2, dt.id, dt.category) !== null, true);
        check(`${disguise} hunts on a mode its vislevel=hide can pass`, HuntType.get(dt.huntmode).checkNotTooStrong, 0);
        void revealed;
        void hp;
    }
    // A real Boulder spawn on the maze's second floor (m28_68.jm2, level 2).
    const boulder = H.npcNear('giant_rockcrab_hidden_deeper', 1803, 4365, 2);
    if (!boulder) {
        check('a Boulder is spawned in the maze', false, true);
    } else {
        const p = H.makePlayer('maze', boulder.x, boulder.z, 95);
        H.tick(2);
        H.maxOut(p);
        H.clearInv(p);
        // huntrange is measured from the npc's south-west tile, so a 2x2 Boulder only counts a player
        // standing against THAT corner as one tile away. Stand on the first free tile beside it.
        let placed = false;
        for (const [dx, dz] of [
            [-1, 0],
            [0, -1],
            [-1, -1],
            [1, 0],
            [0, 1]
        ] as [number, number][]) {
            if (isFlagged(boulder.x + dx, boulder.z + dz, 2, CollisionFlag.WALK_BLOCKED)) continue;
            p.teleport(boulder.x + dx, boulder.z + dz, 2);
            placed = true;
            break;
        }
        check('there is a tile to stand on beside the Boulder', placed, true);
        tickSeen(12);
        const now = World.getNpc(boulder.nid);
        check('the Boulder reveals when walked up to', now && now.isActive ? name(now) : '(gone)', 'giant_rockcrab_deeper');
        check('and reveals with the Giant Rock Crab\'s own hitpoints', now ? now.baseLevels[3] : 0, 180);
    }
}

// ------------------------------------------------------- witch's house wolf
if (!only || only === 'wolf') {
    console.log('\n== witch\'s house experiment ==');

    // Every form's footprint must match the model it is drawn from.
    for (const [form, size] of [
        ['shapeshifterglob', 1],
        ['shapeshifterspider', 1],
        ['shapeshifterbear', 2],
        ['shapeshifterwolf', 2]
    ] as [string, number][]) {
        check(`${form} size`, NpcType.get(NpcType.getId(form)).size, size);
    }

    const p = H.makePlayer('witch', 2935, 3463, 94);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, { rhand: 'rune_scimitar' });
    H.setVar(p, 'ballquest', 5);

    // Every tick, for every experiment npc alive: was the step it just took one the collision map
    // allows, and is every tile of its footprint one it is allowed to stand on? A body that overlaps
    // a blocked tile is a body inside the crate.
    const MODEL_FOOTPRINT: Record<string, number> = { shapeshifterglob: 1, shapeshifterspider: 1, shapeshifterbear: 2, shapeshifterwolf: 2 };
    let illegal = 0;
    let overlapping = 0;
    const seen = new Map<number, { x: number; z: number }>();
    const watch = () => {
        for (const npc of World.npcs) {
            if (!npc || !npc.isActive) continue;
            const t = NpcType.get(npc.type);
            if (!(t.debugname ?? '').startsWith('shapeshifter')) continue;
            const was = seen.get(npc.nid);
            if (was && (was.x !== npc.x || was.z !== npc.z)) {
                const dx = npc.x - was.x,
                    dz = npc.z - was.z;
                const oneStep = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
                if (!oneStep || !canTravel(0, was.x, was.z, dx, dz, t.size, CollisionFlag.BLOCK_NPC_AND_PLAYERS, CollisionType.NORMAL)) {
                    illegal++;
                    console.log(`    tick ${World.currentTick} ${t.debugname}: ${was.x},${was.z} -> ${npc.x},${npc.z} is not a step the map allows`);
                }
            }
            // The whole MODEL's footprint, not the declared size and not just the south-west tile.
            // Asking about t.size would be circular: an npc whose declared size is too small is
            // exactly the bug, and the tiles its body clips through are the ones t.size leaves out.
            // The numbers below are what the model is drawn at, read off every other npc in the 377
            // cache built on the same model (npc_wolf and npc_brownbear are 2x2 everywhere, npc_skavid
            // and poh_giantspider_8 are 1x1 everywhere).
            const drawn = MODEL_FOOTPRINT[t.debugname ?? ''] ?? t.size;
            for (let ox = 0; ox < drawn; ox++) {
                for (let oz = 0; oz < drawn; oz++) {
                    if (isFlagged(npc.x + ox, npc.z + oz, 0, CollisionFlag.WALK_BLOCKED)) {
                        overlapping++;
                        console.log(`    tick ${World.currentTick} ${t.debugname} at ${npc.x},${npc.z} has its body inside blocked tile ${npc.x + ox},${npc.z + oz}`);
                    }
                }
            }
            seen.set(npc.nid, { x: npc.x, z: npc.z });
        }
    };
    const tick = (n = 1) => {
        for (let i = 0; i < n; i++) {
            tickSeen(1);
            watch();
        }
    };
    const live = (): Npc | null => {
        for (const npc of World.npcs) {
            if (npc && npc.isActive && (NpcType.get(npc.type).debugname ?? '').startsWith('shapeshifter')) return npc;
        }
        return null;
    };

    // The quest's own spawn: npc_add(^ball_experiment_spawn_coord, shapeshifterglob, 500).
    H.addNpc('shapeshifterglob', 2935, 3462);
    tick(1);
    const forms: string[] = [];
    // The player is walked from end to end of z=3465, the row directly under the shed's furniture
    // (sacks, table and chair fill 2934-2936 at z=3466), and back down the middle. Anything the size
    // of a wolf following along that row has its northern half inside the furniture unless the server
    // knows how big it is - which is the whole report.
    for (let form = 0; form < 8; form++) {
        const npc = live();
        if (!npc) break;
        const nm = NpcType.get(npc.type).debugname ?? '?';
        if (forms[forms.length - 1] !== nm) forms.push(nm); // a form that outlasts one 80-tick window

        const spots: [number, number][] = [
            [2934, 3465],
            [2937, 3465],
            [2934, 3462],
            [2937, 3462]
        ];
        for (let i = 0; i < 80 && npc.isActive; i++) {
            if (i % 10 === 0) {
                const [sx, sz] = spots[((i / 10) | 0) % spots.length];
                p.teleport(sx, sz, 0);
            }
            H.attackNpc(p, npc);
            tick(1);
        }
        tick(4); // let the death queue put the next form down
    }
    // And the same question asked of the shed as a whole, which does not depend on where the fight
    // happened to wander: for every tile inside the shed that the engine would let this npc stand on
    // (its declared size x size block is clear), is every tile its MODEL covers clear too? With the
    // wolf declared 1x1 the engine is happy to park it anywhere along z=3465, and its northern half
    // is then inside the sacks, the table and the smashed chair that fill z=3466. Declared 2x2, the
    // engine refuses those tiles itself and there is nothing left to clip.
    let clippable = 0;
    for (const [form, drawn] of Object.entries(MODEL_FOOTPRINT)) {
        const declared = NpcType.get(NpcType.getId(form)).size;
        for (let x = 2934; x <= 2937; x++) {
            for (let z = 3459; z <= 3467; z++) {
                let canStand = true;
                for (let ox = 0; ox < declared && canStand; ox++) for (let oz = 0; oz < declared; oz++) if (isFlagged(x + ox, z + oz, 0, CollisionFlag.WALK_BLOCKED)) canStand = false;
                if (!canStand) continue;
                for (let ox = 0; ox < drawn; ox++) {
                    for (let oz = 0; oz < drawn; oz++) {
                        if (isFlagged(x + ox, z + oz, 0, CollisionFlag.WALK_BLOCKED)) {
                            clippable++;
                            console.log(`    ${form} may stand at ${x},${z} with its body inside blocked ${x + ox},${z + oz}`);
                        }
                    }
                }
            }
        }
    }
    check('no form can stand anywhere in the shed with its body inside the scenery', clippable, 0);
    check('the fight ran all four forms through to the wolf', forms, ['shapeshifterglob', 'shapeshifterspider', 'shapeshifterbear', 'shapeshifterwolf']);
    check('no experiment took a step the collision map disallows', illegal, 0);
    check('no experiment stood with its body inside a blocking loc', overlapping, 0);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad === 0 ? 0 : 1);
