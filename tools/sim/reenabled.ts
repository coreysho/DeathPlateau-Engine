// Code that sat commented out behind "TODO 377: re-enable ..." notes until what it waited on was
// ported, now switched back on:
//   specwep.rs2   - the Dragon battleaxe's, Dragon axe's, Excalibur's and Dragon pickaxe's instant
//                   specials check the duel's "no special attacks" rule (duel_arena_spec_check)
//   charge.rs2    - Charge cannot be recast within a minute
//   tier1.rs2     - the bronze dagger, axe and pickaxe go through tutorial_island_equip again, so a
//                   player on Tutorial Island cannot wield them before Vannaka's lesson
//   upass_journal - the finished Underground Pass journal says what Regicide has done
//   survival_guide - the Survival Expert's recap mentions the skill guides, which exist now
// and npc_combat.rs2's wormbrain check (live all along) no longer says "already in prison" twice.
import * as H from './harness.ts';
import World from '#/engine/World.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
let n = 0;
function player(x: number, z: number) {
    const p: any = H.makePlayer('re' + n++, x, z, 90 + n);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const mesOf = (p: any, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const textOf = (p: any, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!).join(' ');
const worn = (p: any, pos: number) => {
    const o = p.getInventory(InvType.WORN)!.get(pos);
    return o ? ObjType.get(o.id).debugname : null;
};

/** Click through whatever dialogue is open, as a player pressing "Click here to continue" would. */
function settle(p: any, max = 60) {
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.delayed) break;
    }
}

console.log('SPECIAL ATTACK BAR IN A "NO SPECIAL ATTACKS" DUEL');
const ARENA = { x: 3343, z: 3250 }; // 0_52_50_15_50, inside duel_arena_fight_zones
const LUMBRIDGE = { x: 3222, z: 3218 };
const NO_SPECS = 13; // duelarena.constant ^no_specs
function spec(weapon: string, button: string, at: { x: number; z: number }, noSpecs: boolean) {
    // log in outside and walk in: a login inside the arena is put out of it (logout.rs2)
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    p.teleport(at.x, at.z, 0);
    H.tick(2);
    H.equip(p, { rhand: weapon });
    H.setVar(p, 'sa_energy', 1000);
    H.setVar(p, 'dueloptions', noSpecs ? 1 << NO_SPECS : 0);
    const m0 = H.mesgs.length, s0 = H.says.length;
    H.ifButton(p, button);
    H.tick(2);
    const r = { mes: mesOf(p, m0), said: H.says.slice(s0).filter(s => s.who === p.username).map(s => s.text), energy: H.getVar(p, 'sa_energy') };
    H.despawn(p);
    return r;
}
const OFF = 'Use of special attacks has been turned off for this duel.';
{
    const r = spec('dragon_battleaxe', 'combat_axe:specbar', ARENA, true);
    check('Dragon battleaxe, no-specs duel: refused, energy kept', [r.mes, r.said, r.energy], [[OFF], [], 1000]);
    const r2 = spec('dragon_battleaxe', 'combat_axe:specbar', ARENA, false);
    check('  the same duel with specials allowed: Rampage', [r2.said, r2.energy < 1000], [['Raarrrrrgggggghhhhhhh!'], true]);
    const r3 = spec('dragon_battleaxe', 'combat_axe:specbar', LUMBRIDGE, true);
    check('  outside the arena the duel option means nothing: Rampage', [r3.said, r3.energy < 1000], [['Raarrrrrgggggghhhhhhh!'], true]);
}
{
    const r = spec('excalibur', 'combat_hacksword:specbar', ARENA, true);
    check('Excalibur, no-specs duel: refused, energy kept', [r.mes, r.said, r.energy], [[OFF], [], 1000]);
    const r2 = spec('excalibur', 'combat_hacksword:specbar', ARENA, false);
    check('  specials allowed: Sanctuary', [r2.said, r2.energy < 1000], [['For Camelot!'], true]);
}
{
    const r = spec('dragon_axe', 'combat_axe:specbar', ARENA, true);
    check('Dragon axe (same button), no-specs duel: refused', [r.mes, r.said, r.energy], [[OFF], [], 1000]);
}
{
    const r = spec('dragon_pickaxe', 'combat_pickaxe:specbar', ARENA, true);
    check('Dragon pickaxe, no-specs duel: refused, energy kept', [r.mes, r.said, r.energy], [[OFF], [], 1000]);
    const r2 = spec('dragon_pickaxe', 'combat_pickaxe:specbar', ARENA, false);
    check('  specials allowed: Rock Knocker', [r2.said, r2.energy < 1000], [['Smashing!'], true]);
}

console.log('CHARGE: ONCE A MINUTE');
{
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    H.setVar(p, 'magearena', 8); // ^mage_arena_staff_given
    H.give(p, 'firerune', 100);
    H.give(p, 'bloodrune', 100);
    H.give(p, 'airrune', 100);
    const cast = () => {
        const m0 = H.mesgs.length;
        H.ifButton(p, 'magic:charge');
        H.tick(1);
        return mesOf(p, m0);
    };
    const CHARGED = 'You feel charged with magic power.', TOO_STRONG = "You can't recast that yet, your current Charge is too strong.";
    check('first cast', cast(), [CHARGED]);
    check('  again at once: refused, no runes spent', [cast(), H.invCount(p, 'bloodrune')], [[TOO_STRONG], 97]);
    H.tick(96); // 98 ticks after the cast
    check('  98 ticks on: still refused', cast(), [TOO_STRONG]);
    H.tick(2);
    check('  a minute (100 ticks) on: casts again', [cast(), H.invCount(p, 'bloodrune')], [[CHARGED], 94]);
    H.despawn(p);
}

console.log('TUTORIAL ISLAND: WIELDING BEFORE THE COMBAT INSTRUCTOR');
const WORN_INVENTORY = 380, DAGGER_EQUIPPED = 390, COMPLETE = 1000; // tutorial.constant, quest.constant
for (const obj of ['bronze_dagger', 'bronze_axe', 'bronze_pickaxe']) {
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    H.setVar(p, 'tutorial', 100);
    H.give(p, obj);
    const i0 = H.ifaces.length;
    H.opheld(p, obj, 2);
    H.tick(1);
    check(`${obj} before the lesson: "told later", not wielded`, [textOf(p, i0).includes("You'll be told how to equip items later."), worn(p, 3), H.invCount(p, obj)], [true, null, 1]);
    H.despawn(p);
}
{
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    H.setVar(p, 'tutorial', WORN_INVENTORY);
    H.give(p, 'bronze_dagger');
    H.opheld(p, 'bronze_dagger', 2);
    H.tick(1);
    check('at the wielding lesson: the dagger goes on and the tutorial moves on', [worn(p, 3), H.getVar(p, 'tutorial')], ['bronze_dagger', DAGGER_EQUIPPED]);
    H.despawn(p);
}
for (const obj of ['bronze_dagger', 'bronze_axe', 'bronze_pickaxe']) {
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    H.setVar(p, 'tutorial', COMPLETE);
    H.give(p, obj);
    H.opheld(p, obj, 2);
    H.tick(1);
    check(`${obj} after the tutorial: wielded as ever`, [worn(p, 3), H.getVar(p, 'tutorial')], [obj, COMPLETE]);
    H.despawn(p);
}

console.log('UNDERGROUND PASS JOURNAL, AFTER THE QUEST');
for (const [st, want] of [[0, "services to stop Tyras."], [1, 'He has sent a messenger to summon me to stop Tyras.']] as const) {
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    H.setVar(p, 'upass', 10);
    H.setVar(p, 'regicide_quest', st);
    const i0 = H.ifaces.length;
    H.ifButton(p, 'questlist:upass');
    H.tick(1);
    const t = textOf(p, i0);
    check(`Regicide at ${st}: "${want}"`, [t.includes(want), t.includes(st === 0 ? 'messenger' : 'when the well is working')], [true, false]);
    H.despawn(p);
}

console.log('SURVIVAL EXPERT RECAP: STATS');
{
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    const expert = H.addNpc('newbie_survival_instructor', LUMBRIDGE.x + 1, LUMBRIDGE.z);
    const i0 = H.ifaces.length;
    p.executeScript(ScriptRunner.init(ScriptProvider.getByName('[proc,survival_recap_skills]')!, p, expert), true);
    settle(p);
    check('mentions the skill guides', textOf(p, i0).includes('You can also click on a skill to open the relevant skillguide.'), true);
    H.despawn(p);
}

console.log('WORMBRAIN');
function hitWormbrain(dq: number, mappart: boolean) {
    const p = player(LUMBRIDGE.x, LUMBRIDGE.z);
    H.setVar(p, 'dragonquest', dq);
    if (mappart) H.give(p, 'mappart2');
    const npc = H.addNpc('wormbrain', LUMBRIDGE.x + 2, LUMBRIDGE.z);
    const m0 = H.mesgs.length;
    H.attackNpc(p, npc);
    H.tick(4);
    const r = mesOf(p, m0);
    H.despawn(p);
    return r;
}
check('not on the map yet: told once, not twice', hitWormbrain(0, false), ['The goblin is already in prison. You have no reason to attack him.']);
check('already has his piece: the piece message only', hitWormbrain(3, true), ["You have already taken Wormbrain's map piece. There is no use in beating him up", 'further.']);
void World;

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
