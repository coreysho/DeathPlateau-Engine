// THE QUEST-COMPLETE SCROLL SAYS ITS QUEST POINTS ONCE.
//
//   npx tsx tools/sim/questscroll.ts
//
// The default scroll (~send_quest_complete) writes "N Quest Point(s)" on its own line from the number
// it is given. 43 quests also wrote "N Quest Points" at the front of their reward text, so the scroll
// showed it twice - Holy Grail's was reported. The proc now drops a leading quest-points line from the
// reward text, so a quest written either way shows it once.
//
// WHY THE REAL COMPLETION QUEUES. The thing that matters is the text a player's client is sent, so
// this fires each quest's own `[queue,..._complete]` on a fresh player and reads the interface text
// the server writes, rather than calling the proc with a string it would be easy to get the shape of
// wrong. The first eight are quests that wrote the line by hand (the ones that showed it twice); the
// last two are quests that left it to the scroll, so the fix cannot have swallowed THEIR line.
//
// AND THE REWARDS ARE COMPARED AGAINST WHAT THE QUEST DECLARES, not against a list written out
// here. The proc does string surgery on the reward text, and a cut that takes one character too
// many takes it from a reward: an earlier version of the fix dropped any first line CONTAINING
// the words "Quest Point", which turned "2 Quest Points and a hat" into nothing and PASSED a
// check that only counted points lines. So the expectation is read out of the quest's own
// ~send_quest_complete call - the points line dropped only when it is exactly the one com_9
// prints - and a scroll that loses a line fails here whatever the reward text says.
import * as H from './harness.js';
import { enqueue } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';
import path from 'path';

await H.boot();

const AFTER_HAND_WRITTEN = ['grail_quest_complete', 'fenk_quest_complete', 'lost_tribe_quest_complete', 'devious_quest_complete', 'zogre_quest_complete', 'elid_quest_complete', 'eadgar_quest_complete', 'icslittle_quest_complete'];
const LEFT_TO_THE_SCROLL = ['regicide_quest_complete', 'dragon_complete'];

// The scroll's lines: com_9 is the quest-points line, com_10 to com_14 the reward text.
const LINES = [9, 10, 11, 12, 13, 14].map(n => Component.getId('inter_238:com_' + n));

// ---- what each quest says its rewards are, out of the content it is about to be run from ----

/** Every script label in the content paired with the reward text of the ~send_quest_complete it
 *  makes, so a quest's declared rewards can be looked up by the name this sim enqueues. */
function declaredRewards(): Map<string, { points: string; rest: string[] }> {
    const out = new Map<string, { points: string; rest: string[] }>();
    const constants = new Map<string, number>();
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.rs2') || e.name.endsWith('.constant')) files.push(full);
        }
    };
    walk(path.join(Environment.BUILD_SRC_DIR, 'scripts'));
    for (const file of files.filter(f => f.endsWith('.constant'))) {
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            const m = /^\^?([A-Za-z0-9_]+)\s*=\s*(-?\d+)\s*$/.exec(line.trim());
            if (m && !constants.has(m[1])) constants.set(m[1], Number(m[2]));
        }
    }
    for (const file of files.filter(f => f.endsWith('.rs2'))) {
        let label = '';
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            const head = /^\[[a-z_]+,([^\]]+)\]/.exec(line);
            if (head) label = head[1];
            const at = line.indexOf('~send_quest_complete(');
            if (at === -1 || line.trimStart().startsWith('//')) continue;
            const call = line.slice(at);
            const strings = [...call.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
            // the 4th argument, with strings blanked so a comma inside one does not count
            const args = call
                .slice(call.indexOf('(') + 1)
                .replace(/"(?:[^"\\]|\\.)*"/g, '""')
                .split(',');
            const points = constants.get((args[3] ?? '').trim().replace(/^\^/, '')) ?? -1;
            if (strings.length < 2 || points < 0) continue;
            // ~pluralise in the content's string_procs.rs2, which is what com_9 is printed through
            const printed = points === 1 ? '1 Quest Point' : `${points} Quest Points`;
            const declared = strings[strings.length - 1].split('|');
            // dropped here exactly as the proc drops it: only when it IS the printed line
            const rest = declared[0] === printed ? declared.slice(1) : declared;
            out.set(label, { points: printed, rest });
        }
    }
    return out;
}

const declared = declaredRewards();
if (declared.size < 100) {
    // a lookup that found nothing would make every comparison below vacuously true
    console.log(`  FAIL only ${declared.size} completion calls read out of ${Environment.BUILD_SRC_DIR} - expected 111 or so`);
    process.exit(1);
}

let failed = 0;
const check = (name: string, ok: boolean, detail: string) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`);
    if (!ok) failed++;
};

let n = 0;
for (const quest of [...AFTER_HAND_WRITTEN, ...LEFT_TO_THE_SCROLL]) {
    const p: any = H.makePlayer('scroll' + n++, 3200, 3200);
    H.tick(2);
    p.applyDamage = function () {};
    H.tick(1);
    const mark = H.ifaces.length;
    enqueue(p, `[queue,${quest}]`);
    H.tick(6);
    const lines = H.ifaces
        .slice(mark)
        .filter(i => i.who === p.username && i.kind === 'text' && LINES.includes(i.com) && i.text)
        .map(i => i.text as string);
    const name = quest.replace(/_(quest_)?complete$/, '');
    const points = lines.filter(t => /Quest Points?/i.test(t));
    check(`${name}: the scroll shows its quest points once`, points.length === 1, `${points.length} lines: ${JSON.stringify(lines)}`);

    // AND EVERY OTHER LINE THE QUEST DECLARES IS STILL THERE. split_init wraps a long line, so the
    // scroll's lines are joined back up before comparing - what matters is that no reward was cut,
    // not where the wrapping fell.
    const want = declared.get(quest);
    if (!want) {
        check(`${name}: its reward text was found in the content`, false, `no ~send_quest_complete under [.,${quest}]`);
    } else {
        const shown = lines
            .filter(t => t !== want.points)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        const expected = want.rest.join(' ').replace(/\s+/g, ' ').trim();
        check(`${name}: and every reward it declares, with nothing cut`, shown === expected, `\n       scroll:   ${JSON.stringify(shown)}\n       declared: ${JSON.stringify(expected)}`);
    }
}

console.log(failed ? `\n${failed} scrolls wrong` : '\nALL PASS');
process.exit(failed ? 1 : 0);
