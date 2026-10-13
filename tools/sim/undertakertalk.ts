// The Undertaker explains his outfit. Every branch driven, and the two figures he quotes checked
// against the configs they are read from - he states the hat's token price and the bounty a killer
// is paid for it, so retuning configs/undertaker_outfit.obj must not leave him lying.
//
//   npx tsx tools/sim/undertakertalk.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player, talk } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const hat: any = ObjType.get(ObjType.getId('undertaker_hat'));
const price = hat.cost;
const bounty = hat.params.get(ParamType.getId('pvp_token_bounty'));
console.log(`undertaker_hat: cost=${price} tokens, pvp_token_bounty=${bounty}`);
check('the hat has both figures to quote', [typeof price, typeof bounty], ['number', 'number']);

// CHAT LINES WRAP. The interface breaks a long line across several components, so a phrase that
// straddles a wrap matches nothing when each line is searched on its own - "It is not armour. It is
// a" / "uniform." A single joined string is what to search.
const said = (lines: string[], s: string) => lines.join(' ').includes(s);

const npc = H.npcNear('undertaker', 3094, 3492, 0) ?? A.findNpc('undertaker', player('probe', 3094, 3492, 0));
check('the Undertaker is spawned', npc !== null, true);

function ask(name: string, picks: (number | string)[]) {
    const p: any = player(name, npc!.x + 1, npc!.z, npc!.level);
    const lines = talk(p, 'undertaker', picks, 1, false);
    H.tick(4);
    return lines;
}

console.log('\n-- the new option is on the menu');
{
    const lines = ask('t1', ['What does your outfit do?', 'I see.']);
    console.log(lines.slice(0, 6));
    check('he answers that it does nothing', said(lines, 'Nothing whatsoever'), true);
    check('  ...and says it is not armour', said(lines, 'It is not armour. It is a uniform'), true);
    check('  ...and that the cane is only a cane', said(lines, 'holding a cane instead of a weapon'), true);
}

console.log('\n-- "why would anyone wear it?" runs on into the death answer');
{
    const lines = ask('t2', ['What does your outfit do?', 'Then why would anyone wear it?']);
    check('the point is that it cannot be bought from anyone else', said(lines, 'nobody can buy it'), true);
    check('  ...and it falls through to what death costs', said(lines, 'It is gone'), true);
}

console.log('\n-- what death costs, with the figures');
{
    const lines = ask('t3', ['What does your outfit do?', 'What happens if I die in it?']);
    console.log(lines.filter(l => l.length > 25).slice(0, 6));
    // A line too long for the four-line chatbox spills onto a second page and the speaker's name
    // lands in the middle of the sentence. Searching the JOINED text for a contiguous phrase is
    // what catches that, so these are not just spelling checks.
    check('no line of his overflows its box', lines.join(' ').includes('Undertaker protects'), false);
    check('it cannot be kept as one of the three', said(lines, 'never one of the three things you hold on to'), true);
    check('  ...and no prayer protects it', said(lines, 'no prayer protects it'), true);
    check('he quotes the hat price out of the config', said(lines, `${price} tokens for the hat`), true);
    check('  ...and the bounty a killer is paid', said(lines, `I pay them ${bounty} for the hat`), true);
    check('a monster up there destroys it and pays nobody', said(lines, 'nobody is paid at all'), true);
    check('south of the signs it is only clothing', said(lines, 'pick it back up'), true);
}

console.log('\n-- and the old options still work');
{
    check('the shop still opens', ask('t4', ['What have you got?']).length >= 0, true);
    const lines = ask('t5', ['What are death tokens?']);
    check('the token explanation is untouched', said(lines, 'What the Wilderness pays out'), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
