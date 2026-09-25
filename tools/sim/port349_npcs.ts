// The PlagueCityRS 349 npc/area port (content branch port349-npcs): every npc, loc and book whose
// script changed, driven on the real engine through its main branches.
//
// Usage: BUILD_SRC_DIR=/path/to/content npx tsx tools/sim/port349_npcs.ts
import { R, check, player, talk, drive, saw, useOn, op, held, findNpc, mark, mesSince, H, World } from './a1lib.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

// every runtime script error, from any script, anywhere
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|error in script|ScriptRunner/i.test(s)) errors.push(s);
    origErr(...a);
};
const origWarn = console.warn;
console.warn = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|error in script/i.test(s)) errors.push(s);
    origWarn(...a);
};

await H.boot();
H.loginOrder();

// Chat text arrives one component per line, and long lines are wrapped over several: compare on the
// joined text with "|" breaks read as spaces.
const flat = (x: string) => x.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
const has = (lines: string[], s: string) => flat(lines.join(' ')).includes(flat(s));
void saw;
const noErrors = (what: string, from: number) => check(`${what}: no script errors`, errors.slice(from), []);

/** Run a script until it pauses on a chat of this root, clicking through anything else and taking picks at menus. */
function runUntil(p: Player, root: string, picks: number[] = [], max = 200): boolean {
    for (let i = 0; i < max; i++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            if (open === root) return true;
            if (open.startsWith('multi')) {
                const pick = picks.shift();
                if (pick === undefined) return false;
                H.choose(p, `${open}:com_${pick}`);
            } else {
                p.executeScript(s, true, true);
            }
            continue;
        }
        H.tick(1);
    }
    return false;
}

/** talk(), but keeping the lines said before the first pause too. */
function talkAll(p: Player, npcName: string, picks: (number | string)[] = []): string[] {
    const from = H.ifaces.length;
    talk(p, npcName, picks);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

// ============================================================================================
console.log('WIZARDS\' TOWER - the split-bark armourer (armourmaking_wizard)');
{
    const e0 = errors.length;
    const p = player('np_wiz1', 3108, 3162, 1);
    let lines = talkAll(p, 'armourmaking_wizard', [1, 1, 1]);
    check('opens "Hello there, can I help you?"', has(lines, 'Hello there, can I help you?'), true);
    check('split-bark explained', has(lines, 'Split-bark armour is special armour for mages'), true);
    check('"Well good luck with that." closes', has(lines, 'Well good luck with that.'), true);

    lines = talkAll(p, 'armourmaking_wizard', [2, 2, 2]);
    check('"What\'s that you\'re wearing?" branch', has(lines, 'This is split-bark armour'), true);
    check('prices given', has(lines, '37,000 for a top'), true);

    // Make one helm: 2 bark, 2 cloth, 6000 coins.
    H.give(p, 'hollow_bark', 2);
    H.give(p, 'fine_cloth', 2);
    H.give(p, 'coins', 7000);
    const npc = findNpc('armourmaking_wizard', p);
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    // "Can you make me some armour please?" - stops at the make-x window
    const reached = runUntil(p, 'skillmulti5', [3]);
    check('the five-item make window opens', reached, true);
    if (reached) {
        const f0 = H.ifaces.length;
        H.choose(p, 'skillmulti5:com_10'); // helm, make 1
        drive(p);
        lines = H.ifaces.slice(f0).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
    }
    check('made a split-bark helm', [H.invCount(p, 'splitbark_helm'), H.invCount(p, 'hollow_bark'), H.invCount(p, 'fine_cloth'), H.invCount(p, 'coins')], [1, 0, 0, 1000]);
    check('"There you go, enjoy your new armour!"', has(lines, 'enjoy your new armour'), true);

    // Not enough for a body.
    const n2 = findNpc('armourmaking_wizard', p);
    p.teleport(n2.x + 1, n2.z, n2.level);
    H.tick(1);
    H.opNpc(p, n2, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    if (runUntil(p, 'skillmulti5', [3])) {
        const f0 = H.ifaces.length;
        H.choose(p, 'skillmulti5:com_14'); // body, make 1
        drive(p);
        lines = H.ifaces.slice(f0).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
        check('too poor for a body: the price is quoted', has(lines, '37,000 coins for a splitbark body'), true);
    } else check('second make window', false, true);
    noErrors('armourmaking wizard', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('EAST ARDOUGNE - Elena after Regicide');
{
    const e0 = errors.length;
    const p = player('np_elena', 2593, 3336);
    H.setVar(p, 'biohazard', 16);
    H.setVar(p, 'regicide_quest', 15);
    let lines = talkAll(p, 'elena2');
    check('after Regicide: "It\'s been a long time."', has(lines, "It's been a long time. What can I do for you?"), true);
    H.setVar(p, 'regicide_quest', 0);
    lines = talkAll(p, 'elena2');
    check('Regicide not done: her Biohazard line is untouched', has(lines, 'let me know when you hear from King Lathas again'), true);
    noErrors('elena', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('VARROCK - Romeo and Juliet say "Cadava"');
{
    const e0 = errors.length;
    const p = player('np_rj', 3195, 3404);
    H.setVar(p, 'rjquest', 40); // ^romeojuliet_spoken_father
    let lines = talkAll(p, 'apothecary');
    check('apothecary: "I need a Cadava potion"', [has(lines, 'Cadava potion'), lines.some(l => l.includes('Cadaver'))], [true, false]);
    H.give(p, 'cadavaberries', 1);
    lines = talkAll(p, 'apothecary', []);
    check('apothecary makes the potion ("a Cadava potion")', [H.invCount(p, 'cadava'), has(lines, 'Cadava potion')], [1, true]);
    H.setVar(p, 'rjquest', 40);
    lines = talkAll(p, 'father_lawrence');
    check('Father Lawrence: "Remember, Cadava potion"', has(lines, 'Remember, Cadava potion, for Father Lawrence.'), true);
    H.setVar(p, 'rjquest', 50);
    lines = talkAll(p, 'father_lawrence');
    check('Father Lawrence: "I\'ve got the Cadava potion."', has(lines, 'Cadava potion'), true);
    lines = talkAll(p, 'juliet_multi_visible');
    check('Juliet: "I have a Cadava potion from Father Lawrence."', has(lines, 'I have a Cadava potion from Father Lawrence.'), true);
    noErrors('romeo & juliet', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('DRAYNOR - Diango');
{
    const e0 = errors.length;
    const p = player('np_diango', 3081, 3250);
    let lines = talkAll(p, 'aprilfoolshorsesalesman', [2]);
    check('opens "Howdy there partner!" / "Hi Diango!"', [has(lines, 'Howdy there partner!'), has(lines, 'Hi Diango!')], [true, true]);
    check('"I\'m fine, thanks." is spoken', has(lines, "I'm fine, thanks."), true);
    talkAll(p, 'aprilfoolshorsesalesman', [1]);
    check('"Toy horseys?" opens the shop', p.modalMain === Component.getId('shop_template'), true);
    p.closeModal();
    noErrors('diango', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('TAVERLEY DUNGEON - Velrak');
{
    const e0 = errors.length;
    const p = player('np_velrak', 2930, 9685);
    let lines = talkAll(p, 'velrak_the_explorer', [1, 2]);
    check('the second choice reads the line it answers with', has(lines, "No, it's too dangerous for me too."), true);
    check('"I don\'t blame you!"', has(lines, "I don't blame you!"), true);
    lines = talkAll(p, 'velrak_the_explorer', [1, 1]);
    check('"Yes please!" gives the dusty key', H.invCount(p, 'dusty_key'), 1);
    noErrors('velrak', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('BURTHORPE - Tostig and the townsfolk');
{
    const e0 = errors.length;
    const p = player('np_burth', 2905, 3537);
    const before = H.ifaces.length;
    // Tostig's handler is an ap one - he is talked to across the bar - so stand off a few tiles
    const tostig = findNpc('death_barman', p);
    p.teleport(tostig.x, tostig.z - 3, 0);
    H.tick(1);
    H.opNpc(p, tostig, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    drive(p, [2]);
    const lines = H.ifaces.slice(before).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
    check('Tostig opens with his ales', has(lines, 'our speciality is Asgarnian Ale'), true);
    // "No, thanks." is now the player's line, not the barman's
    const noThanks = H.ifaces.slice(before).filter(i => i.who === p.username && i.kind === 'text' && i.text === 'No, thanks.');
    check('"No, thanks." is said (once as the option, once as the reply)', noThanks.length >= 1, true);
    // Every citizen line is reachable now (random(12) over cases 0-11, no duplicate case 10)
    const seen = new Set<string>();
    for (let i = 0; i < 60 && !seen.has('Welcome to Burthorpe!'); i++) {
        for (const l of talkAll(p, 'death_man_outdoors1')) seen.add(l);
    }
    check('a citizen can say "Welcome to Burthorpe!"', seen.has('Welcome to Burthorpe!'), true);
    noErrors('burthorpe', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('VARROCK - Dr Harlow, Thessalia, the Champions\' Guild door');
{
    const e0 = errors.length;
    const p = player('np_varrock', 3222, 3398);
    H.setVar(p, 'vampire', 2); // ^quest_vampire_spoke_to_harlow
    H.give(p, 'beer', 1);
    let lines = talkAll(p, 'dr_harlow');
    check('Harlow hands over the stake', [H.invCount(p, 'stake'), has(lines, "Well you're gonna to need a stake")], [1, true]);
    lines = talkAll(p, 'thessalia', [1, 2]);
    check('Thessalia: "on sale, or if you prefer"', has(lines, 'fine pieces of clothing on sale, or if you prefer I can offer you an exclusive total clothing makeover?'), true);
    p.closeModal();
    H.tick(2);
    noErrors('varrock', e0);
    H.despawn(p);
}
{
    const e0 = errors.length;
    const p = player('np_champ', 3191, 3364);
    H.setVar(p, 'qp', 40);
    // enough quest points: the guild master greets you on the way in
    const f0 = H.ifaces.length;
    op(p, 3191, 3363, 'championdoor', 1);
    const lines = H.ifaces.slice(f0).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
    check('guild master greets with a line break', has(lines, 'Greetings bold adventurer.|Welcome to the guild of Champions.'), true);
    noErrors('champions guild', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('SHILO VILLAGE - the travelling cart');
{
    const e0 = errors.length;
    const p = player('np_shilo', 2832, 2952);
    const m = mark();
    op(p, 2831, 2952, 'shilocart', 2, [2]);
    const ms = mesSince(p, m);
    check('the cart is described in two game messages', [ms.includes('This looks like a sturdy travelling cart.'), ms.includes('A nearby man walks over to you.')], [true, true]);
    p.closeModal();
    noErrors('shilo cart', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('HEROES\' GUILD - the Fountain of Heroes');
{
    const e0 = errors.length;
    const p = player('np_glory', 2916, 9893);
    H.give(p, 'amulet_of_glory', 1);
    const m = mark();
    useOn(p, 2917, 9893, 'fountain_of_heroes', 'amulet_of_glory');
    const ms = mesSince(p, m);
    check('the amulet is charged', [H.invCount(p, 'amulet_of_glory_4'), H.invCount(p, 'amulet_of_glory')], [1, 0]);
    check('the 2006 messages', [ms.includes('You dip the amulet in the fountain...you feel a power emanating from it.'), ms.includes('You can now rub the amulet to teleport and wear it to get more gems whilst mining.')], [true, true]);
    noErrors('fountain of heroes', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('DRAGONS - the antifire message');
{
    const e0 = errors.length;
    const p = player('np_dragon', 3200, 3200);
    const dragon = H.addNpc('green_dragon', 3202, 3200);
    H.tick(1);
    H.setVar(p, 'dragonresist', World.currentTick + 500);
    const m = mark();
    const script = ScriptProvider.getByName('[proc,dragon_fire]');
    check('dragon_fire exists', !!script, true);
    if (script) {
        const state = ScriptRunner.init(script, dragon, p, []);
        ScriptRunner.execute(state);
    }
    H.tick(2);
    check('"Your potion protects you from the heat of the dragon\'s breath!"', mesSince(p, m).includes("Your potion protects you from the heat of the dragon's breath!"), true);
    noErrors('dragon', e0);
    H.despawn(p);
}

// ============================================================================================
console.log('GNOME STRONGHOLD - Gianne\'s cook book and Blurberry\'s cocktail guide');
{
    const e0 = errors.length;
    const p = player('np_books', 2449, 3500);
    H.give(p, 'giannes_cook_book', 1);
    H.give(p, 'cocktail_guide', 1);
    const opened = (name: string) => p.modalMain === Component.getId(name);
    const textSince = (from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');

    let f = H.ifaces.length;
    held(p, 'giannes_cook_book', 1);
    check('cook book: the index opens', [opened('blurberry_cocktail_guide2'), textSince(f).includes("Gianne's cook book")], [true, true]);
    f = H.ifaces.length;
    H.ifButton(p, 'blurberry_cocktail_guide2:worm_hole');
    drive(p);
    check('cook book: Worm Hole page', [opened('giannes_cook_book'), textSince(f).includes('Worm Hole')], [true, true]);
    f = H.ifaces.length;
    H.ifButton(p, 'giannes_cook_book:rightarrow');
    drive(p);
    check('cook book: next page is Veg Ball', textSince(f).includes('Veg Ball'), true);
    H.ifButton(p, 'giannes_cook_book:index');
    drive(p);
    check('cook book: back to the index', opened('blurberry_cocktail_guide2'), true);
    p.closeModal();

    f = H.ifaces.length;
    held(p, 'cocktail_guide', 1);
    check('cocktail guide: the index opens', [opened('blurberry_cocktail_guide2'), textSince(f).includes('The Blurberry Cocktail Guide')], [true, true]);
    f = H.ifaces.length;
    H.ifButton(p, 'blurberry_cocktail_guide2:drunk_dragon');
    drive(p);
    check('cocktail guide: Drunk Dragon page', [opened('blurberry_cocktail_guide'), textSince(f).includes('Drunk Dragon')], [true, true]);
    f = H.ifaces.length;
    H.ifButton(p, 'blurberry_cocktail_guide:leftarrow');
    drive(p);
    check('cocktail guide: back a page is Chocolate Saturday', textSince(f).includes('Chocolate Saturday'), true);
    H.ifButton(p, 'blurberry_cocktail_guide:index');
    drive(p);
    check('cocktail guide: back to the index', opened('blurberry_cocktail_guide2'), true);
    p.closeModal();
    noErrors('books', e0);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL, ${errors.length} script errors`);
process.exit(R.bad ? 1 : 0);
