// NO SCROLLBAR HANGS OFF THE WINDOW IT BELONGS TO.
//
// Client.drawInterface draws a layer's scrollbar OUTSIDE the layer, at x + width, sixteen pixels
// wide. So a layer sized to fill its panel puts the bar on the panel's border rather than inside
// it, and the collection log's item grid did exactly that: x=194 width=292 put the bar at 486..501
// with pagebox ending at 489, which is what it looked like in game.
//
// A component carries no position of its own in the built cache - the parent holds childX/childY -
// so this reads the .if sources, which are what a person edits anyway. Per window: how far right
// does anything in it reach, and does every scrolling layer's bar stay inside that.
//
//   npx tsx tools/sim/scrollbars.ts
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { check, R } from './a1lib.ts';

const SCROLLBAR_W = 16;

function ifFiles(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) ifFiles(p, out);
        else if (e.endsWith('.if')) out.push(p);
    }
    return out;
}

type Com = { name: string; file: string; layer?: string; type?: string; x: number; y: number; w: number; h: number; scroll: number; hasScroll: boolean };

const windows = new Map<string, Com[]>();
for (const file of ifFiles('../content/scripts')) {
    const coms: Com[] = [];
    let cur: Com | null = null;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const head = /^\[(\w+)\]/.exec(line);
        if (head) { cur = { name: head[1], file, x: 0, y: 0, w: 0, h: 0, scroll: 0, hasScroll: false }; coms.push(cur); continue; }
        if (!cur) continue;
        const kv = /^(\w+)=(.*)$/.exec(line);
        if (!kv) continue;
        const [, k, v] = kv;
        if (k === 'x') cur.x = Number(v);
        else if (k === 'y') cur.y = Number(v);
        else if (k === 'width') cur.w = Number(v);
        else if (k === 'height') cur.h = Number(v);
        else if (k === 'scroll') { cur.scroll = Number(v); cur.hasScroll = true; }
        else if (k === 'layer') cur.layer = v;
        else if (k === 'type') cur.type = v;
    }
    windows.set(file, coms);
}

const over: string[] = [];
let scrollers = 0;
for (const [file, coms] of windows) {
    // only components placed on the window itself have window coordinates; a child of a layer is
    // positioned inside its parent and its bar is bounded by that parent, not by the window.
    const top = coms.filter(c => !c.layer);
    // How wide the window really is. Usually the widest thing in it, but a SIDEBAR TAB is a fixed
    // 190x261 panel whatever it chooses to draw (Client.java:12461), and several of 377's own tabs
    // stop short of their own edge - music.if's list ends at 171 and its bar at 187, which is inside
    // the tab and only looks over the line if you measure the tab by its contents.
    const drawn = Math.max(0, ...top.map(c => c.x + c.w));
    const right = drawn <= 190 ? 190 : drawn;
    for (const c of top) {
        // EVERY LAYER THAT DECLARES A SCROLL, not only the ones long enough to draw a bar today.
        // The collection log's entry list had scroll=0 and thirteen rows in a box that holds
        // fifteen, so it drew nothing and looked right - and a sixteenth entry would have put its
        // bar out in the gutter between the panels. A layer that cannot fit its own scrollbar is
        // wrong whether or not it is full yet, and waiting for it to fill is waiting for a player
        // to find it. equipment_stats.if's bonuses panel was the other one.
        if (c.type !== 'layer' || !c.hasScroll) continue;
        scrollers++;
        if (c.x + c.w + SCROLLBAR_W > right) {
            over.push(`${file.split(/[\/]/).pop()} ${c.name}: bar ends at ${c.x + c.w + SCROLLBAR_W}, the window at ${right}`);
        }
    }
}
console.log(`${windows.size} interfaces, ${scrollers} layers that scroll or could`);
for (const o of over) console.log('  ' + o);
check('  every one of them has room for its bar inside the window', over.length, 0);

// and the one this was written for, by the numbers
console.log('\nTHE COLLECTION LOG GRID');
const log = windows.get([...windows.keys()].find(f => f.endsWith('collection_log.if'))!)!;
const grid = log.find(c => c.name === 'grid')!;
const pagebox = log.find(c => c.name === 'pagebox')!;
check('  its scrollbar ends exactly where pagebox does', grid.x + grid.w + SCROLLBAR_W, pagebox.x + pagebox.w);
check('  and the layer still holds eight whole item cells', grid.w, 7 * (4 + 32) + 32);

// The entry list on the left, which has the same arrangement and had the same latent fault: its
// panel grew into the gutter rather than the list losing width, so the rows read as they did.
const list = log.find(c => c.name === 'list')!;
const listbox = log.find(c => c.name === 'listbox')!;
check('  the entry list has room for a bar inside listbox', list.x + list.w + SCROLLBAR_W <= listbox.x + listbox.w, true);
check('  and the rows kept their full width', list.w, 150);
check('  with listbox still clear of pagebox', listbox.x + listbox.w <= pagebox.x, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
