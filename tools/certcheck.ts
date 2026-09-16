/**
 * Every noteable obj points at a real note, and every note comes home again.
 *
 * WHY THIS AND NOT A CONTENT CHECK. The forward note link is not in the cache and not in any
 * config: packObjConfigs derives it at pack time from the name cert_<debugname>. So the only place
 * the truth exists is the PACKED data, read the way the server reads it - which is what this does,
 * through ObjType itself rather than a second decoder that could drift from it.
 *
 * content/tools/certcheck.py checks the configs the packer reads. This checks what it wrote.
 *
 *   npx tsx tools/certcheck.ts
 */
import ObjType from '#/cache/config/ObjType.js';

ObjType.load('data/pack');

// The engine's own two rules, from ObjConfigOps: OC_CERT and OC_UNCERT.
const cert = (o: ObjType) => (o.certtemplate === -1 && o.certlink >= 0) ? ObjType.configs[o.certlink] : o;
const uncert = (o: ObjType) => (o.certtemplate >= 0 && o.certlink >= 0) ? ObjType.configs[o.certlink] : o;

let notes = 0;
let noteable = 0;
const oneway: string[] = [];
const missing: string[] = [];
const seen = new Map<number, string>();
const twoNotes: string[] = [];

for (const o of ObjType.configs) {
    if (!o) {
        continue;
    }
    if (o.certtemplate >= 0) {
        notes++;
        const base = uncert(o);
        if (base === o) {
            missing.push(`${o.debugname ?? o.id} is a note of nothing`);
        }
        const already = seen.get(base.id);
        if (already) {
            twoNotes.push(`${base.debugname ?? base.id} has two notes: ${already} and ${o.debugname ?? o.id}`);
        }
        seen.set(base.id, o.debugname ?? String(o.id));
    }
    const note = cert(o);
    if (note !== o) {
        noteable++;
        // The round trip is the whole point: oc_cert out, oc_uncert back. An old-style certificate
        // - a stackable copy of the item with no certtemplate - fails it, and once a player noted
        // one it could never be swapped back.
        if (uncert(note) !== o) {
            oneway.push(`${o.debugname ?? o.id} -> ${note.debugname ?? note.id} ${JSON.stringify(note.name ?? null)}`);
        }
    }
}

let bad = 0;
const check = (ok: boolean, what: string) => {
    console.log((ok ? '  ok   ' : '  FAIL ') + what);
    if (!ok) {
        bad++;
    }
};

console.log(`${ObjType.configs.length} objs, ${notes} notes, ${noteable} noteable bases`);
check(noteable === notes, `every note is reachable from its base and no base reaches anything else: ${noteable} vs ${notes}`);
check(oneway.length === 0, `every note swaps back through oc_uncert: ${oneway.length ? oneway.slice(0, 8).join('; ') : 'all ' + noteable}`);
check(missing.length === 0, `every note names a base: ${missing.length ? missing.slice(0, 5).join('; ') : 'all ' + notes}`);
check(twoNotes.length === 0, `no base has two notes: ${twoNotes.length ? twoNotes.slice(0, 5).join('; ') : 'none'}`);

console.log();
console.log(bad === 0 ? 'ALL PASS' : `${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
