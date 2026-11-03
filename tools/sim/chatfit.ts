// WHAT FITS IN THE CHATBOX, which is smaller than the file it is drawn from.
// Usage: npx tsx tools/sim/chatfit.ts   (exit code is the verdict)
//
// A chat interface is drawn at CHAT_Y + (CHAT_H - 96) / 2 and is 479 by 96 (Client.java's CHAT_IF_X
// and CHAT_IF_Y). Nothing enforces that, and the .if files are authored free-hand, so a component
// can sit below the fold and simply never be seen - no error, no warning, just a thing the player
// does not get.
//
// WHY IT WAS WORTH WRITING. The sandwich lady's tray was reported as "no interface, everything goes
// in the chatbox and is jumbled". It was drawing the whole time: her seven labels sit at local y 76
// and the web client was cropping the client's bottom 80 rows, which starts at local y 62 of the
// chat interface - so the labels were gone and the item models were sliced in half. That was the
// web page's bug and is fixed, but it only showed up on ONE client, and the thing that made it
// invisible rather than obviously broken was that the labels are at the very bottom of the panel.
//
// So this measures the margin rather than waiting for the next client to eat it.
import fs from 'fs';
import path from 'path';
import { check, R } from './a1lib.js';

const CHAT_W = 479;
const CHAT_H = 96;
const ROOT = '../content/scripts';

/** Every interface opened with if_openchat, by name. */
const chatInterfaces = (): Set<string> => {
    const out = new Set<string>();
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.rs2')) {
                for (const m of fs.readFileSync(p, 'utf8').matchAll(/if_openchat\(([a-z0-9_]+)\)/g)) out.add(m[1]);
            }
        }
    };
    walk(ROOT);
    return out;
};

/** Every component in an .if, as (name, x, y, width, height). */
const components = (file: string) => {
    const out: { name: string; x: number; y: number; w: number; h: number }[] = [];
    let cur: { name: string; x: number; y: number; w: number; h: number } | null = null;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
        const line = raw.trim();
        const head = /^\[([a-z0-9_]+)\]$/.exec(line);
        if (head) {
            if (cur) out.push(cur);
            cur = { name: head[1], x: 0, y: 0, w: 0, h: 0 };
            continue;
        }
        if (!cur) continue;
        const kv = /^(x|y|width|height)=(-?\d+)$/.exec(line);
        if (kv) {
            const v = parseInt(kv[2]);
            if (kv[1] === 'x') cur.x = v;
            else if (kv[1] === 'y') cur.y = v;
            else if (kv[1] === 'width') cur.w = v;
            else cur.h = v;
        }
    }
    if (cur) out.push(cur);
    return out;
};

const files = new Map<string, string>();
(function index(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) index(p);
        else if (e.name.endsWith('.if')) files.set(e.name.replace(/\.if$/, ''), p);
    }
})(ROOT);

const wanted = [...chatInterfaces()].filter(n => files.has(n)).sort();
console.log(`== ${wanted.length} interfaces are opened in the chatbox`);

// WHAT ACTUALLY DECIDES WHETHER A COMPONENT IS SEEN is its y, not its y + height. Text draws from
// the top of its box and the client clips the rest, so a box hanging over the bottom edge loses the
// unused part of a BUTTON's click area and nothing a player can see. 147 components across these 24
// interfaces do that - cookx, the churn panels, multi2 - and they have all worked for years. So the
// overhang is counted, not failed.
//
// A component whose TOP is past 96 is the real fault: it is drawn nowhere, silently.
let overhang = 0;
const below: string[] = [];
const lastRows: string[] = [];
for (const name of wanted) {
    for (const c of components(files.get(name)!)) {
        if (c.y >= CHAT_H) {
            below.push(`${name}:${c.name} starts at y=${c.y}`);
        } else if (c.y + c.h > CHAT_H || c.x + c.w > CHAT_W) {
            overhang++;
        }
        if (c.y >= CHAT_H - 24 && c.y < CHAT_H) {
            lastRows.push(`${name}:${c.name} draws from y=${c.y}`);
        }
    }
}

console.log(`${overhang} components hang over the edge and are clipped, which is normal`);
console.log(`\n${lastRows.length} draw in the bottom 24 rows - the first things a cropping client eats:`);
lastRows.forEach(l => console.log('   ' + l));

console.log('');
// THE ONE THAT IS STILL WRONG, by name so it cannot be forgotten and cannot grow. The Castle Wars
// scoreboard carries a second pair of model icons at y=103/104, below the fold and drawn nowhere.
// They are NOT duplicates of the pair at y=70 - those are com_i339 and these are com_i340 - so
// this is a second row of icons from whatever taller layout inter_217 was adapted from, and where
// they should go needs somebody to look at the two models rather than guess. The panel is already
// cramped: the visible icons at y=70 run to 102 and overlap the Close at y=81.
const KNOWN = ['inter_217:com_8 starts at y=103', 'inter_217:com_9 starts at y=104'];
check(
    'nothing new is drawn below the fold',
    below.filter(b => KNOWN.indexOf(b) < 0),
    []
);
check('  and the two that are have not been fixed quietly', below.filter(b => KNOWN.indexOf(b) >= 0).sort(), KNOWN);
// The sandwich lady's tray is the one this was written for: its labels are the lowest thing any
// chat interface draws, which is why hers was the interface that looked absent.
const tray = components(files.get('multiobj7')!).filter(c => c.y + c.h > CHAT_H);
check(
    'the tray still fits by the rule that matters',
    tray.every(c => c.y < CHAT_H),
    true
);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
