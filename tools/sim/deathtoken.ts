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
import World from '#/engine/World.js';

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

console.log('\nTHE OUTFIT: STATUS, NOT POWER');
{
    // Corey's rule, 12 October: the shelf sells status and never power - nothing that changes a
    // combat number, nothing that can be pointed at another player. A rule nothing checks is a rule
    // that lasts until the next tired evening, so this walks the pieces and reads their params.
    const PIECES = ['undertaker_hat', 'undertaker_coat', 'undertaker_trousers',
                    'undertaker_boots', 'undertaker_cane'];
    const COMBAT = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack',
                    'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence',
                    'strengthbonus', 'rangedbonus', 'magicdamage', 'prayerbonus'];
    const armed: string[] = [];
    const sellable: string[] = [];
    const keepable: string[] = [];
    for (const name of PIECES) {
        const t = ObjType.get(ObjType.getId(name));
        for (const pname of COMBAT) {
            const pid = ParamType.getId(pname);
            if (pid !== -1 && t.params.get(pid)) {
                armed.push(`${name}.${pname}`);
            }
        }
        if ((t as unknown as { tradeable: boolean }).tradeable) {
            sellable.push(name);
        }
        // destroy_death does NOT destroy anything - it means "not eligible to be one of the items
        // you keep". It is what stops Protect Item saving a piece and making the stake conditional.
        if (!t.params.get(ParamType.getId('destroy_death'))) {
            keepable.push(name);
        }
    }
    check('  all five pieces exist', PIECES.every(n => ObjType.getId(n) !== -1), true);
    check('  and not one carries a combat bonus', armed, []);
    check('  none of them can be traded', sellable, []);
    check('  and none can be kept on death or saved by Protect Item', keepable, []);
}

console.log('\nTHE BOUNTY CANNOT PRINT TOKENS');
{
    // THE invariant. Tokens are untradeable, so paying a killer is the only route one can take from
    // one account to another; the piece is destroyed when it pays, so a boosting pair spends the
    // shop price to collect the bounty. Strictly below cost, that loses them tokens. At or above it,
    // the same pair prints them for free. Swept over the WHOLE obj table, not just today's five.
    const bountyParam = ParamType.getId('pvp_token_bounty');
    check('  the param exists', bountyParam !== -1, true);
    const carriers: string[] = [];
    const broken: string[] = [];
    for (let id = 0; id < ObjType.count; id++) {
        const t = ObjType.get(id);
        const bounty = t.params.get(bountyParam) as number | undefined;
        if (!bounty) {
            continue;
        }
        carriers.push(t.debugname ?? String(id));
        if (bounty >= t.cost) {
            broken.push(`${t.debugname}: ${bounty} >= ${t.cost}`);
        }
    }
    check('  every item that pays a bounty pays LESS than it costs', broken, []);
    console.log(`    (${carriers.length} items carry one: ${carriers.join(', ')})`);
}

// H.invCount reads the BACKPACK, and a worn hat is never in it - so "it is gone" asserted with
// invCount is an assertion that was already true before the proc ran. The first run of this file
// passed that check against a hat it had not touched. Count the slot the thing is actually in.
const wornCount = (p: Player, objName: string): number => {
    const id = ObjType.getId(objName);
    const worn = p.getInventory(InvType.getId('worn'))!;
    let n = 0;
    for (let i = 0; i < worn.capacity; i++) {
        const slot = worn.get(i);
        if (slot && slot.id === id) {
            n += slot.count;
        }
    }
    return n;
};

console.log('\nAND THE OUTFIT IS LOST WHERE IT IS WORN');
{
    const WORN = InvType.getId('worn');
    const hat = ObjType.getId('undertaker_hat');
    const bounty = ObjType.get(hat).params.get(ParamType.getId('pvp_token_bounty')) as number;

    // Deep in the Wilderness, with somebody standing over the body.
    const victim: Player = player('tokenvictimsim', 3094, 3700);
    const killer: Player = player('tokenkillersim', 3095, 3700);
    H.equip(victim, { hat: 'undertaker_hat' });
    check('  the hat is on his head to begin with', wornCount(victim, 'undertaker_hat'), 1);
    const owed = H.runProc(victim, '[proc,undertaker_outfit_destroy]', [WORN])[0];
    check('  and is destroyed north of the line', wornCount(victim, 'undertaker_hat'), 0);
    check('  and it reports exactly what it destroyed', owed, bounty);

    H.runProc(victim, '[proc,undertaker_outfit_pay]', [killer.uid, owed], killer);
    const paid = World.getObj(victim.x, victim.z, victim.level, TOKEN, killer.hash64);
    check('  the tokens land in the pile, flagged to the killer', paid?.count ?? 0, bounty);
    // The whole exploit defence in one line: what the killer gains is less than what the victim
    // must spend to put the hat back on.
    check('  and are worth less than the hat cost', (paid?.count ?? 0) < ObjType.get(hat).cost, true);
    H.despawn(victim, killer);
}

{
    // South of the line it is just a hat.
    const WORN = InvType.getId('worn');
    const safe: Player = player('tokensafehatsim', 3094, 3519);
    H.equip(safe, { hat: 'undertaker_hat' });
    const owed = H.runProc(safe, '[proc,undertaker_outfit_destroy]', [WORN])[0];
    check('  nothing is destroyed south of it', [wornCount(safe, 'undertaker_hat'), owed], [1, 0]);
    H.despawn(safe);
}

console.log('\nAND THE SHELF SELLS THEM');
{
    const shop = InvType.getId('death_token_shop');
    const stocked: string[] = [];
    for (let i = 0; i < 8; i++) {
        const o = World.getInventory(shop)?.get(i);
        if (o) {
            stocked.push(ObjType.get(o.id).debugname ?? String(o.id));
        }
    }
    for (const want of ['slayer_imbue_scroll', 'undertaker_hat', 'undertaker_coat',
                        'undertaker_trousers', 'undertaker_boots', 'undertaker_cane']) {
        check(`  ${want}`, stocked.includes(want), true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
