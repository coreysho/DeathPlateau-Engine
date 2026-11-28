import { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

type RootSpec = {
    path: string;
    exts: string[];
};

function makeKey(root: string, ext: string) {
    return `${root}|${ext}`;
}

export class SourceSnapshot {
    private latest = new Map<string, number>();

    static async create(roots: RootSpec[]) {
        const snapshot = new SourceSnapshot();
        await Promise.all(roots.map(root => snapshot.scanRoot(root)));
        return snapshot;
    }

    private async scanRoot(root: RootSpec) {
        for (const ext of root.exts) {
            this.latest.set(makeKey(root.path, ext), 0);
        }

        await this.walk(root.path, new Set(root.exts), root.path);
    }

    private async walk(dir: string, exts: Set<string>, root: string) {
        let entries: Awaited<Dirent[]>;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (err) {
            // A source tree that is not there at all is fine - not every build has every one
            // of them, and a missing root legitimately contributes nothing.
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return;
            }
            // ANYTHING ELSE MUST BE LOUD. Returning here reports "no source is newer than the
            // pack file", which is the same answer as "everything is up to date" - so a
            // permission error, or an EMFILE out of the unbounded walk below, silently skips
            // registering every name under that directory and surfaces much later as a build
            // failure that names the pack file rather than the read that failed.
            throw err;
        }

        await Promise.all(
            entries.map(async entry => {
                const target = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await this.walk(target, exts, root);
                    return;
                }

                const ext = path.extname(entry.name);
                if (!exts.has(ext)) {
                    return;
                }

                const key = makeKey(root, ext);
                const modified = (await fs.stat(target)).mtimeMs;
                // COMPARE AND SET WITH NO await BETWEEN THE TWO LINES. Reading the running
                // maximum before the stat is a race, and it lost: every entry in the tree is
                // walked concurrently (Promise.all, recursively), so two files can both read
                // the same stale maximum and whichever stat finishes LAST wins - writing its
                // own smaller mtime over a larger one already recorded. This map exists to
                // hold the newest source and was holding an arbitrary one.
                //
                // What that costs: shouldRevalidatePackFile compares a pack file's timestamp
                // against this, so an under-reported maximum reads as "nothing has changed"
                // and the whole revalidation is skipped - the pack is loaded from disk as it
                // stands. category.pack is then not regenerated from the .loc/.npc/.obj files
                // that define its categories, and validateConfigPack skips the checks that
                // catch a name left in a pack with no definition behind it. Both failures are
                // quiet, and both are intermittent, because the walk order decides whether the
                // race bites at all - which is how this survived.
                //
                // NOT what it costs: "You may need to edit ../content/pack/<x>.pack" for a
                // transmitted pack is by design (see validateConfigPack), not this bug.
                const current = this.latest.get(key) ?? 0;
                if (modified > current) {
                    this.latest.set(key, modified);
                }
            })
        );
    }

    isNewer(root: string, ext: string, timestamp: number) {
        return (this.latest.get(makeKey(root, ext)) ?? 0) > timestamp;
    }
}
