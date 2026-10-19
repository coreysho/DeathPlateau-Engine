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
    | { loc: string; at: [number, number]; op?: number; picks?: (number | string)[]; want?: string; why?: string; soft?: boolean; exact?: boolean }
    | { held: string; op?: number; picks?: (number | string)[]; want?: string; why?: string }
    | { use: [string, string]; picks?: (number | string)[]; want?: string; why?: string }
    | { useLoc: string; at: [number, number]; obj: string; picks?: (number | string)[]; want?: string; why?: string }
    | { useNpc: string; obj: string; picks?: (number | string)[]; want?: string; why?: string }
    | { give: string; n?: number }
    | { setvar: string; to: number; why?: string }
    | { stage: number }
    | { level: number }
    | { varis: string; to: number }
    | { wait: number; why?: string }
    | { take: string; why?: string }
    | { setpos: [number, number, number]; why: string }
    | { has: string; n?: number }
    | { worn: string }
    | { hasnt: string }
    | { fight: string }
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
    const near = () => {
        const dx = Math.max(tx - p.x, 0, p.x - (tx + tw - 1));
        const dz = Math.max(tz - p.z, 0, p.z - (tz + tl - 1));
        return Math.max(dx, dz) <= 1;
    };
    // ALREADY STANDING THERE IS NOT THE SAME AS THE OP HAVING RUN. Returning the moment the
    // player was adjacent made every repeat click on an npc they were already next to look
    // delivered when the engine had not processed it yet - forty hands of Rune-Draw that were
    // never dealt. Give the op a few ticks to run before proximity is allowed to count.
    for (let t = 0; t < ticks; t++) {
        if (p.activeScript) return true;
        if (t >= 4 && near() && !p.hasWaypoints()) return true;
        H.tick(1);
    }
    return !!p.activeScript || near();
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
            const at = groundObj(p, s.take, 6);
            let got = false;
            let why = 'nothing on the floor nearby';
            if (at) {
                H.opObj(p, at[0], at[1], s.take, 3);
                arrive(p, at[0], at[1]);
                drive(p, []);
                got = H.invCount(p, s.take) > before;
                if (!got) why = 'clicked Take at ' + at[0] + ',' + at[1] + ' and it never arrived';
            }
            out.push({ n, what: what2, ok: got, detail: got ? '' : why });
            console.log('  ' + String(n).padStart(2) + '. ' + label2(what2) + (got ? ' ok' : ' FAIL'));
            if (!got) stopped = what2;
            continue;
        }
        if ('setpos' in s) {
            // THE ONE DELIBERATE CHEAT, and it has to say so. This runner exists because the other
            // sims teleport, so a jump in a manifest is only ever allowed for a stretch of WORLD
            // travel that is not the quest - and it prints a line of its own so nobody can mistake
            // a jumped leg for a walked one. Every use needs a reason in .
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
        if ('hasnt' in s) {
            const got = H.invCount(p, s.hasnt);
            soft(s.hasnt + ' is gone', got === 0, 'still has ' + got);
            continue;
        }
        if ('fight' in s) {
            let npc = null;
            try {
                npc = findNpc(s.fight, p);
            } catch {
                npc = null;
            }
            if (!npc) {
                hard('kill ' + s.fight, false, 'it is not spawned anywhere near ' + p.x + ',' + p.z);
                continue;
            }
            H.maxOut(p);
            H.attackNpc(p, npc);
            let t = 0;
            for (; t < 900 && npc.isValid(); t++) H.tick(1);
            // A kill is not finished when the corpse goes away: the death hook runs on the NPC and
            // then queues a script on the PLAYER - [ai_queue3,mm_demon] does npc_findhero and then
            // queue(mm_demon_slain, 0, 0) - so the stage moves a tick or two later. Stopping the
            // moment the npc stopped being valid read as a demon killed for no credit.
            H.tick(15);
            hard('kill ' + s.fight, !npc.isValid(), t + ' ticks');
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
            let sent = false;
            let locw = 1;
            let locl = 1;
            try {
                const lt = LocType.get(LocType.getId(s.loc));
                locw = lt.width;
                locl = lt.length;
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
        } else if ('held' in s) {
            what = s.held + ' op' + (s.op ?? 1) + (s.why ? ' - ' + s.why : '');
            let heldok = false;
            try {
                heldok = H.opheld(p, s.held, s.op ?? 1);
            } catch (e) {
                hard(what, false, String(e).replace('Error: ', ''));
                continue;
            }
            if (!heldok) {
                hard(what, false, 'not carrying it, or that op does not exist');
                continue;
            }
            quiet(p);
            lines = run(('picks' in s ? s.picks : undefined) ?? []);
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
                useOn(p, s.at[0], s.at[1], s.useLoc, s.obj);
            } catch (e) {
                hard(what, false, String(e).replace('Error: ', ''));
                continue;
            }
            if (!arrive(p, s.at[0], s.at[1], lw, ll)) {
                hard(what, false, 'player stuck at ' + p.x + ',' + p.z);
                continue;
            }
            lines = run(('picks' in s ? s.picks : undefined) ?? []);
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
            try {
                lines = useOnNpc(p, s.useNpc, s.obj, s.picks ?? []);
            } catch (e) {
                hard(what, false, String(e).replace('Error: ', ''));
                continue;
            }
            const joinedUse = lines.concat(saidSince(), H.mesgs.slice(mesMark).map(x => x.text)).join(' ');
            if (s.want && !joinedUse.includes(s.want)) {
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
