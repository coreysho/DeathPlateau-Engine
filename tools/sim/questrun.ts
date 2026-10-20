// A QUEST PLAYED THROUGH ON FOOT, rather than simulated.
//
// Every other sim in this directory teleports. a1lib's talk() tries ten tiles around the npc until
// one of them lets the op through, which is fine for testing a dialogue and useless for testing a
// QUEST: a player who is already standing next to Glough's cage never finds out that it is sealed on
// all four sides, and a player who blinks into Zanaris never finds out that the gate has no handler.
// Both of those were real bugs, both were reported by the owner, and no sim in this directory could
// have found either one.
//
// So this runner has no teleport in it. A step either walks, or it fails and says where it stopped.
//
//   go      travel on foot. A BFS over the engine's own canTravel finds the route and the player is
//           fed one waypoint per tick, which is what a client does. No route = the step fails.
//   talk    opnpc from wherever the player is standing, and let the ENGINE route the last stretch
//           with its real pathfinder - which will not open a door or climb a ladder. If the player
//           never gets there the step fails, and that is the finding rather than an inconvenience.
//   loc     the same for a loc click, with the route a client would send.
//   give    an item the player would have bought or banked. Declared, never assumed: the list of
//           gives IS the quest's item requirement, and the run prints it at the end.
//   stage   assert the quest's own progress variable. A step that does not move it is a step that
//           did nothing, however much dialogue it produced.
//
// Assertions that fail are recorded and the run carries on, so one pass gives the whole picture.
// Anything that leaves the player unable to continue stops the run and names the step.
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import { findNpc, drive, useOn, useOnNpc } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import JavaRandom from '#/util/JavaRandom.js';
import Npc from '#/engine/entity/Npc.js';

/** The nearest tile within `radius` holding this ground obj, or null. */
function groundObj(p: Player, objName: string, radius: number): [number, number] | null {
    const id = ObjType.getId(objName);
    for (let r = 0; r <= radius; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                const x = p.x + dx;
                const z = p.z + dz;
                if (World.getObj(x, z, p.level, id, p.hash64) ?? World.getObj(x, z, p.level, id, -1n)) return [x, z];
            }
        }
    }
    return null;
}

export type Step =
    | { go: [number, number] | [number, number, number]; why?: string; r?: number; exact?: boolean }
    | { talk: string; picks?: (number | string)[]; op?: number; want?: string; why?: string; tries?: number; until?: string; soft?: boolean }
    | { loc: string; at: [number, number]; op?: number; picks?: (number | string)[]; want?: string; why?: string; soft?: boolean; exact?: boolean; tries?: number; until?: string; first?: string }
    | { held: string; op?: number; picks?: (number | string)[]; want?: string; why?: string; tries?: number; until?: string }
    | { use: [string, string]; picks?: (number | string)[]; want?: string; why?: string }
    | { useLoc: string; at: [number, number]; obj: string; picks?: (number | string)[]; want?: string; why?: string; soft?: boolean }
    | { useNpc: string; obj: string; picks?: (number | string)[]; want?: string; why?: string; tries?: number; until?: string }
    | { give: string; n?: number }
    | { setvar: string; to: number; why?: string }
    | { stage: number }
    | { level: number }
    | { varis: string; to: number }
    | { wait: number; why?: string }
    | { take: string; why?: string; r?: number; soft?: boolean }
    | { setpos: [number, number, number]; why: string }
    | { has: string; n?: number }
    | { worn: string }
    | { hasnt: string }
    | { fight: string | string[]; until?: string; untilvar?: string; to?: number; tries?: number; r?: number; why?: string }
    | { nearnpc: string; r?: number; why?: string }
    | { sneak: [number, number]; past: string; r?: number; tol?: number; why?: string }
    | { hunt: [string, number, number][]; untilnpc: string; untilvar?: string; to?: number; tries?: number; why?: string }
    | { herd: string; at: [number, number]; gate: [number, number, number, number]; untilvar: string; bit: number; tries?: number; why?: string }
    | { press: string; n?: number; why?: string }
    | { say: (number | string)[]; want?: string; why?: string }
    | { rng: number | null; why?: string }
    | { note: string };

export type Manifest = {
    quest: string;
    source: string; // the guide this step list came from
    stageVar: string; // the quest's own progress varp or varbit
    done: number; // its value at completion
    start: [number, number, number];
    steps: Step[];
};

const W = 66; // how wide a step line is before the verdict column

// DID THE PLAYER GET THERE? This is the one question the runner cannot afford to get wrong, because
// getting it wrong means a step that did nothing is reported as a pass, which is worse than no audit
// at all. Three earlier answers were all wrong, each in its own way:
//
//   activeScript      a suspended script means a dialogue opened - but a door, a ladder or a chest
//                     runs to completion inside one tick and suspends nothing, so every one of
//                     those read as a player stuck outside the thing it had just operated.
//   target === null    the engine also clears the queued interaction when the ROUTE gives up, so a
//                     ladder the player never reached read as a successful climb, and the next step
//                     then failed on the wrong floor - blaming the chest for the ladder's mistake.
//   any script ran     the player's interfaces are redrawn periodically by scripts of their own
//                     ("Total XP", "Players online"), so this passed a crone the player never
//                     walked to. It was the worst of the three: a silent false pass.
//
// So the test is POSITIONAL, which is what the question actually means: after the click, is the
// player standing next to the thing. A dialogue still counts on its own, because a chat interface
// cannot open unless the content ran.
function arrive(p: Player, tx: number, tz: number, tw = 1, tl = 1, ticks = 50): boolean {
    const level0 = p.level;
    const near = () => {
        const dx = Math.max(tx - p.x, 0, p.x - (tx + tw - 1));
        const dz = Math.max(tz - p.z, 0, p.z - (tz + tl - 1));
        return Math.max(dx, dz) <= 1;
    };
    // A STAIRCASE MOVES YOU, so standing next to it afterwards is the wrong question: Draynor
    // Manor's crypt stairs leave the player at 3077,9771, six thousand tiles from the step they
    // clicked, and the positional test called that a player who never got there. Changing level, or
    // ending up further from the loc than any route to it could have taken you, can only be the op
    // having run.
    const jumped = () => p.level !== level0 || Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz)) > 64;
    // ALREADY STANDING THERE IS NOT THE SAME AS THE OP HAVING RUN. Returning the moment the
    // player was adjacent made every repeat click on an npc they were already next to look
    // delivered when the engine had not processed it yet - forty hands of Rune-Draw that were
    // never dealt. Give the op a few ticks to run before proximity is allowed to count.
    for (let t = 0; t < ticks; t++) {
        if (p.activeScript) return true;
        if (t >= 4 && (near() || jumped()) && !p.hasWaypoints()) return true;
        H.tick(1);
    }
    return !!p.activeScript || near() || jumped();
}

/** For a click with no target to walk to - an inventory op. Just let the script run. */
function quiet(p: Player, ticks = 10): void {
    for (let t = 0; t < ticks; t++) {
        if (p.activeScript) return;
        H.tick(1);
    }
}

export type Result = { n: number; what: string; ok: boolean; detail: string };

/** A walkable route between two tiles, by the engine's own canTravel. [] means there is none. */
export function route(level: number, x: number, z: number, tx: number, tz: number, radius = 96, tol = 0): number[][] {
    const key = (a: number, b: number) => a * 20000 + b;
    const prev = new Map<number, number>();
    const seen = new Set<number>([key(x, z)]);
    let q: number[][] = [[x, z]];
    while (q.length) {
        const next: number[][] = [];
        for (const [cx, cz] of q) {
            if (Math.max(Math.abs(cx - tx), Math.abs(cz - tz)) <= tol) {
                const out: number[][] = [];
                let cur = key(cx, cz);
                while (cur !== key(x, z)) {
                    out.unshift([Math.floor(cur / 20000), cur % 20000]);
                    cur = prev.get(cur)!;
                }
                return out;
            }
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]) {
                const nx = cx + dx,
                    nz = cz + dz,
                    k = key(nx, nz);
                if (seen.has(k)) continue;
                if (Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
                if (!canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                seen.add(k);
                prev.set(k, key(cx, cz));
                next.push([nx, nz]);
            }
        }
        q = next;
    }
    return [];
}


/**
 * A LOC YOU CAN WALK ON IS USED FROM ITS OWN TILE, not from beside it. The route an interaction
 * sends goes adjacent, which is right for a door or a chest and wrong for a farming patch: rake in
 * hand, standing one tile north of Unferth's patch, and nothing happens at all - in silence,
 * because the handler's p_arrivedelay never completes.
 */
function standOnIfWalkable(p: Player, name: string, x: number, z: number): void {
    try {
        if (LocType.get(LocType.getId(name)).blockwalk) return;
    } catch {
        return;
    }
    travel(p, x, z, p.level, 48, 0);
}

/** Walk a route, one waypoint a tick, the way a client feeds them. Returns '' or why it failed. */
export function travel(p: Player, tx: number, tz: number, level = p.level, radius = 96, tol = 2): string {
    if (p.level !== level) {
        return 'on level ' + p.level + ', not ' + level + ' - no step so far changed your floor';
    }
    if (Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz)) <= tol) return '';
    const path = route(level, p.x, p.z, tx, tz, radius, tol);
    if (!path.length) {
        return 'NO WALKABLE ROUTE from ' + p.x + ',' + p.z + ' to ' + tx + ',' + tz;
    }
    let done = 0;
    for (const [sx, sz] of path) {
        for (let t = 0; t < 12 && (p.x !== sx || p.z !== sz); t++) {
            H.walkTo(p, sx, sz);
            H.tick(1);
        }
        if (p.x !== sx || p.z !== sz) break;
        done++;
    }
    const off = Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz));
    if (off > tol) {
        return 'stopped at ' + p.x + ',' + p.z + ', ' + done + ' tiles into a ' + path.length + '-tile route';
    }
    return '';
}

// PRODDING AN ANIMAL ACROSS A FIELD. Sheep Herder's cattleprod moves a sheep one tile directly
// away from the player, and ~coord_direction only ever answers N/S/E/W, so the player has to stand
// SQUARE behind it: a diagonal reads as east or west and sends the sheep sideways.
//
// That makes "where can this sheep be pushed" a different graph from "where can this sheep walk".
// A tile with a wall behind it cannot be pushed away from that wall at all, because there is
// nowhere for the player to stand, so the route has to be planned over moves that are legal for
// BOTH of them. Planning it as a walk instead sends the sheep into a corner it cannot leave, which
// is exactly where the first version of this got stuck, eight prods in a row with nothing moving.
const D4: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function stepOk(level: number, x: number, z: number, dx: number, dz: number): boolean {
    return canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL);
}

/** Can anything stand here? True if some neighbour can walk onto the tile. */
function standable(level: number, x: number, z: number): boolean {
    for (const [dx, dz] of D4) if (stepOk(level, x - dx, z - dz, dx, dz)) return true;
    return false;
}

/** The tiles to push an npc through to get it into the box, or null if it cannot be done. */
export function prodPlan(
    level: number,
    sx: number,
    sz: number,
    box: [number, number, number, number]
): [number, number][] | null {
    const key = (a: number, b: number) => a * 20000 + b;
    const inBox = (x: number, z: number) => x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3];
    const prev = new Map<number, number>();
    const seen = new Set<number>([key(sx, sz)]);
    let q: [number, number][] = [[sx, sz]];
    let rounds = 0;
    while (q.length && rounds < 400) {
        rounds++;
        const next: [number, number][] = [];
        for (const [x, z] of q) {
            if (inBox(x, z)) {
                const out: [number, number][] = [];
                let cur = key(x, z);
                while (cur !== key(sx, sz)) {
                    out.unshift([Math.floor(cur / 20000), cur % 20000]);
                    cur = prev.get(cur)!;
                }
                return out;
            }
            for (const [dx, dz] of D4) {
                const nx = x + dx;
                const nz = z + dz;
                if (Math.abs(nx - sx) > 80 || Math.abs(nz - sz) > 80) continue;
                if (seen.has(key(nx, nz))) continue;
                if (!stepOk(level, x, z, dx, dz)) continue;
                if (!standable(level, x - dx, z - dz)) continue;
                seen.add(key(nx, nz));
                prev.set(key(nx, nz), key(x, z));
                next.push([nx, nz]);
            }
        }
        q = next;
    }
    return null;
}

export function stageOf(p: Player, name: string): number {
    if (VarBitType.getId(name) !== -1) return H.getVarBit(p, name);
    if (VarPlayerType.getByName(name)) return H.getVar(p, name);
    throw new Error('no such varp or varbit: ' + name);
}

export function play(m: Manifest, p: Player): Result[] {
    const out: Result[] = [];
    const gives: string[] = [];
    let n = 0;
    let stopped = '';
    console.log('');
    console.log(m.quest);
    console.log('  step list from ' + m.source);
    console.log('  progress read off ' + m.stageVar + ', complete at ' + m.done);

    for (const s of m.steps) {
        if (stopped) break;

        if ('note' in s) {
            console.log('');
            console.log('      -- ' + s.note);
            continue;
        }
        if ('give' in s) {
            H.give(p, s.give, s.n ?? 1);
            gives.push(s.n && s.n > 1 ? s.give + ' x' + s.n : s.give);
            continue;
        }
        if ('setvar' in s) {
            try {
                H.setVarBit(p, s.setvar, s.to);
            } catch {
                H.setVar(p, s.setvar, s.to);
            }
            H.tick(1);
            console.log('      -- ' + s.setvar + ' = ' + s.to + (s.why ? '   (' + s.why + ')' : ''));
            continue;
        }

        n++;
        const label = (t: string) => (t.length > W ? t.slice(0, W - 1) + '~' : t.padEnd(W));
        const soft_step = 'soft' in s && s.soft === true;
        const hard = (what: string, ok: boolean, detail = '') => {
            out.push({ n, what, ok: ok || soft_step, detail });
            console.log('  ' + String(n).padStart(2) + '. ' + label(what) + (ok ? ' ok' : soft_step ? ' --' : ' FAIL') + (detail ? '  ' + detail : ''));
            if (!ok && !soft_step) stopped = what;
        };
        const soft = (what: string, ok: boolean, detail = '') => {
            out.push({ n, what, ok, detail });
            console.log('  ' + String(n).padStart(2) + '. ' + label(what) + (ok ? ' ok' : ' NO') + (detail ? '  ' + detail : ''));
        };

        if ('go' in s) {
            const x = s.go[0];
            const z = s.go[1];
            const lvl = s.go.length > 2 ? (s.go[2] as number) : p.level;
            const err = travel(p, x, z, lvl, s.r ?? 96, s.exact ? 0 : 2);
            hard('walk to ' + x + ',' + z + (s.why ? ' - ' + s.why : ''), !err, err);
            continue;
        }
        if ('take' in s) {
            // A REAL CLICK, not a lift. a1lib's take() deletes the obj and hands the player the
            // item, which is harmless for an egg on a coop floor and useless for the ghost's
            // skull: [opobj3,ghostskull] IS that step of The Restless Ghost, setting the stage and
            // spawning the skeleton, and the lift left the quest sitting at stage 3 while the
            // inventory check passed. So walk to it and send op 3, which is the ground Take.
            n++;
            const label2 = (x: string) => (x.length > W ? x.slice(0, W - 1) + '~' : x.padEnd(W));
            const what2 = 'pick up ' + s.take + (s.why ? ' - ' + s.why : '');
            const before = H.invCount(p, s.take);
            const at = groundObj(p, s.take, s.r ?? 6);
            let got = false;
            let why = 'nothing on the floor nearby';
            if (at) {
                // A LEFTOVER DELAY OR AN OPEN CHAT WINDOW EATS THE CLICK, and the engine drops it
                // without a word - the same thing that ate forty hands of Rune-Draw. So clear both
                // and allow a couple of goes, which is what a player does anyway.
                for (let a = 0; a < 3 && !got; a++) {
                    for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                    (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                    H.tick(1);
                    // STAND ON IT FIRST. A ground obj is picked up from its own tile, and the
                    // interaction route only goes adjacent, so the walk is done here and exactly -
                    // the fish food on the manor's first floor was two tiles away and stayed there.
                    let err = travel(p, at[0], at[1], p.level, 48, 0);
                    if (err) {
                        // UNLESS THE TILE IS UNDER THE FURNITURE. Monk's Friend leaves the child's
                        // blanket on the thieves' table, which is a blocking loc, so there is no
                        // route onto its tile at all - and the engine does not need one: reachedObj
                        // accepts a click from a tile beside the obj. So fall back to a neighbour
                        // and let the engine's own rule decide, rather than this runner's.
                        let beside = false;
                        for (const [dx, dz] of D4) {
                            if (!travel(p, at[0] + dx, at[1] + dz, p.level, 48, 0)) {
                                beside = true;
                                break;
                            }
                        }
                        if (!beside) {
                            why = err;
                            continue;
                        }
                        err = '';
                    }
                    if (!H.opObj(p, at[0], at[1], s.take, 3, false)) {
                        why = 'the player was delayed and the click was thrown away';
                        H.tick(5);
                        continue;
                    }
                    arrive(p, at[0], at[1]);
                    drive(p, []);
                    got = H.invCount(p, s.take) > before;
                    if (!got) why = 'clicked Take at ' + at[0] + ',' + at[1] + ' and it never arrived; the player is at ' + p.x + ',' + p.z + ', the obj is ' + (groundObj(p, s.take, 1) ? 'still there' : 'gone') + ', target=' + !!p.target + ', free=' + (p.getInventory(InvType.INV)?.freeSlotCount ?? '?');
                }
            }
            // A CLICK THAT IS MEANT TO FAIL. Witch's House spawns the shapeshifter the first time
            // anybody reaches for the ball, and the ball stays where it is - so that click has to
            // be sent and must not stop the run.
            const softTake = 'soft' in s && s.soft === true;
            out.push({ n, what: what2, ok: got || softTake, detail: got ? '' : why });
            console.log('  ' + String(n).padStart(2) + '. ' + label2(what2) + (got ? ' ok' : softTake ? ' --' : ' FAIL') + (!got && softTake ? '  ' + why : ''));
            if (!got && !softTake) stopped = what2;
            continue;
        }
        if ('setpos' in s) {
            // THE ONE DELIBERATE CHEAT, and it has to say so. This runner exists because the other
            // sims teleport, so a jump in a manifest is only ever allowed for a stretch of WORLD
            // travel that is not the quest - and it prints a line of its own so nobody can mistake
            // a jumped leg for a walked one. Every use needs a reason in .
            // CLEAR THE ROUTE FIRST. A jump with waypoints still queued is undone by the engine on
            // the next tick - it carries on walking the old path from the new tile - which is how a
            // jump to 3017,5201 ended up at 3030,5203.
            p.clearPendingAction();
            p.queueWaypoints([]);
            p.teleport(s.setpos[0], s.setpos[1], s.setpos[2]);
            H.tick(2);
            console.log('      -- JUMPED to ' + s.setpos[0] + ',' + s.setpos[1] + ' L' + s.setpos[2] + ': ' + s.why);
            continue;
        }
        if ('wait' in s) {
            H.tick(s.wait);
            console.log('      -- waited ' + s.wait + ' ticks' + (s.why ? '   (' + s.why + ')' : ''));
            continue;
        }
        // A RANDOMISED STEP CANNOT BE ASSERTED. Curpile Fyod asks three of six questions at
        // random, so a manifest that names the three answers is right one time in six - and a check
        // that fails five times in six is not a check, it is noise. This pins the engine's own RNG
        // to a fixed return for as long as the randomised step lasts, and `rng: null` puts the real
        // one back, because pinning it through a FIGHT would make every hit roll zero.
        if ('rng' in s) {
            const rng: any = JavaRandom;
            if (s.rng === null) {
                if (rng.__realNextDouble) rng.nextDouble = rng.__realNextDouble;
                console.log('      -- rng back to normal' + (s.why ? '   (' + s.why + ')' : ''));
            } else {
                if (!rng.__realNextDouble) rng.__realNextDouble = rng.nextDouble.bind(rng);
                const v = s.rng;
                rng.nextDouble = () => v;
                console.log('      -- rng pinned to ' + v + (s.why ? '   (' + s.why + ')' : ''));
            }
            continue;
        }
        if ('varis' in s) {
            const got = stageOf(p, s.varis);
            soft(s.varis + ' is ' + s.to, got === s.to, 'it is ' + got);
            continue;
        }
        if ('level' in s) {
            soft('standing on level ' + s.level, p.level === s.level, 'on level ' + p.level + ' at ' + p.x + ',' + p.z);
            continue;
        }
        if ('stage' in s) {
            const got = stageOf(p, m.stageVar);
            soft(m.stageVar + ' is now ' + s.stage, got === s.stage, got === s.stage ? '' : 'it is ' + got);
            continue;
        }
        if ('has' in s) {
            const got = H.invCount(p, s.has);
            soft('carrying ' + (s.n ?? 1) + ' x ' + s.has, got >= (s.n ?? 1), 'has ' + got);
            continue;
        }
        if ('worn' in s) {
            // WEARING IT IS NOT THE SAME AS CLICKING WEAR, and the difference is invisible from
            // outside: [opheld2,_] matches every obj in the game, so a `held` step on something
            // with no wearpos reports ok, ~equip bails on the DEBUG line, and the player walks on
            // in their own face. The Feud's own disguise is exactly that - the cache has one
            // unwearable combined obj and one with three wearpos entries - and the playthrough
            // only found out eleven steps later, at a cactus.
            const inv = p.getInventory(InvType.WORN);
            let on = 0;
            if (inv) {
                for (let i = 0; i < inv.capacity; i++) {
                    const o = inv.get(i);
                    if (o && ObjType.get(o.id).debugname === s.worn) on++;
                }
            }
            soft('wearing ' + s.worn, on > 0, on > 0 ? 'on' : 'it is not on');
            continue;
        }
        if ('herd' in s) {
            // ONE SHEEP, ONE INSTANCE. There are three spawns of every plaguesheep type, so
            // "nearest sheep of this type" changes under you the moment one of the others wanders
            // closer - the first run of this herded four different sheep a few tiles each and
            // reported that none of them would move. Lock on to the npc and follow it by identity.
            const what0 = 'herd ' + s.herd + (s.why ? ' - ' + s.why : '');
            const sheep = H.npcNear(s.herd, s.at[0], s.at[1], p.level);
            if (!sheep) {
                hard(what0, false, 'no ' + s.herd + ' anywhere near ' + s.at[0] + ',' + s.at[1]);
                continue;
            }
            const done = () => (stageOf(p, s.untilvar) & (1 << s.bit)) !== 0;
            const maxProds = s.tries ?? 400;
            let prods = 0;
            let stillness = 0;
            let stranded = 0;
            let why = '';
            while (prods < maxProds && !done()) {
                if (!sheep.isValid()) {
                    why = 'the sheep vanished at ' + sheep.x + ',' + sheep.z + ' without the quest noticing';
                    break;
                }
                const inGate =
                    sheep.x >= s.gate[0] && sheep.x <= s.gate[2] && sheep.z >= s.gate[1] && sheep.z <= s.gate[3];
                let dx = 0;
                let dz = 0;
                if (inGate) {
                    // in the gateway: one more prod from any side and it jumps in
                    for (const [ax, az] of D4) {
                        if (standable(p.level, sheep.x - ax, sheep.z - az)) {
                            dx = ax;
                            dz = az;
                            break;
                        }
                    }
                } else {
                    const plan = prodPlan(p.level, sheep.x, sheep.z, s.gate);
                    if (!plan || !plan.length) {
                        // THE JUMP TAKES A FEW TICKS. The prod that lands a sheep in the gateway
                        // teleports it inside, waits two ticks and only then deletes it and sets
                        // the quest bit, so for that window the npc is standing in a walled pen
                        // with no route anywhere and nothing to say it has been herded. Give it a
                        // moment before calling that a dead end.
                        stranded++;
                        if (stranded > 6) {
                            why = 'no way to prod it from ' + sheep.x + ',' + sheep.z + ' to the pen';
                            break;
                        }
                        H.tick(5);
                        continue;
                    }
                    stranded = 0;
                    dx = plan[0][0] - sheep.x;
                    dz = plan[0][1] - sheep.z;
                }
                const err = travel(p, sheep.x - dx, sheep.z - dz, p.level, 32, 0);
                if (err) {
                    why = 'could not get behind it: ' + err;
                    break;
                }
                const before = sheep.x * 20000 + sheep.z;
                H.opNpc(p, sheep, 1);
                H.tick(6);
                prods++;
                stillness = sheep.x * 20000 + sheep.z === before ? stillness + 1 : 0;
                if (stillness > 8) {
                    why = 'eight prods in a row and it has not moved, at ' + sheep.x + ',' + sheep.z;
                    break;
                }
            }
            if (done()) {
                hard(what0, true, prods + ' prods');
            } else {
                hard(what0, false, why || 'still loose after ' + prods + ' prods');
            }
            continue;
        }
        if ('hunt' in s) {
            // CLICK THESE UNTIL SOMETHING COMES OUT. A Soul's Bane's Fear room is six holes with
            // one reaper hiding in a different one every time, and a loc step cannot tell the
            // difference between "nothing in there" and a click the engine threw away - so the only
            // honest test is to keep looking until the thing is out.
            const want = NpcType.getId(s.untilnpc);
            const near = () =>
                [...World.npcs].some(
                    n => n && n.isActive && n.type === want && n.level === p.level && Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) <= 40
                );
            const triesHunt = ('tries' in s ? s.tries : undefined) ?? 3;
            // With untilvar the step is the whole room, not one look: keep opening holes AND
            // killing whatever comes out until the counter says it is done. Splitting the two in
            // the manifest did not work - the reaper is aggressive, so the player kills it during
            // the looking, and the next step then finds nothing and calls it a failure.
            const huntVar = 'untilvar' in s ? s.untilvar : undefined;
            const huntTo = 'to' in s ? s.to : undefined;
            const done = () => (huntVar ? stageOf(p, huntVar) === huntTo : near());
            const kill = () => {
                let npc = null;
                try {
                    npc = findNpc(s.untilnpc, p);
                } catch {
                    npc = null;
                }
                if (!npc) return;
                H.maxOut(p);
                for (let k = 0; k < 300 && npc.isValid(); k++) {
                    if (!p.target && !(p as unknown as { delayed: boolean }).delayed) {
                        (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                        H.attackNpc(p, npc);
                    }
                    H.tick(1);
                }
                H.tick(6);
            };
            let found = done();
            for (let a = 0; a < triesHunt && !found; a++) {
                for (const [name, x, z] of s.hunt) {
                    if (found) break;
                    const err = travel(p, x, z, p.level, 48, 2);
                    if (err) continue;
                    for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                    try {
                        if (!H.opLoc(p, x, z, name, 1)) continue;
                    } catch {
                        continue;
                    }
                    arrive(p, x, z);
                    drive(p, []);
                    H.tick(2);
                    if (huntVar) kill();
                    found = done();
                }
            }
            soft(
                'look in ' + s.hunt.length + ' places for ' + s.untilnpc + (huntVar ? ' until ' + huntVar + ' is ' + huntTo : '') + (s.why ? ' - ' + s.why : ''),
                found,
                found ? 'done' : huntVar ? huntVar + ' got to ' + stageOf(p, huntVar) : 'nothing came out of any of them'
            );
            continue;
        }
        if ('say' in s) {
            // ANSWER A DIALOGUE NOBODY CLICKED. Delrith's incantation is four options put to the
            // player by a queue that the KILL started, not by talking to anyone, so there is no
            // click to hang the picks on.
            const mark = H.mesgs.length;
            let said: string[] = [];
            let blew = '';
            try {
                said = drive(p, s.say.slice());
            } catch (e) {
                blew = String(e).replace('Error: ', '');
            }
            const joinedSay = said.concat(H.mesgs.slice(mark).map(x => x.text)).join(' ');
            if (blew) soft('answer ' + JSON.stringify(s.say) + (s.why ? ' - ' + s.why : ''), false, blew);
            else if (s.want && !joinedSay.includes(s.want)) soft('answer ' + JSON.stringify(s.say) + (s.why ? ' - ' + s.why : ''), false, 'nothing said "' + s.want + '"');
            else soft('answer ' + JSON.stringify(s.say) + (s.why ? ' - ' + s.why : ''), true);
            continue;
        }
        if ('press' in s) {
            // A BUTTON ON AN INTERFACE, which drive() cannot reach: it only knows the multi1..5
            // option lists, and a make-x panel (skillmulti1..5) is a different interface with its
            // own buttons. Spinning wool opens one of those, so there is no way to spin without it.
            //
            // Two kinds of button end up here. A dialogue's resume button is answered by choose(),
            // which the engine is waiting for; a plain [if_button,...] on an open interface is not
            // waited for at all and has to be sent. Tribal Totem's combination lock is the second
            // kind, and `n` is for it: the four dials only step one letter at a time, so the
            // combination is sixty-six presses and nobody wants sixty-six lines of report.
            const times = ('n' in s ? s.n : undefined) ?? 1;
            const whatPress = 'press ' + s.press + (times > 1 ? ' x' + times : '') + (s.why ? ' - ' + s.why : '');
            let pressed = 0;
            let errPress = '';
            for (let i = 0; i < times; i++) {
                try {
                    if (!H.choose(p, s.press)) H.ifButton(p, s.press);
                    pressed++;
                } catch (e) {
                    errPress = String(e).replace('Error: ', '');
                    break;
                }
                for (let t = 0; t < 20 && p.activeScript; t++) H.tick(1);
            }
            soft(whatPress, pressed === times, errPress || (pressed === times ? '' : pressed + ' of ' + times + ' went through'));
            continue;
        }
        if ('sneak' in s) {
            // WALKING PAST SOMETHING THAT MUST NOT SEE YOU. The witch patrols the middle of her
            // garden and teleports anybody who comes within three tiles with a clear line - which
            // is what the wiki means by "move around the edge, using the hedges as cover". A plain
            // `go` walks the route at full speed and gets caught halfway round, so this one steps a
            // tile at a time and waits whenever the next tile would be inside her range.
            const whatSneak = 'sneak past ' + s.past + ' to ' + s.sneak[0] + ',' + s.sneak[1] + (s.why ? ' - ' + s.why : '');
            const keepOut = ('r' in s ? s.r : undefined) ?? 4;
            const path = route(p.level, p.x, p.z, s.sneak[0], s.sneak[1], 96, ('tol' in s ? s.tol : undefined) ?? 0);
            if (!path.length) {
                hard(whatSneak, false, 'NO WALKABLE ROUTE from ' + p.x + ',' + p.z + ' to ' + s.sneak[0] + ',' + s.sneak[1]);
                continue;
            }
            let waited = 0;
            let blocked = '';
            for (const [sx, sz] of path) {
                // hold while the step would take us inside its range
                for (let w = 0; w < 60; w++) {
                    const npc = H.npcNear(s.past, p.x, p.z, p.level);
                    if (!npc) break;
                    const d = Math.max(Math.abs(npc.x - sx), Math.abs(npc.z - sz));
                    if (d > keepOut) break;
                    H.tick(1);
                    waited++;
                }
                for (let t = 0; t < 12 && (p.x !== sx || p.z !== sz); t++) {
                    H.walkTo(p, sx, sz);
                    H.tick(1);
                }
                if (p.x !== sx || p.z !== sz) {
                    blocked = 'stopped at ' + p.x + ',' + p.z + ' on the way to ' + sx + ',' + sz;
                    break;
                }
            }
            const offSneak = Math.max(Math.abs(p.x - s.sneak[0]), Math.abs(p.z - s.sneak[1]));
            hard(whatSneak, offSneak <= (('tol' in s ? s.tol : undefined) ?? 0), blocked || (offSneak > 0 ? 'ended up at ' + p.x + ',' + p.z : waited + ' ticks held back'));
            continue;
        }
        if ('nearnpc' in s) {
            // DID THE CUTSCENE ACTUALLY PRODUCE THE NPC? Ernest the Chicken's whole ending is a
            // chicken turning into a man in front of you, and it did not happen for years: the
            // changetype looked for the multinpc's child where the map spawns the parent, so the
            // quest completed, the rewards arrived, and the chicken simply stopped being drawn.
            // Nothing a stage or an inventory check can see.
            const want = NpcType.getId(s.nearnpc);
            const r = s.r ?? 8;
            let found = '';
            // A changetype or a spawn lands on a tick of its own, so give it a few rather than
            // asking in the same breath as the varp beside it.
            for (let t = 0; t < 12 && !found; t++) {
                for (const npc of World.npcs) {
                    if (!npc || !npc.isActive || npc.type !== want) continue;
                    if (npc.level !== p.level) continue;
                    if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > r) continue;
                    found = npc.x + ',' + npc.z;
                    break;
                }
                if (!found) H.tick(1);
            }
            soft(s.nearnpc + ' is here' + (s.why ? ' - ' + s.why : ''), found !== '', found
                    ? 'at ' + found
                    : 'nothing of that type within ' + r + ' tiles of ' + p.x + ',' + p.z + ' L' + p.level + '; what is there: ' +
                      [...World.npcs]
                          .filter(n => n && n.isActive && n.level === p.level && Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) <= r)
                          .map(n => NpcType.get(n!.type).debugname + '@' + n!.x + ',' + n!.z)
                          .join(' ')
                          .slice(0, 160));
            continue;
        }
        if ('hasnt' in s) {
            const got = H.invCount(p, s.hasnt);
            soft(s.hasnt + ' is gone', got === 0, 'still has ' + got);
            continue;
        }
        if ('fight' in s) {
            // KILL IT UNTIL IT DROPS THE THING, when the thing is what the step is for. Melzar the
            // Mad and the zombies in his basement are the maze's keys, and both were reported dead
            // with no key on the floor: isValid() flickers false for a respawn as well as a death,
            // so a kill that never happened read as one. With `until` the step is judged on the
            // drop, which is what the wiki means by "kill zombies until one drops it".
            const want = 'until' in s ? s.until : undefined;
            // `untilvar` is the other way a fight ends: not a drop but a counter. A Soul's Bane's
            // Anger room is "keep hitting them with the right weapon until the rage bar fills",
            // and the bar is a varbit.
            const wantVar = 'untilvar' in s ? s.untilvar : undefined;
            const wantTo = 'to' in s ? s.to : undefined;
            const label2 = (x: string) => (x.length > W ? x.slice(0, W - 1) + '~' : x.padEnd(W));
            // A LIST OF TYPES, for a thing that comes back as something else. A Soul's Bane's
            // hopeless creatures have three forms and killing one spawns the next, so "kill the
            // big ones, then the middle ones, then the small ones" is not a sequence - it is
            // whichever of the three happens to be standing in front of you.
            const types = Array.isArray(s.fight) ? s.fight : [s.fight];
            const what2 =
                'kill ' + types.join('/') +
                (want ? ' until it drops ' + want : '') +
                (wantVar ? ' until ' + wantVar + ' is ' + wantTo : '') +
                (s.why ? ' - ' + s.why : '');
            const got = () =>
                wantVar ? stageOf(p, wantVar) === wantTo : want ? !!groundObj(p, want, 14) || H.invCount(p, want) > 0 : false;
            let t = 0;
            let died = false;
            let rounds = 0;
            let missing = '';
            const maxRounds = ('tries' in s ? s.tries : undefined) ?? (want || wantVar ? 8 : 1);
            // A STATIC NPC IS NOT ACTIVE UNTIL SOMETHING IS NEAR IT, so a fight that starts in the
            // same breath as a jump finds whatever happens to be awake instead - the unicorn leg of
            // Rag and Bone Man picked one 140 tiles away, in a field the player had walked past two
            // legs earlier. Two ticks to let the zone wake up, and only look as far as `r`.
            H.tick(2);
            const rFight = ('r' in s ? s.r : undefined) ?? 32;
            const picksFight: (string | number)[] | undefined = 'picks' in s ? (s.picks as (string | number)[]) : undefined;
            // SOME SPAWNS ARE PENNED IN. Four of the goblins south of Falador stand inside a
            // fenced pocket nothing can walk into, so "the nearest goblin" can be one no player
            // will ever hit. One that lands no hit goes on this list and the step moves to the
            // next one along rather than failing the whole leg.
            const unreachable = new Set<number>();
            const nearestOf = (names: string[]) => {
                let best: Npc | null = null;
                let bestD = Infinity;
                const ids = names.map(nm => NpcType.getId(nm));
                for (const npc of World.npcs) {
                    if (!npc || !npc.isActive || npc.level !== p.level || !ids.includes(npc.type)) continue;
                    if (unreachable.has(npc.nid)) continue;
                    const d = Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z));
                    if (d <= rFight && d < bestD) {
                        bestD = d;
                        best = npc;
                    }
                }
                return best;
            };
            while (rounds < maxRounds) {
                rounds++;
                // AND WAIT FOR THE RESPAWN. Two unicorns in that field and a one-in-four bone
                // means the third round usually arrives before either of them is back, and
                // grabbing "the nearest one anywhere" instead sent the player off to the Lumbridge
                // swamp to punch at something 140 tiles away for 150 ticks.
                let npc: Npc | null = nearestOf(types);
                for (let w = 0; w < 10 && !npc; w++) {
                    H.tick(20);
                    npc = nearestOf(types);
                }
                if (!npc) {
                    for (const name of types) {
                        try {
                            npc = findNpc(name, p);
                        } catch {
                            npc = null;
                        }
                        if (npc) break;
                    }
                }
                if (!npc) {
                    missing = 'none of ' + types.join('/') + ' is spawned anywhere near ' + p.x + ',' + p.z;
                    break;
                }
                H.maxOut(p);
                // A FIGHT CAN END WITHOUT A CORPSE. Delrith is beaten down to nothing and then
                // CHANGES TYPE - npc_changetype(delrith_weakened) - so he stays a valid npc and the
                // loop would have run its 900 ticks on a demon that had already been beaten.
                const type0 = npc.type;
                // CAN THE PLAYER EVEN GET TO IT? A fight that lands no hit in 150 ticks is not a
                // long fight, it is a wall: the first Rag and Bone Man run picked a goblin in a
                // sealed part of the Goblin Cave and spent 27,000 ticks - thirty rounds of 900 -
                // clicking at something it could never reach, and reported only that no bone had
                // dropped. Bail out and name the tile instead.
                const hp0 = npc.levels[3];
                let d = false;
                for (let k = 0; k < 900 && !d; k++, t++) {
                    if (!npc.isValid() || npc.type !== type0) {
                        d = true;
                        break;
                    }
                    const adjacent = Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= 1;
                    if (k > 150 && npc.levels[3] >= hp0 && !adjacent) {
                        unreachable.add(npc.nid);
                        missing = 'no hit landed on ' + types.join('/') + ' at ' + npc.x + ',' + npc.z + ' in 150 ticks from ' + p.x + ',' + p.z + ' - it cannot be reached';
                        break;
                    }
                    // SOME FIGHTS ARE MEANT TO BE INTERRUPTED. Sir Mordred is beaten down, not
                    // killed: at low hitpoints his mother stops the fight, heals him to full and
                    // starts talking - and the re-click below closed her dialogue and went back to
                    // hitting him, so he healed over and over and the quest never moved. With
                    // `picks` the step answers the conversation instead of swinging through it.
                    if (picksFight && p.activeScript) {
                        try {
                            drive(p, [...picksFight]);
                        } catch {
                            // whatever she said, it was not the menu we had picks for
                        }
                        break;
                    }
                    // RE-CLICK WHEN THE PLAYER IS IDLE. One attack click at the start is not a
                    // fight: a door or gate op leaves the player delayed and the engine throws the
                    // click away without a word, which is how Elvarg survived 900 ticks of nothing
                    // happening with a rune scimitar in hand.
                    if (!p.target && !(p as unknown as { delayed: boolean }).delayed) {
                        if (!picksFight) {
                            (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                        }
                        H.attackNpc(p, npc);
                    }
                    H.tick(1);
                }
                H.tick(15);
                died = died || d;
                if (missing) {
                    // one penned npc is not the end of the leg; try the next one along, and only
                    // report this if there is nothing else to try
                    if (rounds < maxRounds && nearestOf(types)) {
                        missing = '';
                        continue;
                    }
                    break;
                }
                if (!(want || wantVar) || got()) break;
            }
            const ok = want || wantVar ? got() : died;
            const detail = ok
                ? t + ' ticks' + (rounds > 1 ? ', ' + rounds + ' of them' : '')
                : missing ||
                  (wantVar
                      ? 'killed ' + rounds + ' in ' + t + ' ticks and ' + wantVar + ' is ' + stageOf(p, wantVar)
                      : want
                        ? 'killed ' + rounds + ' in ' + t + ' ticks and no ' + want + ' on the floor'
                        : t + ' ticks and it is still alive');
            out.push({ n: ++n, what: what2, ok, detail });
            console.log('  ' + String(n).padStart(2) + '. ' + label2(what2) + (ok ? '  ok  ' + detail : ' FAIL  ' + detail));
            if (!ok) stopped = what2;
            continue;
        }

        // --- the clicks, each one sent from wherever the player is standing
        const mesMark = H.mesgs.length;
        // EVERY LINE SINCE THE CLICK, not only the ones drive() happened to see. drive() starts
        // counting when it is called, and arrive() returns the moment a script pauses - which for a
        // one-shot mesbox is the same tick its text was set, so the line is already behind drive's
        // mark by the time it looks. The Restless Ghost's "There's a skeleton without a skull in
        // here." came back as "nothing said" on a step that had worked perfectly.
        const ifaceMark = H.ifaces.length;
        const saidSince = (): string[] =>
            H.ifaces
                .slice(ifaceMark)
                .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
                .map(i => i.text as string);
        let lines: string[] = [];
        let unreached = '';
        const run = (picks: (number | string)[]) => {
            try {
                return drive(p, picks);
            } catch (e) {
                const msg = String(e);
                if (msg.includes('unexpected menu')) {
                    unreached = 'an unexpected menu: ' + msg.split('unexpected menu: ')[1];
                    return [];
                }
                if (msg.includes('menus not reached')) {
                    unreached = msg.split('menus not reached: ')[1] ?? '?';
                    return [];
                }
                throw e;
            }
        };
        let what = '';
        if ('talk' in s) {
            what = 'talk to ' + s.talk + (s.why ? ' - ' + s.why : '');
            let npc: ReturnType<typeof findNpc> | null = null;
            try {
                npc = findNpc(s.talk, p);
            } catch {
                npc = null;
            }
            if (!npc) {
                hard(what, false, 'no ' + s.talk + ' anywhere near ' + p.x + ',' + p.z);
                continue;
            }
            // ONE ATTEMPT IS NOT ALWAYS A FAIR TEST, and the three ways a talk can come to
            // nothing look alike from outside: the npc wandered out of reach (Kruk patrols a yard
            // no tile of which can be stood next to), the dialogue took a branch that never offered
            // the option, or it ran and refused to do the thing (the monkey child while his aunt is
            // listening). tries retries the whole click and re-finds the npc each time, because
            // it has moved.
            const tries = s.tries ?? 1;
            let reached = false;
            let far = 0;
            for (let a = 0; a < tries; a++) {
                if (a > 0) {
                    H.tick(20);
                    try {
                        npc = findNpc(s.talk, p);
                    } catch {
                        continue;
                    }
                }
                unreached = '';
                // A dialogue that ended early leaves a suspended script on the player, and the
                // engine throws the next click away while it is there. Retrying without
                // clearing it burned forty attempts on Robin without dealing a single hand.
                if (p.activeScript) {
                    p.activeScript = null;
                    // and the DELAY it was sitting in. Dropping the script without this leaves
                    // the player delayed for ever, every later click is thrown away before it
                    // reaches the content, and the trace shows forty attempts and no dialogue.
                    (p as unknown as { delayed: boolean; delayedUntil: number }).delayed = false;
                    (p as unknown as { delayed: boolean; delayedUntil: number }).delayedUntil = -1;
                    H.tick(2);
                }
                // AND THE INTERFACE. A chat window left open makes the player busy(), and the
                // engine drops a queued op on a busy player without a word - which is what ate
                // forty hands of Rune-Draw: the click was accepted and then quietly binned.
                (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                H.tick(1);
                far = Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z));
                // One arrow with the condition inside it, rather than a ternary choosing between
                // two arrows where the no-op one needed a `void _w;` body to keep eslint quiet:
                // prettier and eslint's indent rule could not agree on how to lay that out.
                const dbg = (w: string) => {
                    if (process.env.QUESTRUN_DEBUG) console.log('        attempt ' + a + ': ' + w);
                };
                if (!H.opNpc(p, npc, s.op ?? 1)) {
                    dbg('click thrown away; delayed=' + (p as unknown as { delayed: boolean }).delayed);
                    H.tick(5);
                    continue;
                }
                if (!arrive(p, npc.x, npc.z, npc.width, npc.length)) {
                    dbg('never arrived; player ' + p.x + ',' + p.z + ' npc ' + npc.x + ',' + npc.z);
                    continue;
                }
                reached = true;
                lines = run(('picks' in s ? s.picks : undefined) ?? []);
                dbg('said ' + JSON.stringify(lines.slice(0, 2)) + ' unreached=' + JSON.stringify(unreached));
                // With until, the item arriving is the signal and a leftover pick is not a
                // fault: Robin deals one hand per click, so most clicks consume one menu and
                // the run simply clicks again.
                const stalled = s.until ? H.invCount(p, s.until) === 0 : unreached !== '';
                if (!stalled) {
                    if (a > 0) what = what + ' [took ' + (a + 1) + ' attempts]';
                    break;
                }
            }
            // until not satisfied after every attempt is a failure, not a pass. Reporting ok
            // here once hid a Rune-Draw loop that never produced the bow.
            if (reached && 'until' in s && s.until && H.invCount(p, s.until) === 0) {
                hard(what, false, 'after ' + tries + ' attempts there is still no ' + s.until + '; the last one said: ' + lines.slice(0, 4).join(' | ').slice(0, 120));
                continue;
            }
            if (!reached) {
                hard(what, false, far + ' tiles off at ' + npc.x + ',' + npc.z + '; player stuck at ' + p.x + ',' + p.z);
                continue;
            }
        } else if ('loc' in s) {
            what = s.loc + ' at ' + s.at[0] + ',' + s.at[1] + (s.why ? ' - ' + s.why : '');
            // where the step was sent FROM, so a retry can stand there again rather than wherever
            // the last route left the player - Sir Vyvin's cupboard is refused from one tile and
            // allowed from the next one over.
            const fromX = p.x;
            const fromZ = p.z;
            let sent = false;
            let locw = 1;
            let locl = 1;
            try {
                const lt = LocType.get(LocType.getId(s.loc));
                locw = lt.width;
                locl = lt.length;
                standOnIfWalkable(p, s.loc, s.at[0], s.at[1]);
                sent = H.opLoc(p, s.at[0], s.at[1], s.loc, s.op ?? 1);
            } catch (_e) {
                hard(what, false, 'no ' + s.loc + ' there on level ' + p.level + ' (player at ' + p.x + ',' + p.z + ')');
                continue;
            }
            if (!sent) {
                hard(what, false, 'the player was delayed and the click was thrown away');
                continue;
            }
            if (!arrive(p, s.at[0], s.at[1], locw, locl)) {
                hard(what, false, 'player stuck at ' + p.x + ',' + p.z);
                continue;
            }
            lines = run(('picks' in s ? s.picks : undefined) ?? []);
            // SOME OPS ARE REFUSED FOR A REASON THAT PASSES. Sir Vyvin shouts at anybody who opens
            // his cupboard while he is standing next to them, and he wanders, so the search is a
            // coin toss rather than a bug - the wiki says to wait for him to walk out. `tries` is
            // for exactly that: send it again, a few ticks later, until the thing it is for happens.
            // `until` is an obj and `want` is a line of text; either will stop the retries, and the
            // obj is the better test - drive() misses a one-shot mesbox often enough that a step
            // which had worked kept trying.
            const untilLoc = 'until' in s ? s.until : undefined;
            const wantLoc = 'want' in s ? s.want : undefined;
            const triesLoc = ('tries' in s ? s.tries : undefined) ?? 1;
            const doneLoc = () =>
                untilLoc
                    ? H.invCount(p, untilLoc) > 0
                    : !wantLoc || lines.concat(saidSince(), H.mesgs.slice(mesMark).map(x => x.text)).join(' ').includes(wantLoc);
            for (let a = 1; a < triesLoc && (untilLoc || wantLoc) && !doneLoc(); a++) {
                // LEAVE AND COME BACK, which is what the wiki tells you to do about Sir Vyvin and
                // what the player has to do about any npc standing in the way: an npc parks itself
                // while somebody is next to it, so waiting on the spot waits for ever. Walking off
                // and returning lets it wander again.
                (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                for (const [dx, dz] of [
                    [0, 8],
                    [0, -8],
                    [8, 0],
                    [-8, 0]
                ]) {
                    if (!travel(p, fromX + dx, fromZ + dz, p.level, 24, 0)) break;
                }
                H.tick(25);
                travel(p, fromX, fromZ, p.level, 24, 0);
                // `first` is the op this one needs before it: a cupboard shuts itself after a
                // while, so a retry that only clicks the open one throws from then on and every
                // later try is a no-op.
                const firstLoc = 'first' in s ? s.first : undefined;
                if (firstLoc) {
                    try {
                        if (H.opLoc(p, s.at[0], s.at[1], firstLoc, 1)) {
                            arrive(p, s.at[0], s.at[1], locw, locl);
                            run([]);
                            H.tick(4);
                        }
                    } catch {
                        // already in the state `loc` wants
                    }
                }
                let sent2 = false;
                try {
                    sent2 = H.opLoc(p, s.at[0], s.at[1], s.loc, s.op ?? 1);
                } catch {
                    sent2 = false;
                }
                if (process.env.QUESTRUN_DEBUG) console.log('        retry ' + a + ': sent=' + sent2 + ' at ' + p.x + ',' + p.z);
                if (!sent2) continue;
                if (!arrive(p, s.at[0], s.at[1], locw, locl)) continue;
                lines = lines.concat(run(('picks' in s ? s.picks : undefined) ?? []));
            }
        } else if ('held' in s) {
            what = s.held + ' op' + (s.op ?? 1) + (s.why ? ' - ' + s.why : '');
            // SOME ITEM OPS ROLL FOR IT. Rubbing Sea Slug's dry sticks together is a firemaking
            // roll, so it fails some of the time at any level, and `until` names the obj that says
            // it worked - the same shape as the loc step's retries, and for the same reason.
            const triesHeld = ('tries' in s ? s.tries : undefined) ?? 1;
            const untilHeld = 'until' in s ? s.until : undefined;
            let heldok = false;
            let heldErr = '';
            for (let a = 0; a < triesHeld; a++) {
                if (a > 0) H.tick(4);
                try {
                    heldok = H.opheld(p, s.held, s.op ?? 1);
                } catch (e) {
                    heldErr = String(e).replace('Error: ', '');
                    break;
                }
                if (!heldok) break;
                quiet(p);
                lines = lines.concat(run(('picks' in s ? s.picks : undefined) ?? []));
                if (!untilHeld || H.invCount(p, untilHeld) > 0) break;
            }
            if (heldErr) {
                hard(what, false, heldErr);
                continue;
            }
            if (!heldok) {
                hard(what, false, 'not carrying it, or that op does not exist');
                continue;
            }
            if (untilHeld && H.invCount(p, untilHeld) === 0) {
                hard(what, false, 'after ' + triesHeld + ' tries there is still no ' + untilHeld);
                continue;
            }
        } else if ('use' in s) {
            what = 'use ' + s.use[0] + ' on ' + s.use[1] + (s.why ? ' - ' + s.why : '');
            let useok = false;
            try {
                useok = H.useHeldOn(p, s.use[0], s.use[1]);
            } catch (e) {
                hard(what, false, String(e).replace('Error: ', ''));
                continue;
            }
            if (!useok) {
                hard(what, false, 'one of the two is not in the inventory');
                continue;
            }
            quiet(p);
            lines = run(('picks' in s ? s.picks : undefined) ?? []);
        } else if ('useLoc' in s) {
            what = 'use ' + s.obj + ' on ' + s.useLoc + (s.why ? ' - ' + s.why : '');
            let lw = 1;
            let ll = 1;
            try {
                const lt = LocType.get(LocType.getId(s.useLoc));
                lw = lt.width;
                ll = lt.length;
                // THE PICKS GO IN HERE, not into a second drive afterwards. useOn drives as the
                // player walks, so a panel that opens on arrival - a make-x panel, for one - was
                // met with an empty pick list and the step blew up on its own menu.
                standOnIfWalkable(p, s.useLoc, s.at[0], s.at[1]);
                lines = useOn(p, s.at[0], s.at[1], s.useLoc, s.obj, ('picks' in s ? s.picks : undefined) ?? []);
            } catch (e) {
                hard(what, false, String(e).replace('Error: ', ''));
                continue;
            }
            if (!arrive(p, s.at[0], s.at[1], lw, ll)) {
                hard(what, false, 'player stuck at ' + p.x + ',' + p.z);
                continue;
            }
            lines = lines.concat(run([]));
        } else if ('useNpc' in s) {
            what = 'use ' + s.obj + ' on ' + s.useNpc + (s.why ? ' - ' + s.why : '');
            let npc = null;
            try {
                npc = findNpc(s.useNpc, p);
            } catch {
                npc = null;
            }
            if (!npc) {
                hard(what, false, 'no ' + s.useNpc + ' anywhere near ' + p.x + ',' + p.z);
                continue;
            }
            // USE-ON-NPC IS ITS OWN PACKET, not op 5. Sending op 5 reached the npc, reported a
            // delivered click and never fired [opnpcu,...] at all - three beers handed to Drunken
            // Ali with nothing to show for it. a1lib.useOnNpc sets lastUseItem and the APNPCU
            // interaction, which is what the real client does.
            // SOME USE-ONS MISS. Shearing a sheep fails one time in four by design, so the step is
            // judged on the obj it is for rather than on one click of it.
            const untilUse = 'until' in s ? s.until : undefined;
            const triesUse = ('tries' in s ? s.tries : undefined) ?? 1;
            let threw = '';
            for (let a = 0; a < triesUse; a++) {
                if (a > 0) H.tick(4);
                try {
                    lines = lines.concat(useOnNpc(p, s.useNpc, s.obj, s.picks ?? []));
                } catch (e) {
                    threw = String(e).replace('Error: ', '');
                    break;
                }
                if (!untilUse || H.invCount(p, untilUse) > 0) break;
            }
            if (threw) {
                hard(what, false, threw);
                continue;
            }
            const joinedUse = lines.concat(saidSince(), H.mesgs.slice(mesMark).map(x => x.text)).join(' ');
            if (untilUse && H.invCount(p, untilUse) === 0) {
                soft(what, false, 'after ' + triesUse + ' tries there is still no ' + untilUse);
            } else if (s.want && !joinedUse.includes(s.want)) {
                soft(what, false, 'nothing said "' + s.want + '"');
            } else {
                hard(what, true);
            }
            continue;
        }

        const joined = lines.concat(saidSince(), H.mesgs.slice(mesMark).map(x => x.text)).join(' ');
        if (unreached && !('until' in s && s.until)) {
            soft(what, false, 'the dialogue never offered the option(s) ' + unreached + '; it said: ' + joined.slice(0, 110));
            continue;
        }
        if (s.want && !joined.includes(s.want)) {
            soft(what, false, 'nothing said "' + s.want + '"; got: ' + lines.slice(0, 2).join(' | ').slice(0, 80));
        } else {
            hard(what, true);
        }
    }

    const stage = stageOf(p, m.stageVar);
    console.log('');
    if (stopped) console.log('  STOPPED at step ' + n + ': ' + stopped);
    console.log('  ' + m.stageVar + ' finished at ' + stage + (stage === m.done ? ' - COMPLETE' : ' of ' + m.done));
    if (gives.length) console.log('  items the run had to be handed: ' + gives.join(', '));
    const bad = out.filter(r => !r.ok).length;
    console.log('  ' + (out.length - bad) + ' of ' + out.length + ' checks passed');
    return out;
}
