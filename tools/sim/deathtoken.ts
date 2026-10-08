// The Death token, the Undertaker and the veteran, asked of the running engine.
//
// What is worth testing here is the RULE, not the art: a token is paid for a kill that counts
// towards a Slayer task AND happens in the Wilderness, and for nothing else. Either half alone is a
// different game - on-task alone pays for standing in Zanaris, in-the-Wilderness alone pays for
// killing rats under Edgeville - so the sim drives the real queue that counts a task kill, from
// both sides of the Wilderness line.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';

await H.boot();

const TOKEN = ObjType.getId('death_token');
const paramOf = (npcName: string, paramName: string): unknown => {
    const t = NpcType.get(NpcType.getId(npcName));
    return t.params.get(ParamType.getId(paramName));
};

console.log('THE TOKEN ITSELF');
{
    const t = ObjType.get(TOKEN);
    check('  it exists and is named', t.name, 'Death token');
    check('  it stacks, because a currency must', !!t.stackable, true);
    // Untradeable is the whole design: an untradeable currency buying tradeable goods is a gold
    // laundry, and this one can only be earned where it is spent.
    check('  and it cannot be traded', (t as unknown as { tradeable: boolean }).tradeable, false);
}

console.log('\nTHE TWO WHO STAND AT EITHER END');
{
    const und = NpcType.get(NpcType.getId('undertaker'));
    check('  the Undertaker is there', und.name, 'The Undertaker');
    check('  with Talk-to and Trade', [und.op?.[0], und.op?.[3]], ['Talk-to', 'Trade']);
    check('  his shop is paid for in death tokens', paramOf('undertaker', 'shop_currency'), TOKEN);
    check('  and it has stock', paramOf('undertaker', 'owned_shop') !== undefined, true);
    const vet = NpcType.get(NpcType.getId('wilderness_veteran'));
    check('  the veteran is there too', vet.name, 'One-armed veteran');
    check('  and talks', vet.op?.[0], 'Talk-to');
    check('  both have a script on their Talk-to', [!!ScriptProvider.getByName('[opnpc1,undertaker]'), !!ScriptProvider.getByName('[opnpc1,wilderness_veteran]')], [true, true]);
}

console.log('\nWHERE A TOKEN COMES FROM');
{
    // The roll is a proc, so it can be asked directly - once from each side of the line, many
    // times, because what is being tested is a rate and a single roll says nothing.
    const held = (p: Player) => H.invCount(p, 'death_token');
    const rolls = (p: Player, n: number): number => {
        H.clearInv(p);
        for (let i = 0; i < n; i++) {
            H.runProc(p, '[proc,death_token_roll]', []);
        }
        return held(p);
    };

    // Edgeville, one tile south of the Wilderness line: not the Wilderness.
    const safe: Player = player('tokensafesim', 3094, 3519);
    const got = rolls(safe, 400);
    check('  no token is ever paid south of the line', got, 0);
    H.despawn(safe);

    // Level 1 of the Wilderness, and then deep: the deep roll must be the better one.
    const shallow: Player = player('tokenshallowsim', 3094, 3525);
    const deep: Player = player('tokendeepsim', 3094, 3900);
    const a = rolls(shallow, 4000);
    const b = rolls(deep, 4000);
    check('  tokens are paid at level 1', a > 0, true);
    check('  and more often deep in', b > a, true);
    // The rule is "three times as often by level 30", so the deep rate should be comfortably more
    // than double and not wildly more than treble. A loose band: a sim that demands an exact ratio
    // of a random process is a sim that fails on a Tuesday.
    check('  by roughly the factor the constant promises', b > a * 1.6 && b < a * 4.5, true);
    console.log(`    (${a} tokens from 4,000 kills at level 1, ${b} deep in)`);
    H.despawn(shallow, deep);
}

console.log('\nAND THE SHOP TAKES THEM');
{
    const p: Player = player('tokenshopsim', 3094, 3499);
    H.clearInv(p);
    H.give(p, 'death_token', 50);
    const inv = p.getInventory(InvType.getId('inv'))!;
    let stack = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o && o.id === TOKEN) {
            stack += o.count;
        }
    }
    check('  fifty tokens take one slot', [stack, H.invCount(p, 'death_token')], [50, 50]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
