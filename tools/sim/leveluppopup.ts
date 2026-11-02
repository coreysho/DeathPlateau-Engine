// THE LEVEL-UP POPUP SWITCH, and what turning it off actually stops.
// Usage: npx tsx tools/sim/leveluppopup.ts   (exit code is the verdict)
//
// The complaint was fishing: you level, a modal opens, p_pausebutton makes you busy, and closing it
// clears your weak queues - so a level costs a click and a fresh cast. With the switch off the
// message, the fireworks and the jingle all still happen and the modal does not, which is the whole
// of it. Both halves are asserted, because a switch that also swallowed the message would be a
// worse bug than the one it fixes.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const FIREWORKS = SpotanimType.getId('levelup_anim');

// The fireworks cannot be read off the player after the fact: spotanim_pl sets an update MASK, and
// resetMasks clears it at the end of the very tick it is sent in. So the call itself is recorded,
// the way the harness records hits and animations.
const firedAt: string[] = [];
const realSpotanim = Player.prototype.spotanim;
Player.prototype.spotanim = function (id: number, height: number, delay: number) {
    if (id === FIREWORKS) {
        firedAt.push(this.username);
    }
    return realSpotanim.call(this, id, height, delay);
};
const FISHING = 10; // PlayerStat.FISHING
const vb = (p: unknown, name: string) => H.getVar(p as never, name);

/** a1lib's player() maxes every stat, and a 99 cannot level - so fishing is put back to 1 first. */
const fresh = (name: string): any => {
    const p: any = player(name, 3222, 3218, 0);
    p.stats[FISHING] = 0;
    p.levels[FISHING] = 1;
    p.baseLevels[FISHING] = 1; // the one addXp compares against - resetting levels alone is not enough
    return p;
};

/** Give enough experience to cross a level, and run the advancestat trigger out.
 *
 */
const levelOnce = (p: any) => {
    H.clearLogs();
    firedAt.length = 0;
    p.addXp(FISHING, 5000);
    for (let t = 0; t < 10; t++) {
        H.tick(1);
    }
};

console.log('== left alone, the popup is on and it interrupts');
{
    const p: any = fresh('lvlon');
    check('the setting starts at 0, which is on', vb(p, 'option_levelup'), 0);
    levelOnce(p);
    check('a modal opens', p.containsModalInterface(), true);
    check('  and the player is busy because of it', p.busy(), true);
    check(
        '  the chat line is still there',
        H.mesgs.some(m => m.who === p.username && m.text.includes('advanced a fishing level')),
        true
    );
    check('  and the fireworks go off', firedAt.includes(p.username), true);
}

console.log('\n== turned off, nothing opens');
{
    const p: any = fresh('lvloff');
    H.setVar(p, 'option_levelup', 1);
    levelOnce(p);
    check('no modal', p.containsModalInterface(), false);
    check('  and nothing is blocking the player', p.busy(), false);
    // The three things that tell you it happened, which must survive.
    check(
        '  the chat line survives',
        H.mesgs.some(m => m.who === p.username && m.text.includes('advanced a fishing level')),
        true
    );
    check('  so do the fireworks', firedAt.includes(p.username), true);
}

console.log('\n== and the Options tab button flips it, and says which it is');
{
    const p: any = player('lvlbtn', 3222, 3218, 0);
    const text = () => {
        const seen = H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.com === Component.getId('options:levelup_popup'));
        return seen.length ? (seen[seen.length - 1].text ?? '') : '(never set)';
    };
    H.clearLogs();
    H.runProc(p, '[proc,options_tooltips]');
    check('the tab reads On to begin with', text(), 'Level-up popup: On');
    H.clearLogs();
    H.ifButton(p, 'options:levelup_popup');
    H.tick(1);
    check('clicking it turns the popup off', vb(p, 'option_levelup'), 1);
    check('  and the tab says so', text(), 'Level-up popup: Off');
    H.clearLogs();
    H.ifButton(p, 'options:levelup_popup');
    H.tick(1);
    check('clicking again turns it back on', vb(p, 'option_levelup'), 0);
    check('  and the tab says that too', text(), 'Level-up popup: On');
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
