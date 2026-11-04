/**
 * Reading back what InputTracking wrote, and what it says about who was playing.
 *
 * THE DECODER LIVES BESIDE THE ENCODER on purpose. InputTracking.ts frames these events and the
 * 377 client encodes their payloads; this undoes both. Two files in one directory so a change to
 * the format is visible next to the thing that has to follow it - input_report rows written by one
 * version and read by another is a silent wrong answer, not a crash.
 *
 * THE OUTER FRAME, from InputTracking:
 *
 *   1  camera   p1 type, p2 pitch, p2 yaw
 *   2  focus    p1 type, p1 gained
 *   3  click    p1 type, p4 info
 *   4  cursor   p1 type, p1 length, then that many bytes of the client's own encoding
 *
 * A CLICK'S info, from Client.java: (button << 19) + (elapsed << 20) + (y * 765 + x). Nineteen
 * bits of position, one of button, twelve of elapsed in units of 50ms capped at 4095. Written with
 * p4, which is signed, and elapsed alone reaches 4095 << 20 - past 2^31 - so it has to be read
 * back unsigned or a slow click comes out negative.
 *
 * THE CURSOR STREAM is the interesting one. MouseTracking samples the cursor every 50ms into a
 * 500-slot buffer; the client ships a batch once 40 have piled up, and writes ONE RECORD PER SAMPLE
 * WHERE THE POSITION CHANGED, each carrying a count of the samples before it where it did not. So
 * the stream is a path in 50ms steps with the still stretches run-length encoded, and the three
 * record shapes are told apart by the top bits of the first byte:
 *
 *   0xxxxxxx  2 bytes   still << 12 | (dx + 32) << 6 | (dy + 32)      a small step
 *   10xxxxxx  3 bytes   0x800000 | still << 19 | position             a jump, still < 8
 *   11xxxxxx  4 bytes   0xC0000000 | still << 19 | position           a jump, still up to 2047
 *
 * position is y * 765 + x, and 524287 means the cursor left the window.
 *
 * WHAT THE NUMBERS CAN AND CANNOT SAY. The counts in session_input tell you whether a client was
 * running at all, because a real one reports about 30 packets a minute whatever the player does -
 * field99 counts samples, not movements. They cannot tell a parked cursor from a moving one. THIS
 * can: an autoclicker leaves the cursor still between clicks and hits the same pixel every time,
 * and a hand never does either. None of it is proof. It is evidence for a person to weigh.
 */

/** One thing the client reported. */
export type InputEvent =
    | { kind: 'camera'; pitch: number; yaw: number }
    | { kind: 'focus'; gained: boolean }
    | { kind: 'click'; x: number; y: number; right: boolean; sinceLastMs: number }
    /** One cursor sample. stillMs is how long it had not moved before this one. */
    | { kind: 'cursor'; x: number; y: number; stillMs: number; offScreen: boolean };

const SAMPLE_MS = 50; // MouseTracking.run sleeps this long between samples
const OFF_SCREEN = 524287; // what the client sends for (-1, -1)
const ROW = 765; // position = y * ROW + x, from Client.java's clamps

function position(pos: number): { x: number; y: number; offScreen: boolean } {
    if (pos === OFF_SCREEN) {
        return { x: -1, y: -1, offScreen: true };
    }
    return { x: pos % ROW, y: Math.floor(pos / ROW), offScreen: false };
}

/**
 * Undo one input_report blob. Stops at the first byte it cannot read rather than throwing: these
 * rows are flushed on a buffer boundary, so a truncated tail is ordinary and losing the last event
 * of one row matters far less than losing the whole row.
 */
export function decodeInputReport(data: Uint8Array): InputEvent[] {
    const out: InputEvent[] = [];
    let at = 0;

    // the cursor's last known place, carried across records because small steps are deltas
    let x = -1;
    let y = -1;

    while (at < data.length) {
        const kind = data[at++];

        if (kind === 1) {
            if (at + 4 > data.length) {
                break;
            }
            const pitch = (data[at] << 8) | data[at + 1];
            const yaw = (data[at + 2] << 8) | data[at + 3];
            at += 4;
            out.push({ kind: 'camera', pitch, yaw });
        } else if (kind === 2) {
            if (at + 1 > data.length) {
                break;
            }
            out.push({ kind: 'focus', gained: data[at++] !== 0 });
        } else if (kind === 3) {
            if (at + 4 > data.length) {
                break;
            }
            // unsigned: elapsed reaches past 2^31 on its own
            const info = ((data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8) | data[at + 3]) >>> 0;
            at += 4;
            const place = position(info & 0x7ffff);
            out.push({
                kind: 'click',
                x: place.x,
                y: place.y,
                right: ((info >>> 19) & 1) === 1,
                sinceLastMs: ((info >>> 20) & 0xfff) * SAMPLE_MS
            });
        } else if (kind === 4) {
            if (at + 1 > data.length) {
                break;
            }
            const length = data[at++];
            if (at + length > data.length) {
                break;
            }
            const end = at + length;

            while (at < end) {
                const first = data[at];
                let still: number;
                let place: { x: number; y: number; offScreen: boolean };

                if ((first & 0x80) === 0) {
                    // a small step, as deltas on the last known position
                    if (at + 2 > end) {
                        break;
                    }
                    const v = (data[at] << 8) | data[at + 1];
                    at += 2;
                    still = v >>> 12;
                    if (x < 0 || y < 0) {
                        // a delta with nothing to apply it to: the batch began mid-path, which
                        // happens when a previous flush split one. Position unknown, timing is not.
                        out.push({ kind: 'cursor', x: -1, y: -1, stillMs: still * SAMPLE_MS, offScreen: true });
                        continue;
                    }
                    x += ((v >>> 6) & 0x3f) - 32;
                    y += (v & 0x3f) - 32;
                    place = { x, y, offScreen: false };
                } else if ((first & 0x40) === 0) {
                    if (at + 3 > end) {
                        break;
                    }
                    const v = ((data[at] << 16) | (data[at + 1] << 8) | data[at + 2]) & 0x7fffff;
                    at += 3;
                    still = v >>> 19;
                    place = position(v & 0x7ffff);
                    x = place.x;
                    y = place.y;
                } else {
                    if (at + 4 > end) {
                        break;
                    }
                    const v = (((data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8) | data[at + 3]) >>> 0) & 0x3fffffff;
                    at += 4;
                    still = v >>> 19;
                    place = position(v & 0x7ffff);
                    x = place.x;
                    y = place.y;
                }

                out.push({ kind: 'cursor', x: place.x, y: place.y, stillMs: still * SAMPLE_MS, offScreen: place.offScreen });
            }

            at = end;
        } else {
            // an event type this build does not know: the frame gives no length, so the rest of
            // the row cannot be walked. Stop rather than guess at an offset.
            break;
        }
    }

    return out;
}

export type InputStats = {
    clicks: number;
    cursorSamples: number;
    /** Of the time the cursor was watched, the share of it where it did not move. */
    stillShare: number;
    /** Distinct click positions over clicks. One pixel for everything gives 1/clicks. */
    clickSpread: number;
    /** The share of clicks landing on the single most-used pixel. */
    topPixelShare: number;
    /** Spread of the gaps between clicks over their mean. A script's is small. */
    gapVariation: number;
    /** The share of gaps equal to the commonest one. A fixed sleep gives 1. */
    topGapShare: number;
    cameraMoves: number;
    focusChanges: number;
};

/** What a decoded session looks like, as numbers a person can argue with. */
export function analyseInput(events: InputEvent[]): InputStats {
    const clicks = events.filter(e => e.kind === 'click') as Extract<InputEvent, { kind: 'click' }>[];
    const cursor = events.filter(e => e.kind === 'cursor') as Extract<InputEvent, { kind: 'cursor' }>[];

    let watchedMs = 0;
    let stillMs = 0;
    for (const sample of cursor) {
        watchedMs += sample.stillMs + SAMPLE_MS;
        stillMs += sample.stillMs;
    }

    const pixels = new Map<string, number>();
    for (const click of clicks) {
        const key = `${click.x},${click.y}`;
        pixels.set(key, (pixels.get(key) ?? 0) + 1);
    }
    const topPixel = pixels.size > 0 ? Math.max(...pixels.values()) : 0;

    // the first click's gap is measured from whenever the last one before this capture was, so it
    // says nothing about this session
    const gaps = clicks.slice(1).map(c => c.sinceLastMs);
    const mean = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const variance = gaps.length > 1 ? gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length : 0;

    const gapCounts = new Map<number, number>();
    for (const gap of gaps) {
        gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
    }
    const topGap = gapCounts.size > 0 ? Math.max(...gapCounts.values()) : 0;

    return {
        clicks: clicks.length,
        cursorSamples: cursor.length,
        stillShare: watchedMs > 0 ? stillMs / watchedMs : 0,
        clickSpread: clicks.length > 0 ? pixels.size / clicks.length : 0,
        topPixelShare: clicks.length > 0 ? topPixel / clicks.length : 0,
        gapVariation: mean > 0 ? Math.sqrt(variance) / mean : 0,
        topGapShare: gaps.length > 0 ? topGap / gaps.length : 0,
        cameraMoves: events.filter(e => e.kind === 'camera').length,
        focusChanges: events.filter(e => e.kind === 'focus').length
    };
}
