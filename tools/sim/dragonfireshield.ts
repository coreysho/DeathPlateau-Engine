// The dragonfire shield, asked of the running engine.
//
// Worth a sim rather than a look, because this change reached into ELEVEN combat call sites. The
// risk was never the shield; it was that a dragon somewhere still asks for the anti-dragon shield
// BY NAME and quietly burns anybody wearing this one. So the first group walks the whole obj table
// and the whole script tree rather than testing the three items I happen to remember.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import fs from 'fs';
import path from 'path';

await H.boot();

const SRC = path.join(process.cwd(), '..', 'content', 'scripts');
// H.runProc runs a script UNPROTECTED, and a varp write needs protected access - the same
// rule the compiler enforces on content. opheld() gets it by passing true to
// executeScript, so anything here that writes %dfs_charges goes through this instead.
const runProtected = (p: Player, name: string, args: unknown[] = []): void => {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p, null, args as never[]), true);
};

const charges = (p: Player): number =>
    p.getVar(VarPlayerType.getByName('dfs_charges')!.id) as number;
const wornShield = (p: Player): string =>
    ObjType.get(p.getInventory(InvType.WORN)!.get(5)!.id).debugname!;
const param = (objName: string, paramName: string): unknown =>
    ObjType.get(ObjType.getId(objName)).params?.get(ParamType.getId(paramName));

console.log('NOTHING STILL ASKS FOR THE SHIELD BY NAME');
{
    // Every .rs2 under content, read off disk: a dragonfire test that names the item is the bug
    // this whole change exists to prevent, and it must not come back in a file I did not think of.
    //
    // TWO FILES ARE ALLOWED TO NAME IT, and the difference is the point. Dragon Slayer asks
    // whether you OWN an anti-dragon shield - the Duke will not hand you a second one, and the
    // journal tells you to go and get one. That is a question about a particular item, not about
    // whether dragonfire will hurt you, and a dragonfire shield is not an answer to it.
    const OWNERSHIP = ['duke_horacio.rs2', 'dragon_journal.rs2'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (e.name.endsWith('.rs2')) {
                const text = fs.readFileSync(p, 'utf8');
                for (const line of text.split('\n')) {
                    if (line.includes('inv_total(worn, antidragonbreathshield)') && !OWNERSHIP.includes(e.name)) {
                        offenders.push(path.relative(SRC, p) + ': ' + line.trim());
                    }
                }
            }
        }
    };
    walk(SRC);
    check('  no dragonfire test names antidragonbreathshield', offenders, []);
    if (offenders.length) {
        for (const o of offenders) console.log('    ' + o);
    }
}

console.log('\nTHE PARAM IS ON EVERYTHING THAT SHOULD CARRY IT');
{
    const carries = H.objNamesByParam('antidragon').sort();
    check('  exactly the three shields', carries,
        ['antidragonbreathshield', 'dragonfire_shield', 'dragonfire_shield_uncharged'].sort());
}

console.log('\nAND THE PROC AGREES WITH THE PARAM');
{
    const p: Player = player('dfsprotsim', 3200, 3200);
    const protectedBy = (shield: string | null): boolean => {
        H.clearInv(p);
        if (shield) {
            H.equip(p, { lhand: shield });
        } else {
            H.equip(p, {});
        }
        return H.runProc(p, '[proc,has_antidragon_shield]', [])[0] === 1;
    };
    check('  bare hands are not protected', protectedBy(null), false);
    check('  the anti-dragon shield is', protectedBy('antidragonbreathshield'), true);
    check('  the uncharged dragonfire shield is', protectedBy('dragonfire_shield_uncharged'), true);
    check('  and the charged one is', protectedBy('dragonfire_shield'), true);
    // a shield that is not an anti-dragon shield must not suddenly become one
    check('  a rune kiteshield is not', protectedBy('rune_kiteshield'), false);
    H.despawn(p);
}

console.log('\nSTATS ARE OLD SCHOOL\'S');
{
    check('  defence 20/25/22 melee, 10 magic, 22 ranged',
        ['stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence']
            .map(k => param('dragonfire_shield', k)),
        [20, 25, 22, 10, 22]);
    check('  attack -10 magic, -5 ranged',
        [param('dragonfire_shield', 'magicattack'), param('dragonfire_shield', 'rangeattack')], [-10, -5]);
    check('  strength +7', param('dragonfire_shield', 'strengthbonus'), 7);
    check('  uncharged carries the same base', param('dragonfire_shield_uncharged', 'slashdefence'), 25);
    check('  the charged one cannot be traded',
        (ObjType.get(ObjType.getId('dragonfire_shield')) as unknown as { tradeable: boolean }).tradeable, false);
    check('  and the uncharged one can',
        (ObjType.get(ObjType.getId('dragonfire_shield_uncharged')) as unknown as { tradeable: boolean }).tradeable, true);
    check('  the visage is worth what Old School says', ObjType.get(ObjType.getId('draconic_visage')).cost, 750000);
}

console.log('\nCHARGES ARE WORTH +1 DEFENCE EACH');
{
    const p: Player = player('dfschargesim', 3200, 3200);
    H.equip(p, { lhand: 'dragonfire_shield' });
    const slashAt = (charges: number): number => {
        H.setVar(p, 'dfs_charges', charges);
        return H.runProc(p, '[proc,equip_get_bonuses]', [])[6];   // slashdefence
    };
    check('  empty, the shield is its base 25', slashAt(0), 25);
    check('  one charge is 26', slashAt(1), 26);
    check('  fifty charges is 75, which is the number the wiki prints', slashAt(50), 75);
    // "up to a maximum of 50" - a varp that somehow went past it must not pay out past it either
    check('  and it is capped there', slashAt(80), 75);
    H.despawn(p);
}

console.log('\nABSORBING A BREATH CHARGES IT');
{
    const p: Player = player('dfsabsorbsim', 3200, 3200);
    H.setVar(p, 'dfs_charges', 0);
    H.equip(p, { lhand: 'dragonfire_shield_uncharged' });
    runProtected(p, '[proc,dfs_absorb]');
    check('  the first breath swaps the tradeable shield for the charged one',
        wornShield(p), 'dragonfire_shield');
    check('  and leaves one charge on it', charges(p), 1);
    for (let i = 0; i < 60; i++) {
        runProtected(p, '[proc,dfs_absorb]');
    }
    check('  sixty more breaths stop at fifty', charges(p), 50);
    H.despawn(p);
}

console.log('\nAND EMPTYING GIVES THE TRADEABLE ONE BACK');
{
    const p: Player = player('dfsemptysim', 3200, 3200);
    H.equip(p, { lhand: 'dragonfire_shield' });
    H.setVar(p, 'dfs_charges', 30);
    runProtected(p, '[label,wearop2_dragonfire_shield]');
    check('  no charges left', charges(p), 0);
    check('  and the shield is tradeable again',
        wornShield(p), 'dragonfire_shield_uncharged');
    H.despawn(p);
}

console.log('\nTHE PIECES THE ACTIVATE IS BUILT FROM EXIST');
{
    for (const s of ['[label,wearop1_dragonfire_shield]', '[proc,dfs_find_target]', '[proc,dfs_fire]',
                     '[label,dfs_smith_at_anvil]', '[label,oziach_dragonfire_shield]']) {
        check('  ' + s, !!ScriptProvider.getByName(s), true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
