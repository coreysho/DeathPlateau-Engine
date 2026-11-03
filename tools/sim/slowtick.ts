// The warning the world writes when a tick runs over its 600ms budget, and the throttle on it.
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/slowtick.ts
import * as H from './harness.js';
import World from '#/engine/World.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// catch what the logger prints
const lines: string[] = [];
const realLog = console.log;
console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
};
const warnings = () => lines.filter(l => l.includes('WARN') && l.includes('over the'));

// make a tick take longer than its budget, the way a real overload would: inside the cycle
const realProcessWorld = (World as unknown as { processWorld: () => void }).processWorld;
let stall = 0;
(World as unknown as { processWorld: () => void }).processWorld = function (this: unknown) {
    const until = Date.now() + stall;
    while (Date.now() < until) {
        /* burn the budget */
    }
    return realProcessWorld.call(this);
};

stall = 0;
World.cycle();
const quiet = warnings().length;

stall = 700;
World.cycle();
const first = warnings().length;

// a second overrun straight after is swallowed by the throttle, but still counted
World.cycle();
World.cycle();
const throttled = warnings().length;

// ...and once the throttle window has passed, the next one says how many were swallowed
const WINDOW = (World.constructor as unknown as { SLOW_TICK_WARN_INTERVAL: number }).SLOW_TICK_WARN_INTERVAL;
(World as unknown as { lastSlowTickWarning: number }).lastSlowTickWarning = Date.now() - WINDOW - 1;
World.cycle();
const after = warnings().slice();

stall = 0;
(World as unknown as { processWorld: () => void }).processWorld = realProcessWorld;
console.log = realLog;

check('a tick inside its budget says nothing', quiet, 0);
check('a tick over 600 ms is reported', first, 1);
check('the ones straight after are not repeated', throttled, 1);
check('the throttle window is a sane length (30s)', WINDOW, 30000);
check('once the window passes it reports again', after.length, 2);
check('the repeat says how many went unsaid', /3 slow ticks since the last warning/.test(after[1]), true);
check('the warning carries the breakdown to find the cost', /world \d+ \| in \d+ \| npcs \d+ \| players \d+/.test(after[0]), true);
console.log(`  first warning: ${after[0].replace(/\s+/g, ' ').slice(0, 150)}`);

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
