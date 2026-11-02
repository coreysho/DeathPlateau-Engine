// FLETCHING ASKS HOW MANY, AND THE PLAYER MOVES WHILE IT HAPPENS.
// Usage: npx tsx tools/sim/fletching.ts   (exit code is the verdict)
//
// Cutting logs and stringing bows both used multiobjN, which asks WHICH and nothing else - so
// fletching answered "which" and then silently cut or strung the entire inventory, and neither did
// it with an animation. skillmultiN is the panel that asks which AND how many, the same one the
// spinning wheel and the glassblowing pipe already use.
//
// The counting is what this watches. $per_log (how many shafts one log yields, fifteen) and the
// panel's count are different numbers that used to share a name, and a Make 5 that multiplied them
// would quietly hand out seventy-five shafts for five logs.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();

const FLETCH = SeqType.getId('human_fletching');
// A chat interface's ROOT carries no debugname - only the components inside it do - so the modal is
// named by looking its id back up rather than read off the component.
const NAMES = ['skillmulti1', 'skillmulti2', 'skillmulti3', 'skillmulti4', 'skillmulti5', 'multiobj2', 'multiobj3', 'multiobj4'];
const modalName = (p: { modalChat: number }) => NAMES.find(n => Component.getId(n) === p.modalChat) ?? (p.modalChat >= 0 ? `com_${p.modalChat}` : 'none');

/** Start an action, then answer the make-x panel by clicking one of its buttons. */
const run = (p: unknown, start: () => void, button: string, ticks = 40): string => {
    const pl = p as { activeScript: unknown; modalChat: number };
    H.clearLogs();
    start();
    for (let t = 0; t < 8 && pl.modalChat < 0; t++) H.tick(1);
    const opened = modalName(pl);
    if (pl.modalChat >= 0) H.choose(p as never, button);
    for (let t = 0; t < ticks; t++) H.tick(1);
    return opened;
};

console.log('== cutting logs asks which AND how many');
{
    const p: any = player('fletchcut', 3222, 3218, 0);
    p.setLevel(9, 99); // fletching
    H.clearInv(p);
    H.give(p, 'knife', 1);
    H.give(p, 'logs', 20);
    // Normal logs make shafts, a shortbow, a longbow and a crossbow stock: the four-product panel.
    const panel = run(p, () => H.useHeldOn(p, 'knife', 'logs'), 'skillmulti4:com_8'); // obj1 (shafts), Make 5
    check('the panel is skillmulti4, not multiobj4', panel, 'skillmulti4');
    check('  five logs went, not twenty', H.invCount(p, 'logs'), 15);
    // 15 shafts a log: five logs is 75, and NOT 5 (the count misread as the yield) or 300.
    check('  and made 75 arrow shafts', H.invCount(p, 'arrow_shaft'), 75);
    check(
        '  with the knife animation',
        H.anims.some(a => a.who === p.username && a.seq === FLETCH),
        true
    );
}

console.log('\n== Make 1 makes one');
{
    const p: any = player('fletchone', 3222, 3218, 0);
    p.setLevel(9, 99);
    H.clearInv(p);
    H.give(p, 'knife', 1);
    H.give(p, 'logs', 20);
    run(p, () => H.useHeldOn(p, 'knife', 'logs'), 'skillmulti4:com_9'); // obj1, Make 1
    check('one log', H.invCount(p, 'logs'), 19);
    check('  fifteen shafts', H.invCount(p, 'arrow_shaft'), 15);
}

console.log('\n== and Make All still stops when the logs do');
{
    const p: any = player('fletchall', 3222, 3218, 0);
    p.setLevel(9, 99);
    H.clearInv(p);
    H.give(p, 'knife', 1);
    H.give(p, 'logs', 6);
    run(p, () => H.useHeldOn(p, 'knife', 'logs'), 'skillmulti4:com_6', 60); // obj1, Make X -> count dialog
    // Make X opens a count dialog the sim cannot type into, so this only asserts it did not run
    // away: nothing should have been cut without an answer.
    check('nothing is cut until the number is given', H.invCount(p, 'logs'), 6);
}

console.log('\n== stringing a bow asks too, and animates');
{
    const p: any = player('fletchstring', 3222, 3218, 0);
    p.setLevel(9, 99);
    H.clearInv(p);
    H.give(p, 'unstrung_shortbow', 10);
    H.give(p, 'bow_string', 10);
    const panel = run(p, () => H.useHeldOn(p, 'bow_string', 'unstrung_shortbow'), 'skillmulti1:com_5'); // Make 5
    check('the panel is skillmulti1', panel, 'skillmulti1');
    check('  five bows strung, not ten', H.invCount(p, 'shortbow'), 5);
    check('  five strings left', H.invCount(p, 'bow_string'), 5);
    check(
        '  with the knife animation',
        H.anims.some(a => a.who === p.username && a.seq === FLETCH),
        true
    );
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
