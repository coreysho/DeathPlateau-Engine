import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import { convertImage } from '#tools/pack/PixPack.js';
import Environment from '#/util/Environment.js';
import Jagfile from '#/io/Jagfile.js';
import { TexturePack } from '#tools/pack/PackFile.js';
import { shouldBuildFile, shouldBuildFileAny } from '#tools/pack/PackFile.js';

export async function packClientTexture(cache: FileStream) {
    const rebuild =
        shouldBuildFileAny(`${Environment.BUILD_SRC_DIR}/textures`, 'data/pack/client/textures') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/texture.pack`, 'data/pack/client/textures') ||
        shouldBuildFileAny('tools/pack/sprite', 'data/pack/client/textures') ||
        shouldBuildFile('tools/pack/PixPack.ts', 'data/pack/client/textures');

    if (!rebuild && cache.has(0, 6)) {
        return;
    }

    if (rebuild) {
        const index = Packet.alloc(3);

        // Jagex shipped 50 and this loop said 50. It reads texture.pack's own count now, because
        // this fork adds textures the 2006 cache never had: a modern OSRS model names its texture
        // by id in the face colour field, and an id the client has no slot for cannot be imported
        // at all. Pix3D.TEXTURE_COUNT in the Java client is the matching ceiling - raise that one
        // too before adding a texture past it, or the client will index off the end of its arrays.
        // PackFile.max is already highest-id-plus-one (refreshNames does the +1), which a probe
        // said before this shipped: with ids 0-50 in the file it reads 51, not 50.
        const count = TexturePack.max;

        const all = [];
        for (let id = 0; id < count; id++) {
            const name = TexturePack.getById(id);
            if (!name) {
                throw new Error(`textures: id ${id} has no name in pack/texture.pack - ids must be contiguous`);
            }
            all.push(await convertImage(index, `${Environment.BUILD_SRC_DIR}/textures`, name));
        }

        const textures = Jagfile.new();
        for (let id = 0; id < all.length; id++) {
            textures.write(`${id}.dat`, all[id]);
        }
        textures.write('index.dat', index);
        textures.save('data/pack/client/textures');
    }

    const packed = fs.readFileSync('data/pack/client/textures');
    // The checksum is of the STOCK 50-texture archive, so it can only be checked while the archive
    // is still the stock one. Past that there is nothing to compare against - the archive is this
    // fork's own - and the guard above (every id from 0 to max must be named) is what replaces it.
    if (Environment.BUILD_VERIFY_CACHE && TexturePack.max === 50 && !Packet.checkcrc(packed, 0, packed.length, -1741782021)) {
        throw new Error('textures does not match the original 377 cache.\nThat is expected on a repo with custom content; this check only runs with BUILD_VERIFY_CACHE=true.');
    }

    cache.write(0, 6, packed);
}
