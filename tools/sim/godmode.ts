// ::godmode, on the real engine.
//
// Hitpoints, prayer and special attack that do not run out, for testing a boss without also
// fighting for survival. Developer (staffModLevel 4) and above, on live too - which is the reason
// it is a cheat in ClientCheatHandler rather than a [debugproc,], since those are owner-only on a
// live world.
//
//   npx tsx tools/sim/godmode.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

await H.boot();

const v = (p: any, n: string) => p.getVar(VarPlayerType.getByName(n)!.id);
const hp = (p: any) => p.levels[3];
const prayer = (p: any) => p.levels[5];
const cheat = (p: any, text: string) => new ClientCheatHandler().handle(new ClientCheat(text), p);

// ---------------------------------------------------------------- who can run it
console.log('DEVELOPER AND ABOVE');
{
    const p: any = player('nobody', 3200, 3200);
    H.maxOut(p);
    for (const level of [0, 1, 2, 3]) {
        p.staffModLevel = level;
        cheat(p, 'godmode');
        // an untouched temp varp reads -1, not 0; what matters is that it is not ON
        check(`  staffModLevel ${level} cannot`, v(p, 'godmode') === 1, false);
    }
    p.staffModLevel = 4;
    cheat(p, 'godmode');
    check('  staffModLevel 4 (developer) can', v(p, 'godmode'), 1);
    H.despawn(p);
}

// ---------------------------------------------------------------- what it does
console.log('\nWHAT IT HOLDS UP');
{
    const p: any = player('dev', 3200, 3200);
    H.maxOut(p);
    p.staffModLevel = 4;
    const maxhp = p.baseLevels[3];

    cheat(p, 'godmode');
    check('  it says so', A.lastMes(p).startsWith('Godmode on'), true);

    // hitpoints: the hit lands and the splat shows, and the tick after it you are whole again.
    A.runProcProtected(p, '[proc,damage_self]', [maxhp - 5]);
    check('  a hit still lands', hp(p) < maxhp, true);
    H.tick(2);
    check('  and is gone by the next tick', hp(p), maxhp);

    // prayer
    p.levels[5] = 1;
    H.tick(2);
    check('  prayer comes back too', prayer(p), p.baseLevels[5]);

    // special attack
    A.runProcProtected(p, '[proc,set_sa_vars]', [500]);
    check('  a special still spends the bar', v(p, 'sa_energy') < 1000, true);
    H.tick(2);
    check('  and the bar is full again', v(p, 'sa_energy'), 1000);

    // AND THE THING IT IS FOR: a hit that would kill does not.
    A.runProcProtected(p, '[proc,damage_self]', [maxhp + 50]);
    H.tick(2);
    check('  a killing blow does not kill', [hp(p), v(p, 'death')], [maxhp, 0]);
    H.despawn(p);
}

// ---------------------------------------------------------------- and off again
console.log('\nAND OFF AGAIN');
{
    const p: any = player('dev2', 3200, 3200);
    H.maxOut(p);
    p.staffModLevel = 4;
    const maxhp = p.baseLevels[3];

    cheat(p, 'godmode');
    cheat(p, 'godmode');
    check('  the second one turns it off', [v(p, 'godmode'), A.lastMes(p)], [0, 'Godmode off. You can die again.']);

    p.levels[3] = 10;
    H.tick(3);
    check('  and nothing is topped up any more', hp(p), 10);
    check('  the timer is gone, not just idling', (p as any).softTimerInterval ?? 0, 0);

    // dying works again
    A.runProcProtected(p, '[proc,damage_self]', [50]);
    H.tick(2);
    check('  you can die again', hp(p) === maxhp, false);
    H.despawn(p);
}

// ---------------------------------------------------------------- it does not outlive the session
console.log('\nIT DOES NOT SURVIVE A LOGOUT');
{
    const t = VarPlayerType.getByName('godmode')!;
    // scope=temp, so it is never written to the save file - a testing switch nobody can forget
    // they left on. "perm" here would mean an unkillable account after a restart.
    check('  the varp is temp', t.scope, VarPlayerType.SCOPE_TEMP);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
