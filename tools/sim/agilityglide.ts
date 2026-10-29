// EVERY CROSSING IS GLIDED FOR AS LONG AS ITS ANIMATION LASTS.
// Usage: npx tsx tools/sim/agilityglide.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. p_exactmove carries a start and an end cycle: the client teleports the player
// to the destination and then draws them travelling from the start tile over that window. The
// animation is a separate thing with a length of its own. When the window runs on past the end of
// the animation the player keeps being carried with nothing on them - sliding across the gap in
// their idle pose - and when the animation is far longer than the window it is cut off mid-air.
//
// AND THE DURATIONS CANNOT BE READ OFF THE .seq. This tool exists because they were. The rooftop
// courses all go through ~agility_roof_move, which glides 0->50 for every obstacle whatever it is,
// and totting up human_spot_jump's eight frame lines gave 8 cycles - so 33 gap jumps looked like
// they slid for 42 cycles in an idle pose, and were nearly all changed on the strength of it.
// SeqType does what the client's SeqType.method214 does: a frame with no delayN of its own takes
// the delay stored on the ANIMATION FRAME, and only falls back to 1 if that is zero too.
// human_spot_jump is 38 cycles, not 8, and 0->50 around a 38-cycle leap is fine.
//
// So the numbers here come from SeqType.duration, and nothing in this file counts frame lines.
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import SeqType from '#/cache/config/SeqType.js';
import fs from 'fs';
import path from 'path';

await H.boot();

const CONTENT = path.resolve('../content');

function seqId(name: string): number {
    const id = SeqType.getId(name);
    return id === undefined || id === null ? -1 : id;
}

function duration(name: string): number {
    const id = seqId(name);
    return id < 0 ? -1 : (SeqType.get(id)?.duration ?? -1);
}

/**
 * DOES IT END? SeqType.loops is a loop POINT - the frame the client returns to on reaching the
 * last one - so a sequence that has one never runs out and can never be outrun by a glide.
 * human_climbing_fall and agilty_shortcut_tunnel_walk are one frame with loops=1, held for as long
 * as they are left on; human_climbing_down carries loops=8, which agility.rs2 is already commented
 * about. Judging those against a window would report a slide that cannot happen.
 */
function loopsForever(name: string): boolean {
    const id = seqId(name);
    if (id < 0) return false;
    const loops = SeqType.get(id)?.loops ?? -1;
    return loops >= 0;
}

// ---------------------------------------------------------------- the durations
console.log('\n== what each animation an obstacle uses actually lasts, in client cycles ==\n');
const USED = [
    'human_spot_jump',
    'human_steppingstonejump',
    'human_jump_stones',
    'human_climbing',
    'agility_climbing_down',
    'human_climbing_down',
    'human_ropeswing_long',
    'human_ropeswing',
    'human_walk_sidestep',
    'human_walk_logbalance',
    'human_reachforladder',
    'human_lowwall',
    'human_walk_crumbledwall',
    'human_walk_style',
    'human_crawling',
    'human_doublepipesqueeze',
    'human_into_sidestep',
    'human_longcrawl',
    'human_longjump',
    'human_pipesqueeze',
    // In the build, used by nothing, and wanted: railing_squeeze is OSRS's own animation for
    // squeezing through a loose railing, at the same id (3844) a RuneLite plugin's list gives it.
    'railing_squeeze',
    'regicide_tightfit'
];
for (const n of USED) {
    const d = duration(n);
    const tail = d < 0 ? '(not in the cache)' : d + ' cycles' + (loopsForever(n) ? ', then loops' : '');
    console.log(`   ${n.padEnd(30)} ${String(seqId(n)).padStart(5)}  ${tail}`);
}

// ---------------------------------------------------------------- every exactmove call site
//
// ARGUMENTS ARE SPLIT ON BALANCED PARENTHESES, not on commas. A coord argument is routinely a call
// of its own - movecoord(coord, -1, 0, 0), or ~agility_facing(coord, $end) - so splitting on commas
// takes the 6th and 7th fields from the middle of somebody else's argument list and reports glide
// windows like "4->0" that appear nowhere in the content. Half the first run's findings were that.
function splitArgs(s: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        if (ch === ',' && depth === 0) {
            out.push(cur.trim());
            cur = '';
        } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

/** Every argument list passed to ~name in this source, as arrays of raw argument text. */
function callsTo(src: string, name: string): string[][] {
    const out: string[][] = [];
    const needle = '~' + name + '(';
    let i = src.indexOf(needle);
    while (i >= 0) {
        let j = i + needle.length;
        let depth = 1;
        let body = '';
        while (j < src.length && depth > 0) {
            const ch = src[j];
            if (ch === '(') depth++;
            else if (ch === ')') {
                depth--;
                if (depth === 0) break;
            }
            body += ch;
            j++;
        }
        out.push(splitArgs(body));
        i = src.indexOf(needle, j);
    }
    return out;
}

// MEASURED, NOT YET JUDGED IN GAME. Keyed anim|animDelay|start|end, the same key the groups below
// use. Each of these is carried a little past the end of its animation; none is a guess the script
// owns up to, none loops, and a squeeze emerging from a pipe is the least likely place for a third
// of a second to show. The 30->158 pair is the one worth watching on a real lap: the gnome course
// crawls three tiles west over 128 cycles with an 80-cycle animation, which is a second of sliding.
// Drop an entry from here the moment it is either fixed or confirmed fine, and the check will say so.
const KNOWN: Record<string, string> = {
    'human_doublepipesqueeze|30|30|126': '16 cycles - a third of a second as the player clears the pipe',
    'human_doublepipesqueeze|30|30|158': '48 cycles - the long gnome-course crawl, worth a look in game',
    'human_crawling|30|30|94': '24 cycles at the end of a shortcut crawl',
    // Falador's hand holds and its five ledges. A sidestep is a WALK animation with no loop point,
    // so played as a one-shot it runs 30 cycles against the roof window's 50 and the last 20 are
    // an idle pose. Fixing it is a choice, not a correction: a 30-cycle window makes six obstacles
    // faster, and crossing with a walk bas the way the tightropes do moves a tile a tick and makes
    // them a great deal slower. Either changes what a lap is worth, so it is the owner's call.
    'human_walk_sidestep|0|0|50': '20 cycles x6 on Falador - the roof window suits the 48-cycle log balance, not a 30-cycle sidestep'
};

type Site = { file: string; anim: string; animDelay: number; start: number; end: number };
const sites: Site[] = [];
const skipped: string[] = [];

function scan(dir: string) {
    for (const fn of fs.readdirSync(dir)) {
        const p = path.join(dir, fn);
        if (fs.statSync(p).isDirectory()) {
            scan(p);
            continue;
        }
        if (!fn.endsWith('.rs2')) continue;
        const src = fs.readFileSync(p, 'utf8');
        const rel = path.relative(CONTENT, p);
        // ~agility_exactmove(anim, anim_delay, move_delay, start, end, start_cycle, end_cycle, dir, merge)
        for (const a of callsTo(src, 'agility_exactmove')) {
            if (a.length < 7) continue;
            const anim = a[0];
            const nums = [a[1], a[5], a[6]].map(x => Number(x));
            if (anim.startsWith('$') || nums.some(n => !Number.isFinite(n))) {
                skipped.push(`${rel}: ${anim} (${a[5]} -> ${a[6]})`);
                continue;
            }
            sites.push({ file: rel, anim, animDelay: nums[0], start: nums[1], end: nums[2] });
        }
    }
}
scan(path.join(CONTENT, 'scripts'));

// ---------------------------------------------------------------- the rooftop chain
//
// ~agility_roof_move(xp, end, anim, dir) hardcodes the window: p_exactmove runs 0->50 for every
// obstacle it is given, whatever that obstacle is. So any proc that takes a `seq` and hands it
// straight to that one is a 0->50 site, and so is every call to such a proc. Without this the
// nine rooftop courses - 73 obstacles, every gap jump in the game - are invisible to this tool.
const ROOF_START = 0;
const ROOF_END = 50;

/** procs that forward a seq parameter into ~agility_roof_move, and which argument it is */
function roofForwarders(): Map<string, number> {
    const out = new Map<string, number>([['agility_roof_move', 2]]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const fn of allScripts()) {
            const src2 = fs.readFileSync(fn, 'utf8');
            for (const m of src2.matchAll(/\[proc,(\w+)\]\(([^)]*)\)([\s\S]*?)(?=\n\[|$)/g)) {
                const name = m[1];
                if (out.has(name)) continue;
                const params = m[2]
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                const body = m[3];
                for (const [callee, argIdx] of out) {
                    for (const args of callsTo(body, callee)) {
                        const passed = args[argIdx];
                        if (!passed || !passed.startsWith('$')) continue;
                        const pos = params.findIndex(p => p.startsWith('seq ') && p.split(/\s+/)[1] === passed);
                        if (pos >= 0) {
                            out.set(name, pos);
                            grew = true;
                        }
                    }
                }
            }
        }
    }
    return out;
}

function allScripts(): string[] {
    const out: string[] = [];
    (function walk(dir: string) {
        for (const fn of fs.readdirSync(dir)) {
            const p = path.join(dir, fn);
            if (fs.statSync(p).isDirectory()) walk(p);
            else if (fn.endsWith('.rs2')) out.push(p);
        }
    })(path.join(CONTENT, 'scripts'));
    return out;
}

const forwarders = roofForwarders();
let roofSites = 0;
for (const fn of allScripts()) {
    const body = fs.readFileSync(fn, 'utf8');
    const rel = path.relative(CONTENT, fn);
    for (const [name, argIdx] of forwarders) {
        for (const args of callsTo(body, name)) {
            const anim = args[argIdx];
            if (!anim || anim.startsWith('$')) continue;
            sites.push({ file: rel, anim, animDelay: 0, start: ROOF_START, end: ROOF_END });
            roofSites++;
        }
    }
}
console.log(
    `
   (${roofSites} obstacle(s) reach p_exactmove through ${forwarders.size} forwarding proc(s)` + ` - ${[...forwarders.keys()].join(', ')} - and glide ${ROOF_START}->${ROOF_END})`
);

console.log(`\n== ${sites.length} exactmove call sites: the glide window against the animation ==\n`);
console.log('   ' + 'animation'.padEnd(28) + 'anim@'.padStart(7) + 'glide'.padStart(11) + 'lasts'.padStart(8) + '   verdict');
console.log('   ' + '-'.repeat(88));

let bad = 0;
const groups = new Map<string, Site[]>();
for (const s of sites) {
    const key = `${s.anim}|${s.animDelay}|${s.start}|${s.end}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
}
for (const [key, group] of [...groups.entries()].sort()) {
    const [anim, animDelay, start, end] = key.split('|');
    const d = duration(anim);
    const animEnds = Number(animDelay) + d;
    const uncovered = Number(end) - animEnds;
    let verdict: string;
    // A LITERAL null IS A CHOICE. One site passes null to carry the player with nothing on
    // them, which is deliberate; only a name that should resolve and does not is a fault.
    if (anim === 'null') verdict = 'no animation on purpose';
    else if (d < 0) {
        verdict = 'NOT IN THE CACHE';
        bad++;
    } else if (loopsForever(anim)) verdict = 'loops - holds the pose, cannot be outrun';
    else if (uncovered > 15) {
        verdict = `carried ${uncovered} cycles past the animation`;
        if (KNOWN[key]) verdict += '  [known: ' + KNOWN[key] + ']';
        else bad++;
    } else verdict = 'ok';
    console.log(`   ${anim.padEnd(28)}${animDelay.padStart(7)}${(start + '->' + end).padStart(11)}` + `${String(d).padStart(8)}   ${verdict}  x${group.length}`);
    if (verdict !== 'ok' && !KNOWN[key]) for (const s of group) console.log(`   ${' '.repeat(54)}${s.file}`);
}

if (skipped.length) {
    console.log(`\n   (${skipped.length} call site(s) pass the animation or a cycle in through a variable and cannot be read statically)`);
}

check('no crossing carries the player far past the end of its animation (outside the known list)', bad === 0, true);

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
