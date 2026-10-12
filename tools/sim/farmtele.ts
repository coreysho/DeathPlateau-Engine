// THE FARM TELEPORT, end to end: the 27 arrivals Explorer's ring 4 offers, and whether each one
// actually puts a player next to the patches it claims.
//
//   npx tsx tools/sim/farmtele.ts
//
// WHY THIS IS A SIM AND NOT A GENERATOR. The arrivals in content/scripts/skill_farming/configs/
// farm_teleport.enum were picked by asking the engine's own collision map which tiles a player can
// stand on - a question no config-side Python tool can answer, because blocking comes from the map
// flags AND from every loc standing on the tile. So the same question is asked here on every run:
// the patches are re-read out of the packed maps, the arrivals out of the packed enum, and the two
// are compared. A map import that shifts a farming patch fails this file rather than quietly
// teleporting somebody into a hedge.
//
// WHAT IT CHECKS
//   * all 27 destination ids resolve to a coord, no two sites share one, and nothing past 27 does;
//   * every arrival is a tile a player can stand on, joined to at least 200 others;
//   * every arrival is within ^farm_tele_max_walk of every patch its site claims;
//   * the whole menu, option text included: five groups, every leaf reaching its destinations,
//     "Nowhere." moving nobody;
//   * the two ways in - held op3 and the Worn Equipment option - reach the same menu;
//   * the Wilderness ceiling, and that Entrana still refuses an armed player.
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import EnumType from '#/cache/config/EnumType.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptState from '#/engine/script/ScriptState.js';
import WearOp from '#/network/game/client/model/WearOp.js';
import WearOpHandler from '#/network/game/client/handler/WearOpHandler.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isFlagged, canTravel, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const WORN_COM = Component.getId('wornitems:worn');
const RING_SLOT = 12;
const handler = new WearOpHandler();
const LUMBRIDGE: [number, number] = [3222, 3218];
const MAX_WALK = 4; // ^farm_tele_max_walk
const WILDY_MAX = 30; // ^farm_tele_wildy_max
const MIN_REACH = 200;

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}

/** Answer a p_choice menu with its option `pick` (1-based). The resume buttons are NOT handed back
 * in option order, so the component is looked up by name off the open chat interface. */
function pickMenu(p: Player, pick: number): boolean {
    for (let t = 0; t < 6; t++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            const iface = names.find((n: string) => n.startsWith(open + ':'))?.split(':')[0];
            return iface ? H.choose(p, `${iface}:com_${pick}`) : false;
        }
        H.tick(1);
    }
    return false;
}

/** Tick until the player is idle again: a teleport is p_delay(2) and then the jump, so a walk that
 * is read too early reads the PREVIOUS destination. */
function settle(q: Player, n = 15) {
    for (let t = 0; t < n; t++) {
        if (!q.delayed && !q.activeScript) return;
        H.tick(1);
    }
}

/** The option text the server last wrote into the open chat menu, option 1 first. */
function menuText(p: Player, from: number): string[] {
    const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
    const iface = open.split(':')[0];
    const out: string[] = [];
    for (const e of H.ifaces.slice(from)) {
        if (e.kind !== 'text' || e.who !== p.username) continue;
        const name = Component.get(e.com)?.comName ?? '';
        const m = new RegExp(`^${iface}:com_(\\d+)$`).exec(name);
        if (m) out[parseInt(m[1]) - 1] = e.text ?? '';
    }
    return out.filter(t => t !== undefined);
}

/** What a client sends for worn option `op` on the ring; true if the server took it. */
const wearop = (p: Player, op: number) => handler.handle(new WearOp(op, ObjType.getId('explorers_ring_4'), RING_SLOT, WORN_COM), p);

// ---------------------------------------------------------------- what the content says it does
// The sim's own copy of the promise: id, the site's name, and the patch indices that arrival is
// meant to serve. The COORDS are deliberately not here - they come out of the packed enum.
const SITES: [number, string, number[]][] = [
    [1, 'Falador allotment', [0, 1, 12, 16]],
    [2, 'Catherby allotment', [2, 3, 13, 17]],
    [3, 'Ardougne allotment', [4, 5, 14, 18]],
    [4, 'Port Phasmatys allotment', [6, 7, 15, 19]],
    [5, 'Lumbridge hops', [10]],
    [6, 'Yanille hops', [8]],
    [7, 'Entrana hops', [9]],
    [8, "Seers' Village hops", [11]],
    [9, 'Lumbridge tree', [27]],
    [10, 'Falador tree', [25]],
    [11, 'Taverley tree', [24]],
    [12, 'Varrock tree', [26]],
    [13, 'Tree Gnome Village fruit tree', [29]],
    [14, 'Tree Gnome Stronghold fruit tree', [28]],
    [15, 'Brimhaven fruit tree', [30]],
    [16, 'Catherby fruit tree', [31]],
    [17, 'Rimmington bush', [21]],
    [18, 'Ardougne bush', [23]],
    [19, 'Varrock bush', [20]],
    [20, 'Etceteria bush', [22]],
    [21, 'Port Sarim spirit tree', [32]],
    [22, 'Brimhaven spirit tree', [34]],
    [23, 'Etceteria spirit tree', [33]],
    [24, 'Al Kharid cactus', [36]],
    [25, 'Tai Bwo Wannai calquat', [35]],
    [26, 'Mort Myre mushroom', [37]],
    [27, 'Draynor Manor belladonna', [38]]
];

// ---------------------------------------------------------------- where the patches really are
// Straight out of the packed maps, by way of the loc ids carrying param=farming_patch,<index>.
function patchTiles(): Map<number, [number, number][]> {
    const src = Environment.BUILD_SRC_DIR;
    const indexByName = new Map<string, number>();
    let cur = '';
    for (const line of fs.readFileSync(`${src}/scripts/skill_farming/configs/farming.loc`, 'ascii').split(/\r?\n/)) {
        const t = line.trim();
        if (t.startsWith('[')) cur = t.slice(1, -1);
        else if (t.startsWith('param=farming_patch,')) indexByName.set(cur, parseInt(t.slice('param=farming_patch,'.length)));
    }
    const indexById = new Map<number, number>();
    for (const line of fs.readFileSync(`${src}/pack/loc.pack`, 'ascii').split(/\r?\n/)) {
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        const idx = indexByName.get(line.slice(eq + 1));
        if (idx !== undefined) indexById.set(parseInt(line.slice(0, eq)), idx);
    }
    const out = new Map<number, [number, number][]>();
    for (const f of fs.readdirSync(`${src}/maps`)) {
        const m = /^m(\d+)_(\d+)\.jm2$/.exec(f);
        if (!m) continue;
        const mx = +m[1];
        const mz = +m[2];
        let section = '';
        for (const line of fs.readFileSync(`${src}/maps/${f}`, 'ascii').split(/\r?\n/)) {
            const t = line.trim();
            if (t.startsWith('====')) {
                section = t.replace(/=/g, '').trim();
                continue;
            }
            if (section !== 'LOC') continue;
            const l = /^(\d+) (\d+) (\d+): (\d+) (\d+)(?: (\d+))?$/.exec(t);
            if (!l) continue;
            const idx = indexById.get(+l[4]);
            if (idx === undefined || +l[1] !== 0) continue;
            if (!out.has(idx)) out.set(idx, []);
            out.get(idx)!.push([mx * 64 + +l[2], mz * 64 + +l[3]]);
        }
    }
    return out;
}

function reach(level: number, x: number, z: number, cap = MIN_REACH): number {
    if (!isZoneAllocated(level, x, z) || isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED)) return 0;
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen.size;
}

const cheb = (ax: number, az: number, bx: number, bz: number) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));
const centre = (tiles: [number, number][]): [number, number] => [Math.round(tiles.reduce((s, t) => s + t[0], 0) / tiles.length), Math.round(tiles.reduce((s, t) => s + t[1], 0) / tiles.length)];

// ============================================================ 1. the table
console.log('== the destination table');
const coords = EnumType.getByName('farm_teleport_coords');
check('enum farm_teleport_coords exists', coords !== undefined, true);
const dest = new Map<number, CoordGrid>();
const unresolved: string[] = [];
for (const [id, name] of SITES) {
    const packed = (coords?.values.get(id) as number) ?? -1;
    if (packed <= 0) unresolved.push(`${name} (id ${id})`);
    else dest.set(id, CoordGrid.unpackCoord(packed));
}
check('every site resolves to a coord', unresolved, []);
check('no two sites share an arrival tile', new Set([...dest.values()].map(c => `${c.level},${c.x},${c.z}`)).size, dest.size);
check(`nothing answers for id ${SITES.length + 1}`, coords?.values.has(SITES.length + 1) ?? true, false);

// ============================================================ 2. the arrivals are real tiles
console.log('== every arrival is standable, reachable, and close to its patches');
const tiles = patchTiles();
const unplaced: string[] = [];
const island: string[] = [];
const tooFar: string[] = [];
const walks: string[] = [];
for (const [id, name, members] of SITES) {
    const c = dest.get(id);
    if (!c) continue;
    const r = reach(c.level, c.x, c.z);
    if (r < MIN_REACH) island.push(`${name}: (${c.x},${c.z}) reaches only ${r}`);
    const ds: number[] = [];
    for (const patch of members) {
        const t = tiles.get(patch);
        if (!t || !t.length) {
            unplaced.push(`${name}: patch ${patch}`);
            continue;
        }
        const [px, pz] = centre(t);
        ds.push(cheb(c.x, c.z, px, pz));
    }
    const worst = ds.length ? Math.max(...ds) : 99;
    if (worst > MAX_WALK) tooFar.push(`${name}: ${worst} tiles`);
    walks.push(`${name} (${c.x},${c.z}) worst ${worst}`);
}
check('every patch a site claims is placed on a map', unplaced, []);
check('no arrival is on an island', island, []);
check(`no arrival is more than ${MAX_WALK} tiles from a patch it serves`, tooFar, []);
for (const w of walks) console.log(`       ${w}`);

// ============================================================ 3. the item advertises it
console.log('== the ring');
const ring = ObjType.get(ObjType.getId('explorers_ring_4'));
check('iop3', ring.iop[2], 'Farm Teleport');
check('wearop1', ring.wearop[0], 'Farm Teleport');
check(
    'the lower tiers are untouched',
    ['explorers_ring_1', 'explorers_ring_2', 'explorers_ring_3'].map(n => ObjType.get(ObjType.getId(n)).wearop.filter(w => w)),
    [[], [], []]
);

// ============================================================ 4. the menu, click by click
console.log('== the menu');
type Walk = { label: string; picks: number[]; expect: number | null };
const WALKS: Walk[] = [
    { label: 'allotments / Falador', picks: [1, 1], expect: 1 },
    { label: 'allotments / Catherby', picks: [1, 2], expect: 2 },
    { label: 'allotments / Ardougne', picks: [1, 3], expect: 3 },
    { label: 'allotments / Port Phasmatys', picks: [1, 4], expect: 4 },
    { label: 'allotments / Nowhere', picks: [1, 5], expect: null },
    { label: 'hops / Lumbridge', picks: [2, 1], expect: 5 },
    { label: 'hops / Yanille', picks: [2, 2], expect: 6 },
    { label: "hops / Seers'", picks: [2, 4], expect: 8 },
    { label: 'hops / Nowhere', picks: [2, 5], expect: null },
    { label: 'trees / Lumbridge', picks: [3, 1], expect: 9 },
    { label: 'trees / Falador', picks: [3, 2], expect: 10 },
    { label: 'trees / Taverley', picks: [3, 3], expect: 11 },
    { label: 'trees / Varrock', picks: [3, 4], expect: 12 },
    { label: 'trees / Nowhere', picks: [3, 5], expect: null },
    { label: 'fruit / Tree Gnome Village', picks: [4, 1], expect: 13 },
    { label: 'fruit / Tree Gnome Stronghold', picks: [4, 2], expect: 14 },
    { label: 'fruit / Brimhaven', picks: [4, 3], expect: 15 },
    { label: 'fruit / Catherby', picks: [4, 4], expect: 16 },
    { label: 'fruit / Nowhere', picks: [4, 5], expect: null },
    { label: 'more / bushes / Rimmington', picks: [5, 1, 1], expect: 17 },
    { label: 'more / bushes / Ardougne', picks: [5, 1, 2], expect: 18 },
    { label: 'more / bushes / Varrock', picks: [5, 1, 3], expect: 19 },
    { label: 'more / bushes / Etceteria', picks: [5, 1, 4], expect: 20 },
    { label: 'more / bushes / Nowhere', picks: [5, 1, 5], expect: null },
    { label: 'more / spirit / Port Sarim', picks: [5, 2, 1], expect: 21 },
    { label: 'more / spirit / Brimhaven', picks: [5, 2, 2], expect: 22 },
    { label: 'more / spirit / Etceteria', picks: [5, 2, 3], expect: 23 },
    { label: 'more / spirit / Nowhere', picks: [5, 2, 4], expect: null },
    { label: 'more / odds / cactus', picks: [5, 3, 1], expect: 24 },
    { label: 'more / odds / calquat', picks: [5, 3, 2], expect: 25 },
    { label: 'more / odds / mushroom', picks: [5, 3, 3], expect: 26 },
    { label: 'more / odds / Nowhere', picks: [5, 3, 4], expect: null },
    { label: 'more / belladonna', picks: [5, 4], expect: 27 },
    { label: 'more / Nowhere', picks: [5, 5], expect: null }
];

const p = player('farmer');
function route(w: Walk, worn: boolean): string {
    settle(p);
    p.teleport(LUMBRIDGE[0], LUMBRIDGE[1], 0);
    H.clearLogs();
    if (worn) {
        H.equip(p, { ring: 'explorers_ring_4' });
        if (!wearop(p, 1)) return 'the worn option was refused';
    } else {
        H.clearInv(p);
        H.give(p, 'explorers_ring_4', 1);
        if (!H.opheld(p, 'explorers_ring_4', 3)) return 'op3 was refused';
    }
    for (const pick of w.picks) {
        if (!pickMenu(p, pick)) return `option ${pick} was not on the menu`;
    }
    settle(p);
    if (w.expect === null) return p.x === LUMBRIDGE[0] && p.z === LUMBRIDGE[1] ? 'stayed put' : `moved to (${p.x},${p.z})`;
    const want = dest.get(w.expect)!;
    return p.level === want.level && p.x === want.x && p.z === want.z ? 'arrived' : `(${p.x},${p.z}) not (${want.x},${want.z})`;
}
for (const w of WALKS) check(w.label, route(w, false), w.expect === null ? 'stayed put' : 'arrived');
// The worn route only needs to be shown to reach the SAME menu, not re-walked 34 times.
check('worn: allotments / Falador', route(WALKS[0], true), 'arrived');
check('worn: more / belladonna', route(WALKS[32], true), 'arrived');

console.log('== the option text');
{
    settle(p);
    p.teleport(LUMBRIDGE[0], LUMBRIDGE[1], 0);
    H.clearInv(p);
    H.give(p, 'explorers_ring_4', 1);
    H.clearLogs();
    H.opheld(p, 'explorers_ring_4', 3);
    H.tick(1);
    check('top menu', menuText(p, 0), ['Allotments, flowers and herbs.', 'Hops patches.', 'Tree patches.', 'Fruit tree patches.', 'More...']);
    let from = H.ifaces.length;
    pickMenu(p, 1);
    H.tick(1);
    check('allotments', menuText(p, from), ['Falador.', 'Catherby.', 'Ardougne.', 'Port Phasmatys.', 'Nowhere.']);
    pickMenu(p, 5);
    settle(p);

    H.clearLogs();
    H.opheld(p, 'explorers_ring_4', 3);
    H.tick(1);
    from = H.ifaces.length;
    pickMenu(p, 5);
    H.tick(1);
    check('more', menuText(p, from), ['Bush patches.', 'Spirit trees.', 'Cactus, calquat and mushroom.', 'Belladonna patch.', 'Nowhere.']);
    from = H.ifaces.length;
    pickMenu(p, 2);
    H.tick(1);
    check('spirit trees', menuText(p, from), ['Port Sarim.', 'Brimhaven.', 'Etceteria.', 'Nowhere.']);
    pickMenu(p, 4);
    settle(p);
}

// ============================================================ 5. the two gates
console.log('== Entrana');
{
    const q = player('monk');
    H.give(q, 'explorers_ring_4', 1);
    H.give(q, 'rune_platebody', 1);
    const at = () => `${q.x},${q.z}`;
    const home = at();
    H.clearLogs();
    H.opheld(q, 'explorers_ring_4', 3);
    pickMenu(q, 2);
    pickMenu(q, 3);
    settle(q);
    check('armed player is refused', at(), home);
    check(
        'and told why',
        H.mesgs.filter(m => m.who === q.username).some(m => m.text.includes('Saradomin')),
        true
    );
    // ...and the rule is Entrana's alone: the same platebody does not stop Yanille.
    H.clearLogs();
    H.opheld(q, 'explorers_ring_4', 3);
    pickMenu(q, 2);
    pickMenu(q, 2);
    settle(q);
    const y = dest.get(6)!;
    check('Yanille still works with the platebody', at(), `${y.x},${y.z}`);
    // Unarmed, Entrana lets him in.
    q.invDel(InvType.INV, ObjType.getId('rune_platebody'), 1);
    H.clearLogs();
    H.opheld(q, 'explorers_ring_4', 3);
    pickMenu(q, 2);
    pickMenu(q, 3);
    settle(q);
    const e = dest.get(7)!;
    check('unarmed player gets in', at(), `${e.x},${e.z}`);
}

console.log('== the Wilderness ceiling');
{
    // wilderness_zones.dbrow: the main rectangle starts at z 3520 and every 8 tiles is a level, so
    // level = (z - 3520)/8 + 1. These two z values are levels 31 and 10.
    const q = player('pker');
    H.give(q, 'explorers_ring_4', 1);
    const DEEP: [number, number] = [3100, 3764];
    const SHALLOW: [number, number] = [3100, 3596];
    q.teleport(DEEP[0], DEEP[1], 0);
    H.clearLogs();
    H.opheld(q, 'explorers_ring_4', 3);
    pickMenu(q, 3);
    pickMenu(q, 2);
    settle(q);
    check(`blocked above level ${WILDY_MAX}`, `${q.x},${q.z}`, `${DEEP[0]},${DEEP[1]}`);
    check(
        'and told why',
        H.mesgs.filter(m => m.who === q.username).some(m => m.text.includes('mysterious force')),
        true
    );
    q.teleport(SHALLOW[0], SHALLOW[1], 0);
    H.clearLogs();
    H.opheld(q, 'explorers_ring_4', 3);
    pickMenu(q, 3);
    pickMenu(q, 2);
    settle(q);
    const f = dest.get(10)!;
    check(`works below level ${WILDY_MAX}`, `${q.x},${q.z}`, `${f.x},${f.z}`);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
