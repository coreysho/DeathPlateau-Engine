// EVERY op2 THAT FELL THROUGH TO "WEAR", and what each of them does now.
//
//   npx tsx tools/sim/opheld2.ts
//
// Reported as "cant extinguish candle lantern - says no wearpos". The message is ~equip's own
// ([DEBUG]: No wearpos set on ...), which means the Extinguish click was running the EQUIP code:
// [opheld2,_] in content/scripts/player/scripts/equip.rs2 is a global, so an obj whose op2 is not
// Wear gets it anyway unless something more specific claims the trigger. With a wearpos the obj is
// silently worn; without one the player is shown a debug line.
//
// That global is also why "run audit on others" was worth doing. The earlier opheld audit looked
// for options with NO handler, and op2 always had one, so all eighty-six of these were invisible to
// it - including four items whose other options were dead too and whose animations have been in the
// cache the whole time.
//
// The first block is the audit, standing as a check. The rest is what the eighty-six do now, and
// every one of these assertions fails on the code as it was.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import Environment from '#/util/Environment.js';

// RUN ENERGY IS PINNED FULL IN THIS ENVIRONMENT. NODE_UNLIMITED_RUN defaults to true and
// Player.processRunEnergy then puts runenergy back to 10000 every tick, so nettle tea's 5% is
// invisible until the ordinary drain is put back for the length of this sim. Setting process.env
// here is too late - Environment reads it when the module loads, which the import above already
// did - so the field is written directly.
Environment.NODE_UNLIMITED_RUN = false;

await H.boot();
H.loginOrder();

/**
 * Verbs that MEAN wear, so the global is the right handler and the obj needs no trigger of its own.
 * Hold is the gnomeball and the monkey talisman; Play-With is the three fishbowls with a fish in
 * them, which carry manwear and womanwear models and so are held up in the hand exactly as the
 * global would hold them. An obj with one of these and no wearpos would still be broken, which is
 * why the check below tests both halves.
 */
const HOLD = /^(wear|wield|equip|hold|play-with)$/i;
/** The five whose op2 is a hold-style verb, so [opheld2,_] equipping them is correct. */
const HOLD_ON_PURPOSE = ['ball_gnomeball_game', 'mm_monkey_talisman', 'fishbowl_bluefish', 'fishbowl_greenfish', 'fishbowl_spinefish'];
/** Wear or Wield in the cache, and no wearpos to wear it in. A cache fault, not a missing trigger. */
const NO_WEARPOS = [
    'blue_partyhat_obj2422 op2=Wear',
    'slayer_broad_arrows_5 op2=Wield',
    'slayer_broad_arrows_4 op2=Wield',
    'slayer_broad_arrows_3 op2=Wield',
    'slayer_broad_arrows_2 op2=Wield',
    'evil_bob_amulet_of_manspeak op2=Wear',
    'elid_robetop_torn op2=Wear',
    'elid_robebottoms_torn op2=Wear',
    'magictraining_leather_boots op2=Wear',
    'magictraining_adamant_kiteshield op2=Wear',
    'magictraining_adamant_med_helm op2=Wear',
    'magictraining_rune_longsword op2=Wield'
];
const hasTrigger = (id: number, cat: number, op: number) => !!(ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELD1 + (op - 1), id, -1) || (cat !== -1 && ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELD1 + (op - 1), -1, cat)));

console.log('NO op2 FALLS THROUGH TO THE GLOBAL WEAR ANY MORE');
{
    const fell: string[] = [];
    const wornByGlobal: string[] = [];
    for (let id = 0; id < ObjType.count; id++) {
        const t: any = ObjType.get(id);
        if (!t.debugname || t.certlink !== -1) continue;
        const label = t.iop?.[1];
        if (!label || label === 'hidden') continue;
        if (hasTrigger(id, t.category, 2)) continue;
        if (HOLD.test(label)) {
            // left to the global on purpose - so it had better have somewhere to go
            if (t.wearpos === -1) wornByGlobal.push(`${t.debugname} op2=${label}`);
            continue;
        }
        fell.push(`${t.debugname} op2=${label}`);
    }
    check('  nothing with a non-wear op2 is left to the equip code', fell, []);
    // The five left to the global on purpose, named: Hold and Play-With MEAN wear here, and the
    // global is the right handler only for as long as these have somewhere to wear it.
    check(
        '  and the five it is left to on purpose all have a wearpos',
        HOLD_ON_PURPOSE.filter(n => (ObjType.get(ObjType.getId(n)) as any).wearpos === -1),
        []
    );
    // A DIFFERENT FAULT, FOUND IN PASSING AND NOT FIXED HERE. These twelve say Wear or Wield and
    // have nothing to wear it in, so ~equip refuses them with the same debug line - but the cache
    // record is what is wrong, not a missing trigger, and all twelve look like display or duplicate
    // objs rather than things a player is meant to hold (a second partyhat record, the Mage
    // Training Arena's display armour, Elid's torn robes, four noted broad arrow stacks). Asserted
    // as a list so the day one is given a wearpos, or a new one appears, this says the list moved.
    check('  and the twelve Wear options with no wearpos are still exactly these', wornByGlobal.sort(), [...NO_WEARPOS].sort());
}

/**
 * Click an item's option and hand back everything that was said, chat log and message box both.
 *
 * An item the player is not carrying is reported rather than thrown. Several of these checks walk
 * a chain - five removals down a basket, four options on one yo-yo - and on code where the first
 * step does nothing the second step's item never exists. A throw there would take the rest of the
 * sim with it and say nothing about the blocks below.
 */
function clickText(p: any, objName: string, op: number, picks: (number | string)[] = []) {
    if (H.invCount(p, objName) === 0) return [`(not carrying ${objName})`];
    // getByTrigger, not hasTrigger: this wants to know whether the CLICK goes anywhere at all,
    // globals included, so that on code where op2 reached [opheld2,_] the debug line still lands
    // here to be asserted against. hasTrigger above deliberately cannot see a global, because that
    // is the whole question the audit is asking.
    const t: any = ObjType.get(ObjType.getId(objName));
    if (!ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + (op - 1), t.id, t.category)) return [`(no opheld${op} trigger for ${objName})`];
    const ifMark = H.ifaces.length;
    const m = A.mark();
    // A `picks` entry that never appears is a drive() throw, which on code where the click goes
    // somewhere else entirely is the normal outcome rather than a fault in the sim. Reported, so
    // the blocks below this one still run and still say what they found.
    let out: string[];
    try {
        out = A.held(p, objName, op, picks);
    } catch (e) {
        out = [`(${(e as Error).message})`];
    }
    H.tick(4);
    const box = H.ifaces
        .slice(ifMark)
        .filter(i => i.who === p.username && i.kind === 'text')
        .map(i => i.text ?? '');
    return out.concat(A.mesSince(p, m)).concat(box);
}

/** The thing the bug reporter saw. No assertion here should ever find it again. */
const DEBUG_LINE = 'No wearpos set';

console.log('\nTHE FIVE LIT LIGHT SOURCES GO OUT, which is what was reported');
{
    const PAIRS: [string, string][] = [
        ['candle_lantern_lit', 'candle_lantern_unlit'],
        ['candle_lantern_black_lit', 'candle_lantern_black_unlit'],
        ['oil_lamp_lit', 'oil_lamp_unlit'],
        ['oil_lantern_lit', 'oil_lantern_unlit'],
        ['bullseye_lantern_lit', 'bullseye_lantern_unlit']
    ];
    for (const [lit, unlit] of PAIRS) {
        const p: any = player('o2_' + lit, 3222, 3218);
        H.clearInv(p);
        H.give(p, lit);
        const said = clickText(p, lit, 2);
        check(`  ${lit.padEnd(26)} -> ${unlit}`, [H.invCount(p, lit), H.invCount(p, unlit)], [0, 1]);
        check('    and says so, not the debug line', [said.some(s => s.includes('You extinguish')), said.some(s => s.includes(DEBUG_LINE))], [true, false]);
        H.despawn(p);
    }

    // ...and a FULL inventory can still put a lantern out, because the unlit one is written back
    // into the slot the lit one came from rather than added.
    const full: any = player('o2_lantern_full', 3222, 3218);
    H.clearInv(full);
    H.give(full, 'candle_lantern_lit');
    H.fillInv(full);
    clickText(full, 'candle_lantern_lit', 2);
    check('  a full inventory can still extinguish one', H.invCount(full, 'candle_lantern_unlit'), 1);
    H.despawn(full);
}

console.log('\nONE PIECE OF FRUIT COMES BACK OUT OF A BASKET, and one vegetable out of a sack');
{
    // The whole chain down, a step at a time: the count lives in the obj id, so five removals from
    // a full basket have to walk basket_apple_5 -> 4 -> 3 -> 2 -> 1 -> basket_empty.
    const p: any = player('o2_basket', 3222, 3218);
    H.clearInv(p);
    H.give(p, 'basket_apple_5');
    const steps: string[] = [];
    for (let n = 5; n >= 1; n--) {
        clickText(p, `basket_apple_${n}`, 2);
        // read it HERE: by the end of the loop only the empty basket is left, so checking after
        // would pass on a chain that skipped every step but the last
        const want = n > 1 ? `basket_apple_${n - 1}` : 'basket_empty';
        steps.push(`${want}=${H.invCount(p, want)}`);
    }
    check('  five removals walk the basket down to an empty one', steps, ['basket_apple_4=1', 'basket_apple_3=1', 'basket_apple_2=1', 'basket_apple_1=1', 'basket_empty=1']);
    check('  and five cooking apples came out', H.invCount(p, 'cooking_apple'), 5);
    check('    with the basket itself gone', H.invCount(p, 'basket_apple_5'), 0);
    H.despawn(p);

    // A sack holds ten, so it is the other half of the same table.
    const s: any = player('o2_sack', 3222, 3218);
    H.clearInv(s);
    H.give(s, 'sack_potato_10');
    for (let n = 10; n >= 1; n--) clickText(s, `sack_potato_${n}`, 2);
    check('  ten removals empty a sack', [H.invCount(s, 'sack_empty'), H.invCount(s, 'potato')], [1, 10]);
    H.despawn(s);

    // ...and every container in the table answers at all. A trigger per count is 55 of them and a
    // missed one would be a silent debug line on exactly one basket size.
    const KINDS: [string, string, number][] = [
        ['basket_apple', 'cooking_apple', 5],
        ['basket_orange', 'orange', 5],
        ['basket_strawberry', 'strawberry', 5],
        ['basket_banana', 'banana', 5],
        ['basket_tomato', 'tomato', 5],
        ['sack_potato', 'potato', 10],
        ['sack_onion', 'onion', 10],
        ['sack_cabbage', 'cabbage', 10]
    ];
    const silent: string[] = [];
    for (const [kind, contents, max] of KINDS) {
        for (let n = 1; n <= max; n++) {
            const q: any = player(`o2_${kind}_${n}`, 3222, 3218);
            H.clearInv(q);
            H.give(q, `${kind}_${n}`);
            const said = clickText(q, `${kind}_${n}`, 2);
            if (H.invCount(q, contents) !== 1 || said.some(t => t.includes(DEBUG_LINE))) silent.push(`${kind}_${n}`);
            H.despawn(q);
        }
    }
    check('  all 55 filled baskets and sacks hand one over', silent, []);

    // The produce needs a slot. The container goes back where it was, so what is wanted is one free
    // slot and not two - and with none at all it refuses rather than eating the fruit.
    const fullInv: any = player('o2_basket_full', 3222, 3218);
    H.clearInv(fullInv);
    H.give(fullInv, 'basket_apple_3');
    H.fillInv(fullInv);
    const said = clickText(fullInv, 'basket_apple_3', 2);
    check(
        '  a full inventory is refused',
        said.some(t => t.includes('enough inventory space')),
        true
    );
    check('    and the basket is untouched', [H.invCount(fullInv, 'basket_apple_3'), H.invCount(fullInv, 'cooking_apple')], [1, 0]);
    H.despawn(fullInv);
}

console.log('\nNETTLE TEA IS DRINKABLE, and its run energy depends on being hurt');
{
    const VESSELS: [string, string][] = [
        ['bowl_nettletea', 'bowl_empty'],
        ['bowl_nettletea_milky', 'bowl_empty'],
        ['cup_of_nettletea', 'cup_empty'],
        ['cup_of_nettletea_milky', 'cup_empty'],
        ['chinacup_of_nettletea', 'chinacup_empty'],
        ['chinacup_of_nettletea_milky', 'chinacup_empty']
    ];

    /**
     * Drink one and report what it did.
     *
     * ENERGY IS MEASURED AS A DIFFERENCE BETWEEN TWO DRINKERS, not against 5%. A player standing
     * still also catches their breath - Player.processRunEnergy recovers 8 + agility/6 per tick -
     * so the ticks a click costs are worth a hundred-odd points of energy whatever is drunk. Two
     * players put through the identical motions recover the identical amount, so subtracting one
     * from the other leaves the tea's own 5% and nothing else.
     */
    function drink(name: string, obj: string, hurt: boolean) {
        const p: any = player(name, 3222, 3218);
        H.clearInv(p);
        p.setLevel(PlayerStat.HITPOINTS, 20);
        if (hurt) p.levels[PlayerStat.HITPOINTS] = 10;
        p.runenergy = 5000;
        H.give(p, obj);
        const said = clickText(p, obj, 2);
        const out = { hp: p.levels[PlayerStat.HITPOINTS], energy: p.runenergy - 5000, said, left: H.invCount(p, obj) };
        H.despawn(p);
        return out;
    }

    // The control: the same drink, by a player who is already on full hitpoints. "If you are not at
    // full health, the tea will also refresh some run energy (5%), but if you are already at full
    // hitpoints, run energy will not be restored."
    const whole = drink('o2_tea_whole', 'bowl_nettletea', false);
    check('  at full hitpoints the tea is still drunk', whole.left, 0);

    for (const [tea] of VESSELS) {
        const r = drink('o2_' + tea, tea, true);
        check(`  ${tea.padEnd(28)} heals 3`, r.hp, 13);
        check('    refreshes 5% run energy, on top of catching your breath', r.energy - whole.energy, 500);
        check('    and is drunk', r.left, 0);
        check(
            '    without the debug line',
            r.said.some(s => s.includes(DEBUG_LINE)),
            false
        );
    }

    // Every vessel leaves the right empty one behind - read separately, because drink() despawns.
    for (const [tea, empty] of VESSELS) {
        const p: any = player('o2_empty_' + tea, 3222, 3218);
        H.clearInv(p);
        H.give(p, tea);
        clickText(p, tea, 2);
        check(`  ${tea.padEnd(28)} leaves a ${empty}`, H.invCount(p, empty), 1);
        H.despawn(p);
    }

    // Nettle-WATER is the other drink: "The player is healed 1 Hitpoint when drank", and no energy,
    // which is what you get for drinking it before it was boiled.
    const water = drink('o2_nettlewater', 'bowl_nettlewater', true);
    check('  nettle-water heals one', water.hp, 11);
    check('    and refreshes no energy at all', water.energy - whole.energy, 0);
}

console.log('\nA CUP OF TEA FROM YOUR OWN KITCHEN BOOSTS CONSTRUCTION BY THE CUP IT IS IN');
{
    const CUPS: [string, string, number][] = [
        ['poh_claycup_tea', 'poh_claycup_empty', 1],
        ['poh_claycup_tea_milky', 'poh_claycup_empty', 1],
        ['poh_chinacup_tea', 'poh_chinacup_empty', 2],
        ['poh_chinacup_tea_milky', 'poh_chinacup_empty', 2],
        ['poh_giltchinacup_tea', 'poh_giltchinacup_empty', 3],
        ['poh_giltchinacup_tea_milky', 'poh_giltchinacup_empty', 3]
    ];
    for (const [tea, empty, boost] of CUPS) {
        const p: any = player('o2_' + tea, 3222, 3218);
        H.clearInv(p);
        p.setLevel(PlayerStat.CONSTRUCTION, 50);
        H.give(p, tea);
        clickText(p, tea, 2);
        check(`  ${tea.padEnd(28)} boosts Construction by ${boost}`, p.levels[PlayerStat.CONSTRUCTION] - 50, boost);
        check('    and leaves the empty cup', [H.invCount(p, empty), H.invCount(p, tea)], [1, 0]);
        // Empty was dead too - a second option on the same six cups, and the same sweep found it.
        H.clearInv(p);
        H.give(p, tea);
        clickText(p, tea, 3);
        check('    Empty pours it away', [H.invCount(p, empty), H.invCount(p, tea)], [1, 0]);
        H.despawn(p);
    }
}

console.log('\nTHE BOOK OF BINDING CAN ENCHANT A VIAL AGAIN, which nothing could reach');
{
    // ~enchant_vials has always worked; the only route written to it was commented out, so the
    // enchanted vials Legends' Quest needs for holy water could not be made at all.
    const p: any = player('o2_binding', 3222, 3218);
    H.clearInv(p);
    p.setLevel(PlayerStat.MAGIC, 50);
    p.setLevel(PlayerStat.PRAYER, 50);
    H.give(p, 'book_of_binding');
    H.give(p, 'vial_empty', 4);
    const said = clickText(p, 'book_of_binding', 2, ['Enchant 4']);
    check('  four empty vials become four enchanted ones', [H.invCount(p, 'vial_enchanted'), H.invCount(p, 'vial_empty')], [4, 0]);
    check('    and it cost 5 Magic and 5 Prayer per vial', [50 - p.levels[PlayerStat.MAGIC], 50 - p.levels[PlayerStat.PRAYER]], [20, 20]);
    check(
        '    with no debug line',
        said.some(s => s.includes(DEBUG_LINE)),
        false
    );
    H.despawn(p);

    // The level gate, which is the commented block's own and is kept
    const low: any = player('o2_binding_low', 3222, 3218);
    H.clearInv(low);
    low.setLevel(PlayerStat.MAGIC, 9);
    low.setLevel(PlayerStat.PRAYER, 50);
    H.give(low, 'book_of_binding');
    H.give(low, 'vial_empty');
    const lowSaid = clickText(low, 'book_of_binding', 2);
    check(
        '  Magic 9 is refused',
        lowSaid.some(s => s.includes('Magic level of at least 10')),
        true
    );
    check('    and keeps the vial', H.invCount(low, 'vial_empty'), 1);
    H.despawn(low);

    // ...and no vials at all is the spell's own answer, not a silent click
    const none: any = player('o2_binding_none', 3222, 3218);
    H.clearInv(none);
    none.setLevel(PlayerStat.MAGIC, 50);
    none.setLevel(PlayerStat.PRAYER, 50);
    H.give(none, 'book_of_binding');
    const noneSaid = clickText(none, 'book_of_binding', 2);
    check(
        '  no vials says so',
        noneSaid.some(s => s.includes("don't have the right components")),
        true
    );
    H.despawn(none);
}

console.log("\nTHE CADAVA POTION CAN BE DRUNK, IN THE APOTHECARY'S HOUSE AND NOWHERE ELSE");
{
    const inHouse: any = player('o2_cadava', 3194, 3404);
    H.clearInv(inHouse);
    H.give(inHouse, 'cadava');
    const hp = inHouse.levels[PlayerStat.HITPOINTS];
    const said = clickText(inHouse, 'cadava', 2);
    check('  it is drunk', H.invCount(inHouse, 'cadava'), 0);
    check(
        '    and you are nearly dead',
        said.some(s => s.includes('nearly dead')),
        true
    );
    // "Drinking this potion will not result in any actual damage to the player, nor will it poison"
    check('    but not actually hurt', inHouse.levels[PlayerStat.HITPOINTS], hp);
    H.despawn(inHouse);

    const away: any = player('o2_cadava_away', 3222, 3218);
    H.clearInv(away);
    H.give(away, 'cadava');
    const awaySaid = clickText(away, 'cadava', 2);
    check('  away from him it is kept for Juliet', H.invCount(away, 'cadava'), 1);
    check(
        '    and said so',
        awaySaid.some(s => s.includes('Juliet is the one who needs it')),
        true
    );
    H.despawn(away);
}

console.log('\nTHE YO-YO AND THE MARIONETTES PERFORM, with the sequences the cache always had');
{
    const ACTS: [string, number[]][] = [
        ['xmas_yoyo', [1, 2, 3, 4]],
        ['win05_marionette_complete_blue_alive', [1, 2, 3, 4]],
        ['win05_marionette_complete_green_alive', [1, 2, 3, 4]],
        ['win05_marionette_complete_red_alive', [1, 2, 3, 4]]
    ];
    for (const [obj, ops] of ACTS) {
        const p: any = player('o2_' + obj, 3222, 3218);
        H.clearInv(p);
        H.give(p, obj);
        const played: number[] = [];
        for (const op of ops) {
            H.anims.length = 0;
            clickText(p, obj, op);
            const seqs = H.anims.filter(a => a.who === p.username).map(a => a.seq);
            if (seqs.length) played.push(seqs[0]);
        }
        check(`  ${obj.padEnd(38)} plays four animations`, played.length, 4);
        check('    and four different ones', new Set(played).size, 4);
        H.despawn(p);
    }
}

console.log('\nAND THE REST SAY SOMETHING RATHER THAN SHOWING A DEBUG LINE');
{
    const REST: [string, number, string][] = [
        ['waa_helper', 2, 'Nothing interesting'],
        ['trick_or_treat_head', 2, 'Nothing interesting'],
        ['devious_glowingpouch', 2, 'You empty the pouch'],
        ['fishbowl_net', 2, 'You untangle the net'],
        ['ahoy_map_complete', 2, 'Dragontooth Island'],
        ['rotten_potato', 1, "You're not peeling"],
        ['rotten_potato', 2, "You're not eating"],
        ['rotten_potato', 3, "You're not slicing"]
    ];
    for (const [obj, op, want] of REST) {
        const p: any = player(`o2_${obj}_${op}`, 3222, 3218);
        H.clearInv(p);
        H.give(p, obj);
        const said = clickText(p, obj, op);
        check(`  ${obj.padEnd(22)} op${op}`, [said.some(s => s.includes(want)), said.some(s => s.includes(DEBUG_LINE))], [true, false]);
        H.despawn(p);
    }

    // The Dig Site's panning tray, which is a real transfer rather than a line
    const tray: any = player('o2_tray', 3222, 3218);
    H.clearInv(tray);
    H.give(tray, 'tray_gold');
    clickText(tray, 'tray_gold', 2);
    check('  tray_gold             op2 hands over the nuggets', [H.invCount(tray, 'nuggets'), H.invCount(tray, 'tray_empty'), H.invCount(tray, 'tray_gold')], [1, 1, 0]);
    H.despawn(tray);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
