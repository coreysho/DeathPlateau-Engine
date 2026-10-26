// THE MASTER FARMERS, and the seed table that was never behind them.
//
//   npx tsx tools/sim/masterfarmer.ts
//
// Reported as "master farmer's not coded for pickpocketing". All three carry op3=Pickpocket and
// skill_thieving/scripts/pickpocketing/pickpocket.rs2 has had the triggers for them all along, so
// the click reached ~attempt_pick_pocket, found no row in pickpocket.dbrow, and fell out of the
// bottom with "Nothing interesting happens."
//
// Level 38 Thieving, 43 experience, a five-second stun and three damage on a failure, and a seed
// table of forty-one rows (/w/Master_Farmer). The table is the part worth measuring: it is written
// out of 10000 rather than the 128 every other pocket uses, which is a change to the proc that
// reads it, and a sub-table that came out at the wrong share would be invisible to a reader.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import DbRowType from '#/cache/config/DbRowType.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const FARMERS = ['master_farmer_1', 'master_farmer_2', 'martin_the_master_farmer'];

console.log('ALL THREE ANSWER A PICKPOCKET NOW');
{
    for (const n of FARMERS) {
        const t: any = NpcType.get(NpcType.getId(n));
        check(`  ${n.padEnd(26)} carries Pickpocket`, t.op?.[2], 'Pickpocket');
        const sc = ScriptProvider.getByTrigger(ServerTriggerType.OPNPC3, t.id, t.category);
        check('    and something answers it', !!sc, true);
    }
}

/** Pickpocket a farmer until something lands, and report what. */
function pick(name: string, level = 99, tries = 60) {
    const p: any = player(name, 3200, 3200);
    H.maxOut(p);
    p.setLevel(PlayerStat.THIEVING, level);
    H.clearInv(p);
    const npc = H.addNpcAt('master_farmer_1', p.x + 1, p.z, 0);
    // BOTH LOGS. "You pick the ... pocket" is a chat line; the level refusal is a ~mesbox, which is
    // interface text and never reaches the chat log at all.
    const ifMark = H.ifaces.length;
    const m = A.mark();
    const got = new Map<string, number>();
    for (let i = 0; i < tries; i++) {
        H.opNpc(p, npc, 3);
        H.tick(4);
        const inv = p.getInventory(InvType.INV)!;
        for (let s = 0; s < inv.capacity; s++) {
            const slot = inv.get(s);
            if (slot) got.set(ObjType.get(slot.id).debugname ?? '?', (got.get(ObjType.get(slot.id).debugname ?? '?') ?? 0) + slot.count);
        }
        H.clearInv(p);
        p.levels[PlayerStat.HITPOINTS] = p.baseLevels[PlayerStat.HITPOINTS];
        H.setVar(p, 'stunned', 0);
    }
    const box = H.ifaces
        .slice(ifMark)
        .filter(i => i.who === p.username && i.kind === 'text')
        .map(i => i.text ?? '');
    return { got, said: A.mesSince(p, m).concat(box), p };
}

console.log('\nAND IT PAYS SEEDS');
{
    const r = pick('mf_pick');
    const names = [...r.got.keys()];
    check('  sixty pickpockets give something', names.length > 0, true);
    check(
        '  and all of it is seeds or spores',
        names.filter(n => !/_seed$|_spore$|^mushroom_seed$/.test(n)),
        []
    );
    check(
        '  with the pocket named in the message',
        r.said.some(s => s.includes("master farmer's pocket")),
        true
    );
    H.despawn(r.p);
}

console.log('\n38 THIEVING IS THE DOOR');
{
    const low = pick('mf_low', 37, 2);
    check(
        '  37 is refused, by name and number',
        low.said.some(s => s.includes('level 38 thieving')),
        true
    );
    check('    and gets nothing', [...low.got.keys()], []);
    H.despawn(low.p);
}

console.log('\nTHE TABLE COMES OUT IN THE SHARES THE WIKI STATES');
{
    // Rolled through the reward proc directly rather than through sixty thousand pickpockets: this
    // is the table's own arithmetic, and the walk over a 10000 denominator is the part that is new.
    const p: any = player('mf_table', 3200, 3200);
    H.maxOut(p);
    H.clearInv(p);
    const N = 120000;
    const tally = new Map<string, number>();
    for (let i = 0; i < N; i++) {
        A.runProcProtected(p, '[proc,pick_pocket_check_for_reward]', [DbRowType.getId('pickpocket_master_farmer')]);
        const inv = p.getInventory(InvType.INV)!;
        const slot = inv.get(0);
        tally.set(slot ? (ObjType.get(slot.id).debugname ?? '?') : '(nothing)', (tally.get(slot ? (ObjType.get(slot.id).debugname ?? '?') : '(nothing)') ?? 0) + 1);
        H.clearInv(p);
    }
    const share = (names: string[]) => names.reduce((a, n) => a + (tally.get(n) ?? 0), 0) / N;
    const TABLES: [string, string[], number][] = [
        ['allotments', ['potato_seed', 'onion_seed', 'cabbage_seed', 'tomato_seed', 'sweetcorn_seed', 'strawberry_seed', 'watermelon_seed'], 0.4852],
        ['hops', ['barley_seed', 'hammerstone_hop_seed', 'asgarnian_hop_seed', 'jute_seed', 'yanillian_hop_seed', 'krandorian_hop_seed', 'wildblood_hop_seed'], 0.2431],
        ['flowers', ['marigold_seed', 'nasturtium_seed', 'rosemary_seed', 'woad_seed', 'limpwurt_seed'], 0.122],
        ['bushes', ['redberry_bush_seed', 'cadavaberry_bush_seed', 'dwellberry_bush_seed', 'jangerberry_bush_seed', 'whiteberry_bush_seed'], 0.0971],
        ['special', ['mushroom_seed', 'belladonna_seed', 'cactus_seed'], 0.0049],
        [
            'herbs',
            ['guam_seed', 'marrentill_seed', 'tarromin_seed', 'harralander_seed', 'toadflax_seed', 'ranarr_seed', 'irit_seed', 'avantoe_seed', 'kwuarm_seed', 'snapdragon_seed', 'cadantine_seed', 'lantadyme_seed', 'dwarf_weed_seed', 'torstol_seed'],
            0.0477
        ]
    ];
    for (const [label, names, want] of TABLES) {
        const got = share(names);
        check(`  ${label.padEnd(11)} ${(want * 1000).toFixed(0)}/1000`, Math.abs(got - want) < Math.max(0.006, want * 0.08), true);
        console.log(`      got ${(got * 1000).toFixed(1)}/1000`);
    }
    // THE WHOLE TABLE PAYS OUT. The four seeds this cache has not got keep their weight inside
    // their own sub-table, so a successful pickpocket never comes back empty.
    check('  and a successful pickpocket is never empty-handed', tally.get('(nothing)') ?? 0, 0);
    // ...and the potato is the commonest single row, which is what the report was missing
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    check('  the potato seed is the commonest row', top[0], 'potato_seed');
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
