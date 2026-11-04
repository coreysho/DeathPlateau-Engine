// Reading an input capture back, and whether what it says separates a hand from a script.
//
// WHY THIS IS THE TEST THAT MATTERS. A decoder that produces plausible numbers from anything is
// worse than none: it would let somebody be accused on arithmetic that never discriminated. So
// this does not check the statistics against expected constants. It ENCODES two sessions in the
// client's own format - one a hand, one an autoclicker - decodes them through the real decoder, and
// insists the numbers tell them apart, in the direction claimed.
//
// The encoder below is deliberately a second implementation, written from Client.java rather than
// from InputReport.ts, so a mistake shared by both would have to be made twice.
//
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/inputreport.ts
import { analyseInput, decodeInputReport } from '#/engine/entity/tracking/InputReport.js';

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// ---------------------------------------------------------------- the client's side, by hand

class Writer {
    bytes: number[] = [];
    p1(v: number) {
        this.bytes.push(v & 0xff);
    }
    p2(v: number) {
        this.bytes.push((v >>> 8) & 0xff, v & 0xff);
    }
    p3(v: number) {
        this.bytes.push((v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    }
    p4(v: number) {
        this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    }
}

/** A click, as Client.java packs one: (button << 19) + (elapsed/50 << 20) + (y * 765 + x). */
function click(w: Writer, x: number, y: number, right: boolean, sinceMs: number) {
    const elapsed = Math.min(4095, Math.floor(sinceMs / 50));
    w.p1(3);
    // not p4 with a shift: elapsed << 20 passes 2^31 and javascript's << is signed
    w.p4(((right ? 1 : 0) * 0x80000 + elapsed * 0x100000 + (y * 765 + x)) >>> 0);
}

/**
 * A run of cursor samples, as the client writes them: one record per sample where the position
 * changed, carrying the count of still samples before it. Only the two-byte form is produced here
 * when the step is small, which is what a real path mostly is.
 */
function cursor(w: Writer, path: { x: number; y: number; still: number }[]) {
    const body = new Writer();
    let lastX = -1;
    let lastY = -1;

    for (const step of path) {
        const dx = step.x - lastX;
        const dy = step.y - lastY;
        if (lastX >= 0 && step.still < 8 && dx >= -32 && dx <= 31 && dy >= -32 && dy <= 31) {
            body.p2((step.still << 12) + ((dx + 32) << 6) + (dy + 32));
        } else if (step.still < 8) {
            body.p3(0x800000 + (step.still << 19) + (step.y * 765 + step.x));
        } else {
            body.p4((0xc0000000 + (step.still << 19) + (step.y * 765 + step.x)) >>> 0);
        }
        lastX = step.x;
        lastY = step.y;
    }

    w.p1(4);
    w.p1(body.bytes.length);
    w.bytes.push(...body.bytes);
}

// ---------------------------------------------------------------- the frame, read back

const frame = new Writer();
frame.p1(1);
frame.p2(300);
frame.p2(1800); // camera
frame.p1(2);
frame.p1(0); // focus lost
click(frame, 400, 250, false, 1500);
cursor(frame, [
    { x: 100, y: 100, still: 0 },
    { x: 104, y: 103, still: 0 },
    { x: 108, y: 109, still: 2 }
]);

const read = decodeInputReport(new Uint8Array(frame.bytes));
check('every event in the frame came back', read.length, 6);
check('the camera is read the way it was written', read[0], { kind: 'camera', pitch: 300, yaw: 1800 });
check('focus lost is not focus gained', read[1], { kind: 'focus', gained: false });
check('a click keeps its place, its button and its gap', read[2], { kind: 'click', x: 400, y: 250, right: false, sinceLastMs: 1500 });
check('the first cursor sample is an absolute position', read[3], { kind: 'cursor', x: 100, y: 100, stillMs: 0, offScreen: false });
check('the next is the delta applied to it', read[4], { kind: 'cursor', x: 104, y: 103, stillMs: 0, offScreen: false });
check('and a still stretch is read as time, not as samples', read[5], { kind: 'cursor', x: 108, y: 109, stillMs: 100, offScreen: false });

// a right click, and a gap past the 4095-unit cap, which is where the signed read bites
const edge = new Writer();
click(edge, 764, 502, true, 999999);
const edgeRead = decodeInputReport(new Uint8Array(edge.bytes)) as Extract<ReturnType<typeof decodeInputReport>[number], { kind: 'click' }>[];
check('the far corner of the window survives the round trip', [edgeRead[0].x, edgeRead[0].y], [764, 502]);
check('a right click is read as one', edgeRead[0].right, true);
check('a gap past the cap comes back positive, not negative', edgeRead[0].sinceLastMs, 4095 * 50);

// off the window
const away = new Writer();
cursor(away, [{ x: 764, y: 685, still: 0 }]); // 685 * 765 + 764 = 524284... close to the sentinel
const offFrame = new Writer();
offFrame.p1(4);
offFrame.p1(3);
offFrame.p3(0x800000 + 524287);
check('the cursor leaving the window is marked, not read as a place', (decodeInputReport(new Uint8Array(offFrame.bytes))[0] as { offScreen: boolean }).offScreen, true);
void away;

// a row cut off mid-record keeps what it had
const cut = new Uint8Array(frame.bytes.slice(0, 8));
check('a truncated row returns what it could read rather than throwing', decodeInputReport(cut).length >= 1, true);

// ---------------------------------------------------------------- a hand against a script

function hand(): Uint8Array {
    const w = new Writer();
    let x = 300;
    let y = 200;
    let seed = 7;
    const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };

    for (let i = 0; i < 40; i++) {
        // the cursor wanders towards the next target, then clicks near but not on the same pixel
        const path: { x: number; y: number; still: number }[] = [];
        for (let step = 0; step < 6; step++) {
            x += Math.floor(rnd() * 20) - 10;
            y += Math.floor(rnd() * 20) - 10;
            x = Math.max(1, Math.min(760, x));
            y = Math.max(1, Math.min(498, y));
            path.push({ x, y, still: Math.floor(rnd() * 2) });
        }
        cursor(w, path);
        // a human's gaps are broad and never the same number twice running
        click(w, x, y, false, 600 + Math.floor(rnd() * 2400));
    }
    return new Uint8Array(w.bytes);
}

function autoclicker(): Uint8Array {
    const w = new Writer();
    for (let i = 0; i < 40; i++) {
        // the cursor is parked: the client still samples it, and every sample is "did not move"
        cursor(w, [{ x: 412, y: 318, still: 7 }]);
        // and the clicks are a fixed sleep on one pixel
        click(w, 412, 318, false, 1200);
    }
    return new Uint8Array(w.bytes);
}

const human = analyseInput(decodeInputReport(hand()));
const bot = analyseInput(decodeInputReport(autoclicker()));

console.log('\n                     hand      script');
const line = (name: string, a: number, b: number) => console.log(`  ${name.padEnd(18)} ${a.toFixed(3).padStart(7)} ${b.toFixed(3).padStart(10)}`);
line('still share', human.stillShare, bot.stillShare);
line('click spread', human.clickSpread, bot.clickSpread);
line('top pixel share', human.topPixelShare, bot.topPixelShare);
line('gap variation', human.gapVariation, bot.gapVariation);
line('top gap share', human.topGapShare, bot.topGapShare);
console.log();

check('the script clicks one pixel and the hand does not', [bot.topPixelShare, human.topPixelShare < 0.3], [1, true]);
check('the hand spreads its clicks around', human.clickSpread > 0.5, true);
check("...and the script's spread collapses", bot.clickSpread < 0.1, true);
check('every one of the script\'s gaps is the same number', bot.topGapShare, 1);
check("...and the hand's hardly repeat", human.topGapShare < 0.2, true);
check('the gaps of a hand vary and a script\'s do not at all', [bot.gapVariation, human.gapVariation > 0.2], [0, true]);
check('the parked cursor is still most of the time', bot.stillShare > 0.8, true);
check('...and a moving one is not', human.stillShare < 0.5, true);

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
