import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';

export function packClientWordenc(cache: FileStream) {
    const packed = fs.readFileSync('data/raw/wordenc');
    if (Environment.BUILD_VERIFY_CACHE && !Packet.checkcrc(packed, 0, packed.length, -2063599502)) {
        throw new Error('wordenc does not match the original 377 cache.\nThat is expected on a repo with custom content; this check only runs with BUILD_VERIFY_CACHE=true.');
    }

    cache.write(0, 7, packed);
}
