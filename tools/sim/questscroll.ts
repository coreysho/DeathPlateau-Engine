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
import * as H from './harness.js';
import { enqueue } from './a1lib.js';
import Component from '#/cache/config/Component.js';

await H.boot();

const AFTER_HAND_WRITTEN = ['grail_quest_complete', 'fenk_quest_complete', 'lost_tribe_quest_complete', 'devious_quest_complete', 'zogre_quest_complete', 'elid_quest_complete', 'eadgar_quest_complete', 'icslittle_quest_complete'];
const LEFT_TO_THE_SCROLL = ['regicide_quest_complete', 'dragon_complete'];

// The scroll's lines: com_9 is the quest-points line, com_10 to com_14 the reward text.
const LINES = [9, 10, 11, 12, 13, 14].map(n => Component.getId('inter_238:com_' + n));

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
    const points = lines.filter(t => /Quest Points?/i.test(t));
    check(`${quest.replace(/_(quest_)?complete$/, '')}: the scroll shows its quest points once`, points.length === 1, `${points.length} lines: ${JSON.stringify(lines)}`);
}

console.log(failed ? `\n${failed} scrolls wrong` : '\nALL PASS');
process.exit(failed ? 1 : 0);
