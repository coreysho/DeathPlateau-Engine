// The anvil window and the Herblore bench, driven through the real content on the real map.
//
// The smithing half exists because three playtest reports about the anvil window were all about
// what the server tells the client to *draw* rather than about what lands in the inventory, and
// reading the scripts cannot tell those apart: a row with no icon, a row that cannot be clicked
// and a duplicate row all look identical in `smithing.rs2`. So this records IF_SETHIDE and the
// inventory transmits, and clicks the rows through the engine's own InvButtonHandler - the one
// that refuses a click on a component the player was never shown.
//
// The Herblore half asks the only question that matters for a potion: can a player who has the
// herb and the secondary end up holding the potion. It walks every row of the herblore tables
// rather than the handful the report named, because a gap in one row looks exactly like a gap in
// all of them until you try.
//
// Usage: npx tsx tools/sim/craftgaps.ts [smith|herb ...]
import * as A from './a1lib.js';
import { H, World, LocType, ObjType, ScriptProvider, ServerTriggerType, Player, check, R } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import StructType from '#/cache/config/StructType.js';
import ParamType from '#/cache/config/ParamType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import IfSetHide from '#/network/game/server/model/IfSetHide.js';
import IfSetColour from '#/network/game/server/model/IfSetColour.js';
import UpdateInvFull from '#/network/game/server/model/UpdateInvFull.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import InvButton from '#/network/game/client/model/InvButton.js';

await H.boot();
H.loginOrder();

const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

// What the server told the client to draw. The harness already wraps Player.write for text and
// sounds; this wraps that wrapper, so both sets of records are kept.
type Hide = { who: string; com: number; hidden: boolean };
type Trans = { who: string; com: number; items: (string | null)[] };
const hides: Hide[] = [];
const transmits: Trans[] = [];
const colours: { who: string; com: number; colour: number }[] = [];
{
    const origWrite = (Player.prototype as unknown as { write: (m: unknown) => void }).write;
    (Player.prototype as unknown as { write: (m: unknown) => void }).write = function (m: unknown) {
        const me = this as unknown as { username: string };
        if (m instanceof IfSetHide) hides.push({ who: me.username, com: m.component, hidden: m.hidden });
        if (m instanceof IfSetColour) colours.push({ who: me.username, com: m.component, colour: m.colour });
        if (m instanceof UpdateInvFull) {
            const items: (string | null)[] = [];
            for (let i = 0; i < m.inv.capacity; i++) {
                const o = m.inv.get(i);
                items.push(o ? (ObjType.get(o.id).debugname ?? String(o.id)) : null);
            }
            transmits.push({ who: me.username, com: m.component, items });
        }
        return origWrite.call(this, m);
    };
}

const comId = (name: string) => {
    const id = Component.getId(name);
    if (id === -1) throw new Error('no such component: ' + name);
    return id;
};
/** The last hide the server sent this player for a component, or 'cache default' if it never did. */
function hideState(p: Player, name: string): boolean | string {
    const id = comId(name);
    const last = hides.filter(h => h.who === p.username && h.com === id).pop();
    return last ? last.hidden : 'cache default';
}
/**
 * What is behind an interface inventory, read off the player's own listener - the same lookup
 * InvButtonHandler does. A sim player is a plain Player, not a NetworkPlayer, so the
 * UpdateInvFull packets never get written; the listener is the state those packets carry.
 */
function column(p: Player, name: string): string[] {
    const id = comId(name);
    const listener = p.invListeners.find(l => l.com === id);
    const inv = p.getInventoryFromListener(listener);
    if (!inv) return ['<not transmitted>'];
    const items: (string | null)[] = [];
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        items.push(o ? (ObjType.get(o.id).debugname ?? String(o.id)) : null);
    }
    while (items.length && items[items.length - 1] === null) items.pop();
    return items.map(i => i ?? '-');
}

const invBtn = new InvButtonHandler();
/**
 * Click an item in an interface inventory the way the client does: through the engine's own
 * InvButtonHandler, so the component-visible, option-exists, inventory-transmitted and
 * item-is-in-that-slot checks all run. A row the player was never shown fails here, which is
 * exactly what "not clickable" means.
 */
function clickInv(p: Player, comName: string, objName: string, op = 1): boolean {
    const com = comId(comName);
    const listener = p.invListeners.find(l => l.com === com);
    const inv = p.getInventoryFromListener(listener);
    if (!inv) return false;
    const objId = ObjType.getId(objName);
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === objId) { slot = i; break; }
    if (slot === -1) return false;
    return invBtn.handle(new InvButton(op, objId, slot, com), p);
}

const VARROCK_ANVIL: [number, number] = [3188, 3424];

/**
 * A player the content will talk to: the anvil, the herb bench and half the game check
 * `%tutorial < ^tutorial_complete` first and say something else entirely below it.
 */
function mkPlayer(name: string, x: number, z: number) {
    const p = A.player(name, x, z);
    H.setVar(p, 'tutorial', 1000); // ^tutorial_complete
    H.tick(1);
    for (let t = 0; t < 20 && (p.delayed || p.activeScript); t++) H.tick(1);
    return p;
}

// ---------------------------------------------------------------- smithing
if (want('smith')) {
    console.log('\n== the anvil window ==');

    // Every metal, so the odd-one-out row is checked in the two places it is wrong and the four
    // where it is right.
    const metals: { bar: string; other: string; odd: string | null; column: string }[] = [
        { bar: 'bronze_bar', other: 'Bronze wire', odd: 'bronzecraftwire', column: 'smithing:column5' },
        { bar: 'iron_bar', other: 'Iron spit', odd: 'spit_iron', column: 'smithing:column5' },
        { bar: 'steel_bar', other: 'Steel studs', odd: 'studs', column: 'smithing:column5' },
        { bar: 'mithril_bar', other: null, odd: null, column: 'smithing:column5' },
        { bar: 'adamantite_bar', other: null, odd: null, column: 'smithing:column5' },
        { bar: 'runite_bar', other: null, odd: null, column: 'smithing:column5' }
    ];

    for (const m of metals) {
        const p = mkPlayer('sm_' + m.bar, VARROCK_ANVIL[0] - 1, VARROCK_ANVIL[1]);
        H.give(p, 'hammer');
        H.give(p, m.bar, 10);
        A.useOn(p, VARROCK_ANVIL[0], VARROCK_ANVIL[1], 'anvil', m.bar);
        console.log(` ${m.bar}`);
        check('  the window opens', p.modalMain === comId('smithing'), true);
        for (const c of ['column1', 'column2', 'column3', 'column4', 'column5', 'column_claws', 'column_bolts']) {
            const got = column(p, 'smithing:' + c);
            if (got[0] === '<not transmitted>') check(`  ${c} transmitted`, got, 'anything');
        }
        console.log('    column5 holds: ' + column(p, m.column).join(', '));

        // Report 1: "iron (old lantern frame - missing icon also not clickable)". The row was a
        // bare text with no inventory behind it, so it drew a label over empty space.
        check('  the lantern row stays hidden', hideState(p, 'smithing:lantern_layer'), 'cache default');
        check('  and nothing is transmitted into it', column(p, 'smithing:column_lantern'), ['<not transmitted>']);

        // Report 3: "steel (studs? - shows second studs with no icon - remove)". stud_layer is a
        // second "Studs" label at the bottom of the window with no inventory behind it.
        check('  the second studs label is hidden', hideState(p, 'smithing:stud_layer'), true);

        // The odd-one-out row that replaced them: a real label over a real inventory slot.
        if (m.other) {
            const texts = H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.com === comId('smithing:other_text')).map(i => i.text);
            check('  the other row is named', texts.pop(), m.other);
            check('  and shown', hideState(p, 'smithing:other_layer'), false);
            check('  with the item under it', column(p, m.column).includes(m.odd!), true);

            // ...and it can be clicked, which is the half a script read cannot answer.
            const before = H.invCount(p, m.odd!);
            const clicked = clickInv(p, m.column, m.odd!, 1);
            A.drive(p);
            H.tick(8);
            check('  the click is accepted', clicked, true);
            check(`  and makes a ${m.odd}`, H.invCount(p, m.odd!) > before, true);
        } else {
            check('  no other row for this metal', hideState(p, 'smithing:other_layer'), true);
        }
        H.despawn(p);
    }

    // Report 2, second half: "iron spit - ... nothing interesting happens". An item that can be
    // made and then has no use at all is the same dead end as a row with no trigger.
    console.log(' the iron spit, once made');
    const p = mkPlayer('sm_spit', 3222, 3218);
    H.give(p, 'spit_iron');
    H.give(p, 'raw_rabbit');
    let from = A.mark();
    A.useHeld(p, 'spit_iron', 'raw_rabbit');
    check('  iron spit on raw rabbit makes a skewered rabbit', H.invCount(p, 'spit_skewered_rabbit_meat'), 1);
    check('  and does not say nothing happens', A.said(p, from, 'Nothing interesting happens'), false);

    check('  the spit itself is a tool, not an ingredient', H.invCount(p, 'spit_iron'), 1);

    // A range has nowhere to rest a spit, so the row carries cantcookmessage_range.
    A.addLoc('range', 3225, 3218, 0);
    // ~mesbox, not mes: the refusal is a dialog box, so it is read off the interface text.
    check('  a range refuses it', A.saw(A.useOn(p, 3225, 3218, 'range', 'spit_skewered_rabbit_meat'), 'open fire'), true);
    check('  and keeps the skewered rabbit', H.invCount(p, 'spit_skewered_rabbit_meat'), 1);

    // ...and the skewered rabbit roasts on a fire, which is the whole point of the spit.
    A.addLoc('fire', 3222, 3219, 0);
    A.useOn(p, 3222, 3219, 'fire', 'spit_skewered_rabbit_meat');
    A.drive(p);
    H.tick(10);
    check('  a fire roasts it', H.invCount(p, 'spit_roasted_rabbit_meat'), 1);
    A.held(p, 'spit_roasted_rabbit_meat', 1);
    H.tick(2);
    check('  roast rabbit can be eaten', H.invCount(p, 'spit_roasted_rabbit_meat'), 0);

    // A level too low burns nothing and cooks nothing: the row's level gate is Old School's 16.
    const low = mkPlayer('sm_spit_low', 3222, 3218);
    low.setLevel(7 /* cooking */, 15);
    H.give(low, 'spit_skewered_rabbit_meat');
    check('  Cooking 15 is refused', A.saw(A.useOn(low, 3222, 3219, 'fire', 'spit_skewered_rabbit_meat'), 'Cooking level of 16'), true);
    H.despawn(p, low);
}

// ---------------------------------------------------------------- herblore
if (want('herb')) {
    // A script run from here executes synchronously inside executeScript, so anything it puts on
    // screen is already written by the time drive() starts recording. Mark the interface log
    // before the click, not after.
    const ifMark = () => H.ifaces.length;
    const ifSince = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    const sawIf = (p: Player, from: number, s: string) => ifSince(p, from).some(t => t.includes(s));

    const P = (n: string) => {
        const id = ParamType.getId(n);
        if (id === -1) throw new Error('no such param: ' + n);
        return id;
    };
    const nm = (id: number | undefined) => (id === undefined ? '-' : (ObjType.get(id).debugname ?? String(id)));

    console.log('\n== herblore: every brew the cache knows about ==');

    // Read the recipes out of the BUILT cache rather than naming them here, so a row that is
    // added, renamed or quietly dropped is swept the day it lands. A struct is a recipe if it
    // says what it makes.
    type Brew = { name: string; ing: number; sol: number; mix: number; level: number; xp: number };
    const brews: Brew[] = [];
    for (let id = 0; id < StructType.count; id++) {
        const s = StructType.get(id);
        const mix = s?.params?.get(P('brew_potion_mixture'));
        if (mix === undefined) continue;
        brews.push({
            name: s.debugname ?? String(id),
            ing: s.params!.get(P('brew_potion_ingredient')) as number,
            sol: s.params!.get(P('brew_potion_solvent')) as number,
            mix: mix as number,
            level: (s.params!.get(P('brew_potion_level')) as number) ?? 3,
            xp: (s.params!.get(P('brew_potion_exp')) as number) ?? 0
        });
    }

    const brewer = mkPlayer('herb_brew', 3222, 3218);
    H.setVar(brewer, 'druidquest', 4); // ^druid_complete - the skill refuses every action below it
    H.setVar(brewer, 'legendsquest', 30); // Ardrigal mixture is gated on Gujuo's pool
    H.setVar(brewer, 'itwatchtower', 20); // jangerberries ask about the ogre potion first

    const broken: string[] = [];
    console.log(` ${brews.length} recipes`);
    for (const b of brews) {
        // Both click orders, because the engine takes the trigger off the target obj first and a
        // recipe can be reachable one way round and dead the other.
        const tryOne = (a: number, c: number) => {
            H.clearInv(brewer);
            H.give(brewer, nm(a));
            H.give(brewer, nm(c));
            A.useHeld(brewer, nm(a), nm(c));
            return H.invCount(brewer, nm(b.mix));
        };
        const fwd = tryOne(b.ing, b.sol);
        const rev = tryOne(b.sol, b.ing);
        const verdict = fwd > 0 && rev > 0 ? 'ok' : fwd > 0 || rev > 0 ? 'ONE WAY ONLY' : 'DEAD';
        if (verdict !== 'ok') broken.push(`${b.name}: ${nm(b.ing)} + ${nm(b.sol)} -> ${nm(b.mix)} (${verdict})`);
        console.log(`  ${verdict === 'ok' ? 'ok  ' : 'FAIL'} ${b.name.padEnd(26)} ${nm(b.ing)} + ${nm(b.sol)} -> ${nm(b.mix).padEnd(22)} lvl ${String(b.level).padStart(2)}  xp ${(b.xp / 10).toFixed(1)}`);
    }
    check(' every brew works both ways round', broken, []);

    // Every finished potion the table makes: can it be drunk, and does it step down a dose?
    console.log('\n== drinking what the table makes ==');
    const undrinkable: string[] = [];
    for (const b of brews) {
        const mix = ObjType.get(b.mix);
        if (!mix.iop || !mix.iop[0]) continue; // unfinished vials have no Drink option, correctly
        H.clearInv(brewer);
        H.give(brewer, nm(b.mix));
        const before = H.invCount(brewer, nm(b.mix));
        const said = ifMark();
        A.held(brewer, nm(b.mix), 1);
        H.tick(4);
        // Answered either by being drunk or by saying why not - blamish oil's Drink is a refusal
        // ("You know... I'd really rather not"), which is what Old School does with it.
        const answered = H.invCount(brewer, nm(b.mix)) < before || ifSince(brewer, said).length > 0;
        if (!answered) undrinkable.push(nm(b.mix));
    }
    check(' every finished potion answers its Drink option', undrinkable, []);

    // The gates, on a maxed sweep that would otherwise never see them.
    const lowbrew = mkPlayer('herb_low', 3222, 3218);
    H.setVar(lowbrew, 'druidquest', 4);
    lowbrew.setLevel(15 /* herblore */, 30);
    H.give(lowbrew, 'unicorn_horn_dust');
    H.give(lowbrew, 'iritvial');
    let from = ifMark();
    A.useHeld(lowbrew, 'unicorn_horn_dust', 'iritvial');
    check(' Herblore 30 cannot make superantipoison', sawIf(lowbrew, from, 'Herblore level of at least 48'), true);
    const noquest = mkPlayer('herb_noquest', 3222, 3218);
    H.give(noquest, 'eye_of_newt');
    H.give(noquest, 'guamvial');
    let mfrom = A.mark();
    A.useHeld(noquest, 'eye_of_newt', 'guamvial');
    check(' and Druidic Ritual still gates the skill', A.said(noquest, mfrom, 'Druidic Ritual'), true);
    H.despawn(lowbrew, noquest);

    // ---- the antidote line, which is not in the struct table: it is hand-written because the
    // scale count varies with the dose (scripts/antivenom).
    console.log('\n== the antidote line ==');
    const anti = mkPlayer('herb_anti', 3222, 3218);
    H.setVar(anti, 'druidquest', 4);
    H.clearInv(anti);
    H.give(anti, 'coconut');
    H.give(anti, 'hammer');
    A.useHeld(anti, 'hammer', 'coconut');
    check('  a hammer cracks a coconut', H.invCount(anti, 'coconut_half'), 1);
    H.give(anti, 'vial_empty');
    A.useHeld(anti, 'coconut_half', 'vial_empty');
    check('  and a vial takes the milk', H.invCount(anti, 'vial_coconut_milk'), 1);
    H.give(anti, 'irit_leaf');
    A.useHeld(anti, 'irit_leaf', 'vial_coconut_milk');
    check('  irit leaf makes the unfinished antidote++', H.invCount(anti, 'unfinished_antidote++'), 1);
    H.give(anti, 'magic_roots');
    A.useHeld(anti, 'magic_roots', 'unfinished_antidote++');
    check('  magic roots finish it', H.invCount(anti, 'antidote++4'), 1);
    H.give(anti, 'zulrahs_scales', 20);
    A.useHeld(anti, 'zulrahs_scales', 'antidote++4');
    check('  Zulrah scales make anti-venom', H.invCount(anti, 'antivenom4'), 1);
    H.give(anti, 'torstol');
    A.useHeld(anti, 'torstol', 'antivenom4');
    check('  torstol makes anti-venom+', H.invCount(anti, 'antivenom+4'), 1);
    // antidote+ sits in the cache beside antidote++ and has nothing behind it.
    console.log(`  --   antidote+ objs: unfinished ${ObjType.getId('unfinished_antidote+') === -1 ? 'missing' : 'in the cache'}, antidote+4 ${ObjType.getId('antidote+4') === -1 ? 'missing' : 'in the cache'}, recipe ${brews.some(b => nm(b.mix) === 'antidote+4') ? 'exists' : 'NONE'}`);

    // Each antipoison in the line actually clears poison, which is the only reason to make one.
    for (const [obj, what] of [['3doseantipoison', 'antipoison'], ['3dose2antipoison', 'superantipoison'], ['antidote++4', 'antidote++'], ['antivenom4', 'anti-venom'], ['antivenom+4', 'anti-venom+']] as [string, string][]) {
        H.clearInv(anti);
        H.give(anti, obj);
        H.setVar(anti, 'poison', 20);
        A.held(anti, obj, 1);
        H.tick(4);
        check(`  ${what} cures poison`, H.getVar(anti, 'poison') <= 0, true);
    }
    H.despawn(anti);

    // ---- weapon poison: brewing it is half the job, putting it on a weapon is the other half
    console.log('\n== weapon poison ==');
    for (const t of ['weapon_poison', 'weapon_poison+', 'weapon_poison++']) {
        const made = brews.some(b => nm(b.mix) === t);
        console.log(`  ${made ? 'ok  ' : '--  '} ${t.padEnd(16)} obj ${ObjType.getId(t) === -1 ? 'MISSING' : 'in the cache'}, recipe ${made ? 'exists' : 'NONE'}`);
    }

    const poisoner = mkPlayer('herb_poison', 3222, 3218);
    H.setVar(poisoner, 'druidquest', 4);
    H.clearInv(poisoner);
    H.give(poisoner, 'dragon_scale_dust');
    H.give(poisoner, 'kwuarmvial');
    A.useHeld(poisoner, 'dragon_scale_dust', 'kwuarmvial');
    check('  weapon poison can be brewed', H.invCount(poisoner, 'weapon_poison'), 1);

    // One of each shape the applier handles: a dagger and a spear one at a time, and the
    // stackables five at a time.
    const weapons: [string, string, number][] = [
        ['rune_dagger', 'rune_dagger_p', 1],
        ['rune_spear', 'rune_spear_p', 1],
        ['rune_javelin', 'rune_javelin_p', 20],
        ['rune_knife', 'rune_knife_p', 20],
        ['rune_arrow', 'rune_arrow_p', 20],
        ['bolt', 'poison_bolt', 20]
    ];
    for (const [base, poisoned, count] of weapons) {
        H.clearInv(poisoner);
        H.give(poisoner, 'weapon_poison');
        H.give(poisoner, base, count);
        A.useHeld(poisoner, 'weapon_poison', base);
        const got = H.invCount(poisoner, poisoned);
        check(`  ${base} -> ${poisoned}`, got > 0, true);
        if (got > 0) console.log(`         ${got} poisoned, ${H.invCount(poisoner, base)} left, empty vial back: ${H.invCount(poisoner, 'vial_empty')}`);
    }

    // The severity each poisoned weapon carries, and whether the plus tiers are any stronger.
    const sev = ParamType.getId('poison_severity');
    for (const w of ['rune_dagger_p', 'rune_dagger_p+', 'rune_dagger_p++', 'rune_spear_p', 'rune_arrow_p', 'rune_arrow_p+', 'rune_arrow_p++', 'poison_bolt', 'poison_bolt+', 'poison_bolt++']) {
        const id = ObjType.getId(w);
        if (id === -1) { console.log(`  --   ${w}: no such obj`); continue; }
        const t = ObjType.get(id);
        console.log(`  ok   ${w.padEnd(18)} poison_severity ${t.params?.get(sev) ?? 'unset'}, stab bonus ${t.params ? 'params set' : 'no params'}`);
    }
    // Which base weapons have a p+ / p++ to be poisoned into at all.
    const upgraded = ['rune_dagger', 'rune_spear', 'rune_arrow', 'bolt'].map(b => `${b}: p${ObjType.getId(b + '_p') === -1 ? '-' : '+'} p+${ObjType.getId(b + '_p+') === -1 ? '-' : '+'} p++${ObjType.getId(b + '_p++') === -1 ? '-' : '+'}`);
    console.log('  cache has: ' + upgraded.join(' | '));

    // ...and a poisoned weapon has to actually poison. The melee roll is 1/4 and the poison timer
    // only ticks every 30, so a man dies long before the first splat: this fights a fire giant and
    // reads the npc's own %npc_poison rather than waiting for damage.
    const varn = VarNpcType.getByName('npc_poison');
    const giant = H.addNpc('firegiant', 3226, 3222);
    H.clearInv(poisoner);
    H.give(poisoner, 'rune_dagger_p');
    H.equip(poisoner, { rhand: 'rune_dagger_p' });
    const hitsBefore = H.npcHits.length;
    H.attackNpc(poisoner, giant);
    let poisoned = false;
    for (let t = 0; t < 200 && giant.isActive && !poisoned; t++) {
        // Keep the giant on its feet: the poison roll is 1/4 a hit and a maxed player kills a fire
        // giant in a dozen, so without this the check is a coin toss on how the damage rolled.
        giant.levels[3] = giant.baseLevels[3];
        H.tick(1);
        if ((giant.getVar(varn!.id) as number) > 0) poisoned = true;
    }
    const landed = H.npcHits.slice(hitsBefore).filter(h => h.damage > 0).length;
    console.log(`         ${landed} hits landed before the giant ${giant.isActive ? 'was poisoned' : 'died'}`);
    check('  a poisoned dagger poisons what it hits', poisoned, true);
    if (poisoned) {
        // Walk away first: the poison timer is 30 ticks and the player would finish the giant off
        // long before it fires, which says nothing about poison.
        poisoner.clearPendingAction();
        poisoner.teleport(3222, 3218, 0);
        const before = H.npcHits.length;
        for (let t = 0; t < 70 && giant.isActive; t++) H.tick(1);
        check('  and the poison then does damage', H.npcHits.slice(before).some(h => h.type === 2), true);
    }
    H.despawn(brewer, poisoner);
}

console.log(`
${R.ok} ok, ${R.bad} FAIL`);
process.exit(0);
