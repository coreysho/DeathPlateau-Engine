// WALK data/pack/client/interface THE WAY THE WEB CLIENT DOES, and say where it runs off the end.
//
// The web client (public/client/client.js, the LostCity TypeScript port) dies with
//   "Unpacking interfaces 95%: Offset is outside the bounds of the DataView"
// while the Java client reads the same archive without complaint. The archive the live server hands
// out is byte-identical to the one this build makes, so the disagreement is in the readers, and the
// way to find it is to be the stricter reader and see which component it chokes on.
//
// The sequence below is transcribed from the minified bundle's Component.init, field by field. It is
// deliberately a SEPARATE transcription from src/cache/config/Component.ts: the server's decoder
// reads the same bytes and does not mind, so a copy of the server's decoder would not mind either.
//
//   npx tsx tools/sim/ifunpack.ts [path to a client/interface archive]
import fs from 'fs';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

const TYPE8 = process.argv.includes('--with-type8');
const path = process.argv.find(a => !a.startsWith('--') && a.endsWith('interface')) ?? 'data/pack/client/interface';
if (!fs.existsSync(path)) {
    console.log(`no archive at ${path}`);
    process.exit(2);
}

const jag = new Jagfile(Packet.load(path));
const buf = jag.read('data')!;
console.log(`${path}: "data" is ${buf.length} bytes`);

const total = buf.g2();
console.log(`header says ${total} components`);

let layer = -1;
let n = 0;
let last = '';
const trail: string[] = [];
try {
    while (buf.pos < buf.length) {
        let id = buf.g2();
        if (id === 65535) {
            layer = buf.g2();
            id = buf.g2();
        }
        const at = buf.pos;
        const type = buf.g1();
        const buttonType = buf.g1();
        const clientCode = buf.g2();
        const width = buf.g2();
        const height = buf.g2();
        buf.g1(); // trans
        const over = buf.g1();
        if (over !== 0) {
            buf.g1();
        }
        last = `com ${id} (layer ${layer}, type ${type}, button ${buttonType}, code ${clientCode}, ${width}x${height}) starting at ${at}`;
        // AN UNKNOWN TYPE IS NOT A DESYNC. This archive really does contain components of type 255,
        // twelve header bytes and nothing else, and both the Java client and the server read them by
        // simply matching no branch - so the only honest test is whether the walk ends on the last
        // byte of the archive. The trail below is what to print when it does not.
        trail.push(last);

        const comparators = buf.g1();
        for (let i = 0; i < comparators; i++) {
            buf.g1();
            buf.g2();
        }
        const scripts = buf.g1();
        for (let i = 0; i < scripts; i++) {
            const ops = buf.g2();
            for (let j = 0; j < ops; j++) buf.g2();
        }

        if (type === 0) {
            buf.g2();
            buf.g1();
            const children = buf.g2();
            for (let i = 0; i < children; i++) {
                buf.g2();
                buf.g2();
                buf.g2();
            }
        }
        if (type === 1) buf.pos += 3;
        if (type === 2) {
            buf.g1(); buf.g1(); buf.g1(); buf.g1();
            buf.g1(); buf.g1();
            for (let i = 0; i < 20; i++) {
                if (buf.g1() === 1) {
                    buf.g2(); buf.g2();
                    buf.gjstr();
                }
            }
            for (let i = 0; i < 5; i++) buf.gjstr();
        }
        if (type === 3) buf.g1();
        if (type === 4 || type === 1) {
            buf.g1(); buf.g1(); buf.g1();
        }
        if (type === 4) {
            buf.gjstr();
            buf.gjstr();
        }
        if (type === 1 || type === 3 || type === 4) buf.g4();
        if (type === 3 || type === 4) {
            buf.g4(); buf.g4(); buf.g4();
        }
        if (type === 5) {
            buf.gjstr();
            buf.gjstr();
        }
        if (type === 6) {
            if (buf.g1() !== 0) buf.g1();
            if (buf.g1() !== 0) buf.g1();
            if (buf.g1() !== 0) buf.g1();
            if (buf.g1() !== 0) buf.g1();
            buf.g2(); buf.g2(); buf.g2();
        }
        if (type === 7) {
            buf.g1(); buf.g1(); buf.g1();
            buf.g4();
            buf.g2(); buf.g2();
            buf.g1();
            for (let i = 0; i < 5; i++) buf.gjstr();
        }
        // THE ONE THE WEB CLIENT IS MISSING. Pass --with-type8 and the same walk reaches the last
        // byte of the archive, which is what says type 8 is the whole of the difference rather than
        // the first of several.
        if (type === 8 && TYPE8) buf.gjstr();

        if (buttonType === 2 || type === 2) {
            buf.gjstr();
            buf.gjstr();
            buf.g2();
        }
        if (buttonType === 1 || buttonType === 4 || buttonType === 5 || buttonType === 6) {
            buf.gjstr();
        }
        n++;
        if (buf.pos > buf.length) {
            throw new Error(`read past the end: pos ${buf.pos} of ${buf.length}`);
        }
        if (trail.length > 8) trail.shift();
    }
} catch (e) {
    console.log('');
    console.log(`STOPPED after ${n} components, at byte ${buf.pos} of ${buf.length}`);
    console.log(`the one being read: ${last}`);
    console.log('the ones read just before it:');
    for (const t of trail.slice(0, -1)) console.log(`   ${t}`);
    console.log(`${(e as Error).message}`);
    process.exit(1);
}

console.log(`walked all ${n} components${TYPE8 ? ' (type 8 handled)' : ''} and ended exactly on byte ${buf.pos} of ${buf.length}`);
process.exit(0);
