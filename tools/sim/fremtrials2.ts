// The Fremennik Trials, second round of playtest reports, re-checked against the ORIGINAL quest
// ported from PlagueCityRS 349 (2026-09-25). Usage: npx tsx tools/sim/fremtrials2.ts
// The quest start to finish, and the save migration, are tools/sim/port349_viking.ts.
//
//   longhall   the backstage door: the bouncer's refusals before the quest, without a lyre (the
//              acapella song) and after the Bard's trial; in with the enchanted lyre, the
//              performance on the stage, and OUT of the door afterwards (it used to put you back on
//              the stage every time); out after the quest; the bouncer and the hecklers talk
//   sigmund    the chain of favours link by link: a bystander's "no idea" line, the one who has it
//              asking for the next thing, their "afterwards" line, the other option still reaching
//              their own trial, Askeladden's 5,000 coins (and being short), losing the goods
//   peer       Peer's banking spell sends what you carry and wear to the bank - from his own talk
//              and from the option Thorvald's trial adds
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import { check, stage, setStage, at, player, drain, text, has, talk, clickLoc, done } from './vikinglib.js';

await H.boot();
H.loginOrder();

const M = (x: number, z: number): [number, number] => [2624 + x, 3648 + z];
const said = (p: Player, s: string) => H.mesgs.some(m => m.who === p.username && m.text.includes(s));
const count = (p: Player, inv: string, objName?: string) => {
    const i = p.getInventory(InvType.getId(inv))!;
    let n = 0;
    for (let s = 0; s < i.capacity; s++) {
        const o = i.get(s);
        if (o && (!objName || o.id === ObjType.getId(objName))) n += objName ? o.count : 1;
    }
    return n;
};

// =====================================================================================
console.log('LONGHALL  the backstage door, the bouncer, the performance');
{
    const DOOR = M(43, 35);
    const OUTSIDE = [...M(43, 35), 0];
    const INSIDE = [...M(42, 35), 0];

    const n = player('frem_door_new', ...M(44, 35), 0);
    let t = clickLoc(n, ...DOOR, 'viking_bard_backstage_door', 1);
    check('before the quest: the bouncer turns you away', [has(t, 'Talent only, backstage'), at(n)], [true, OUTSIDE]);
    t = talk(n, 'viking_longhall_bouncer');
    check('  and says the same when talked to', has(t, 'Talent only, backstage'), true);
    H.despawn(n);

    const a = player('frem_door_acapella', ...M(44, 35), 1);
    setStage(a, 'olaf', 1);
    t = clickLoc(a, ...DOOR, 'viking_bard_backstage_door', 1, [3]);
    check('no lyre: "an acapella bard?", a song, "a pile of tosh", still outside', [has(t, 'acapella'), has(t, 'My old man'), has(t, 'pile of tosh'), at(a)], [true, true, true, OUTSIDE]);
    H.despawn(a);

    const p = player('frem_door_bard', ...M(44, 35), 1);
    setStage(p, 'olaf', 5);
    H.give(p, 'viking_enchanted_strung_lyre', 1);
    H.give(p, 'viking_enchanted_strung_lyre', 1);
    t = talk(p, 'viking_longhall_bouncer');
    check('talking to the bouncer with the lyre: "Go on through the door"', has(t, 'Go on through the door'), true);
    p.teleport(...M(44, 35), 0);
    H.tick(1);
    t = clickLoc(p, ...DOOR, 'viking_bard_backstage_door', 1);
    check('with the enchanted lyre: waved through, INSIDE the door', [has(t, 'good to go through'), at(p)], [true, INSIDE]);
    H.walkTo(p, ...M(36, 36));
    for (let i = 0; i < 20 && (p.x !== M(36, 36)[0] || p.z !== M(36, 36)[1]); i++) H.tick(1);
    check('  and walks from backstage onto the stage', at(p), [...M(36, 36), 0]);
    H.clearLogs();
    const from = H.ifaces.length;
    H.opheld(p, 'viking_enchanted_strung_lyre', 1);
    drain(p);
    const sung = H.says.filter(s => s.who === p.username).map(s => s.text);
    check('the performance: four sung lines (a 99 to boast of)', [sung.length, sung[3]], [4, "My Cooking's ninety-nine!"]);
    check("  Olaf: \"That was awesome!\", the Bard's trial done, the vote", [has(text(p, from), 'That was awesome'), said(p, "completed the Bard's Trial"), stage(p, 'olaf')], [true, true, 7]);
    check('  both enchanted lyres lose the blessing', [H.invCount(p, 'viking_enchanted_strung_lyre'), H.invCount(p, 'viking_strung_lyre')], [0, 2]);

    clickLoc(p, ...DOOR, 'viking_bard_backstage_door', 1);
    check('after playing: the door lets you OUT', at(p), OUTSIDE);
    t = clickLoc(p, ...DOOR, 'viking_bard_backstage_door', 1);
    check('  and after the trial the bouncer will not let you back in', [has(t, 'I saw your performance'), at(p)], [true, OUTSIDE]);

    const b = player('frem_door_before', ...M(40, 35), 1);
    setStage(b, 'olaf', 1);
    clickLoc(b, ...DOOR, 'viking_bard_backstage_door', 1);
    check('inside before performing, no lyre at all: out', at(b), OUTSIDE);
    const c = player('frem_door_done', ...M(33, 36), 10);
    clickLoc(c, ...DOOR, 'viking_bard_backstage_door', 1);
    check('inside after the quest: out', at(c), OUTSIDE);
    t = clickLoc(c, ...DOOR, 'viking_bard_backstage_door', 1);
    check('  and after the quest the bouncer keeps you out', [has(t, 'Talent only'), at(c)], [true, OUTSIDE]);
    t = talk(c, 'viking_heckler');
    check('a heckler talks', has(t, 'waiting for the show'), true);
    H.despawn(p, b, c);
}

// =====================================================================================
console.log('SIGMUND  the chain of favours, every link');
{
    const L = ['viking_sigmund', 'viking_sailor', 'viking_olaf', 'viking_clothing_shopkeeper', 'viking_brundt', 'viking_sigli',
        'viking_weapons_salesman', 'viking_fisherman1', 'viking_hallifred', 'viking_peer', 'viking_thorvald', 'viking_reveller_3',
        'viking_longhall_barkeep', 'viking_askelapen'];
    const WHO = ['Sigmund', 'Sailor', 'Olaf', 'Yrsa', 'Brundt', 'Sigli', 'Skulgrimen', 'Fisherman', 'Swensen', 'Peer', 'Thorvald', 'Manni', 'Thora', 'Askeladden'];
    const FIRST = ['', 'mysterious flower', 'sturdy boots to replace', 'reduce the sales tax', 'Speak to Sigli then', 'a new string for my hunting bow',
        'You get me that fish', 'secret map of the best fishing spots', 'no less than a weather forecast', 'I require a bodyguard',
        "Champions' Token to you", 'give you my champions token', 'NEVER EVER EVER', ''];
    const AFTER = ['', 'that terrible bard Olaf', 'I would not trouble you', 'Only the Chieftain', 'pay more attention', 'If I knew I would not have asked',
        "There's another one?", 'rip off navigator', 'from the Seer perhaps', 'simply have asked them myself', 'persuade one of the revellers',
        'the longhall barkeep has it', 'Knowing the little runt', ''];

    const p = player('frem_sigmund', ...M(17, 30), 1);
    let t = talk(p, 'viking_sailor');
    check('before Sigmund sets the task, the sailor just answers the council question (no menu)', [has(t, 'just a sailor'), stage(p, 'sigmund')], [true, 0]);
    t = talk(p, 'viking_sigmund', [2]);
    check('Sigmund, "No": no task', [has(t, 'I simply require a flower'), stage(p, 'sigmund')], [true, 0]);
    t = talk(p, 'viking_sigmund', [1]);
    check('Sigmund, "Yes": the flower (stage 1)', [has(t, 'insular clan'), stage(p, 'sigmund')], [true, 1]);

    const noIdea: string[] = [], firsts: string[] = [], afters: string[] = [];
    for (let link = 1; link <= 12; link++) {
        const by = link === 12 ? 1 : link + 1;
        t = talk(p, L[by], [1]);
        noIdea.push(`${link}:${t.includes("I don't suppose you have any idea") && stage(p, 'sigmund') === link ? 'ok' : t.slice(0, 90)}`);
        t = talk(p, L[link], [1]);
        firsts.push(`${WHO[link]}:${has(t, FIRST[link]) && stage(p, 'sigmund') === link + 1 ? 'ok' : `stage ${stage(p, 'sigmund')} ${t.slice(0, 120)}`}`);
        t = talk(p, L[link], [1]);
        afters.push(`${WHO[link]}:${has(t, AFTER[link]) && stage(p, 'sigmund') === link + 1 ? 'ok' : t.slice(0, 120)}`);
    }
    check('a bystander asked at each step has no idea and moves nothing', noIdea, noIdea.map(s => s.split(':')[0] + ':ok'));
    check('each link, asked in order, answers and names what they want', firsts, firsts.map(s => s.split(':')[0] + ':ok'));
    check('each link asked again gives their "afterwards" line', afters, afters.map(s => s.split(':')[0] + ':ok'));
    t = talk(p, 'viking_sigli', [1]);
    check('Sigli asked about the promise: "Did you even ASK Askeladden?"', has(t, 'Did you even ASK Askeladden'), true);
    t = talk(p, 'viking_hallifred', [1]);
    check('Swensen asked about the promise: "from Askeladden, maybe?"', has(t, 'from Askeladden, maybe'), true);
    t = talk(p, 'viking_peer', [2, 2]);
    check('Peer, "Ask about becoming a Fremennik": his own trial', [has(t, 'constructed a puzzle'), stage(p, 'peer')], [true, 0]);
    t = talk(p, 'viking_thorvald', [2, 2]);
    check('Thorvald, "Ask about becoming a Fremennik": his own trial', [has(t, 'Are you prepared for the battle'), stage(p, 'thorvald')], [true, 0]);

    H.give(p, 'coins', 4999);
    t = talk(p, 'viking_askelapen', [1, 1]);
    check('Askeladden with 4,999 coins: "how embarrassing"', [has(t, 'I appear to be short'), H.invCount(p, 'viking_promissary_note2'), H.invCount(p, 'coins')], [true, 0, 4999]);
    H.give(p, 'coins', 1);
    t = talk(p, 'viking_askelapen', [1, 1]);
    check('  with 5,000: his written promise', [H.invCount(p, 'viking_promissary_note2'), H.invCount(p, 'coins')], [1, 0]);
    t = talk(p, 'viking_askelapen', [1]);
    check('  asked again: the guarantee isn\'t worth the paper', has(t, "isn't worth the paper"), true);
    t = talk(p, 'viking_sailor', [1]);
    check('a trade item at the wrong link: nothing traded', [H.invCount(p, 'viking_promissary_note2'), H.invCount(p, 'viking_rare_flower')], [1, 0]);
    t = talk(p, 'viking_longhall_barkeep', [1]);
    check('the barkeep takes the promise for her cocktail', [H.invCount(p, 'viking_promissary_note2'), H.invCount(p, 'viking_legendary_cocktail')], [0, 1]);
    // lose it: Sigmund sends you back to the start
    p.invDel(InvType.getId('inv'), ObjType.getId('viking_legendary_cocktail'), 1);
    t = talk(p, 'viking_sigmund');
    check('the goods lost: Sigmund sends you back to the beginning', [stage(p, 'sigmund'), has(t, 'start again at the beginning')], [1, true]);
    H.despawn(p);
}

// =====================================================================================
console.log('PEER  the banking spell');
{
    const p = player('frem_peerbank', ...M(10, 21), 1);
    setStage(p, 'peer', 1);
    H.give(p, 'coins', 50);
    H.give(p, 'lobster', 3);
    H.equip(p, { hat: 'bronze_med_helm', rhand: 'bronze_sword' });
    let t = talk(p, 'viking_peer', [1]);
    check('Peer, his trial set: offers the spell, and it banks everything', [has(t, 'The task is done'), count(p, 'inv'), count(p, 'worn'), count(p, 'bank', 'lobster') >= 3, count(p, 'bank', 'bronze_sword') >= 1], [true, 0, 0, true, true]);
    const q = player('frem_peerbank2', ...M(10, 21), 1);
    setStage(q, 'thorvald', 1);
    H.give(q, 'lobster', 2);
    t = talk(q, 'viking_peer', [2, 1]);
    check('on Thorvald\'s trial: "Ask about depositing your equipment"', [has(t, 'Thorvald tells me'), count(q, 'inv')], [true, 0]);
    H.despawn(p, q);
}

done();
