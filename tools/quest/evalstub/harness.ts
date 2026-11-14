// A harness that does nothing, so a manifest can be READ by running the file that builds it.
//
// Twenty-three of the quest sims build part of their step list with a function - `...southIn()`,
// `...gate(...)` - and a function call is not something the TypeScript AST can be asked for the
// value of. The exporter therefore refused those quests whole rather than export them with the
// generated legs missing, which is the right refusal and left 25 of 108 quests out of the helper.
//
// The generators themselves are pure: `gate(at, loc, why)` returns two literal steps. What makes
// the file unrunnable is everything AROUND them - `await H.boot()` starts a world, and `play()`
// then plays the quest. So this module stands in for the real harness: boot resolves at once,
// every other call is a no-op, and the file's own consts and generators evaluate exactly as they
// would have. tools/quest/EvalManifest.ts puts this on the import path in place of the real one.
//
// NOT A PARSER, which is the point. The steps come out of the sim's own code running, so a
// generator can do whatever it likes - loops, conditionals, nested helpers - and the export still
// sees what the sim sees. The alternative was teaching a parser to evaluate TypeScript, which is
// a worse job that is never finished.
/* eslint-disable @typescript-eslint/no-explicit-any */

const nothing = (): any => undefined;

export async function boot(): Promise<void> {
    // No world. The file awaits this before it builds anything.
}

export const A: any = new Proxy({}, { get: () => nothing });

export const ifaces: any[] = [];
export const mesgs: any[] = [];

export const tick = nothing;
export const maxOut = nothing;
export const equip = nothing;
export const give = nothing;
export const setVar = nothing;
export const setVarBit = nothing;
export const getVarBit = (): number => 0;
export const invCount = (): number => 0;
export const opLoc = nothing;
export const opNpc = nothing;
export const opheld = nothing;
export const useHeldOn = nothing;
export const runProc = (): any[] => [];

/**
 * A player-shaped nothing.
 *
 * Some manifests read the player while building themselves - a start tile taken from where the
 * sim put it - so this answers a number for any field rather than undefined, which would turn a
 * coordinate into NaN and put a step at a tile that does not exist.
 */
export const makePlayer = (): any =>
    new Proxy(
        { x: 0, z: 0, level: 0, username: 'export' },
        {
            get: (target: any, key: string) => (key in target ? target[key] : nothing)
        }
    );

export const npcNear = (): any => null;
