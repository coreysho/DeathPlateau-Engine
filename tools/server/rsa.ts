import fs from 'fs';
import path from 'path';

import forge from 'node-forge';

import Environment from '#/util/Environment.js';

// Makes the login RSA key: the private half for the server (LOGIN_RSA_KEY_PATH, never committed) and
// the two numbers the client needs (Client.java LOGIN_RSAN / LOGIN_RSAE). `npm run rsa`.
//
// 1024 bits is the most the login block has room for: the client writes the encrypted block's length
// in one byte, and the whole login packet's length in another (Client.login, World.onClientData).

const out = Environment.LOGIN_RSA_KEY_PATH;
const force = process.argv.includes('--force');

if (fs.existsSync(out) && !force) {
    console.error(`${out} already exists. Replacing it locks out every client built with the current key.`);
    console.error('Re-run with --force if that is what you want: npm run rsa -- --force');
    process.exit(1);
}

const key = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, forge.pki.privateKeyToPem(key.privateKey), { mode: 0o600 });
fs.chmodSync(out, 0o600);

console.log(`Wrote the private key to ${out} (mode 600). Keep it off GitHub and back it up.`);
console.log('');
console.log('Put these in DeathPlateau-Client/src/main/java/jagex2/client/Client.java:');
console.log(`    LOGIN_RSAN = new BigInteger("${key.publicKey.n.toString(10)}");`);
console.log(`    LOGIN_RSAE = new BigInteger("${key.publicKey.e.toString(10)}");`);
