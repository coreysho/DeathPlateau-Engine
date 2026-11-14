// Two of the twenty-five import a1lib for drive(); neither uses it while building the manifest.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const drive = (): string[] => [];
export const travel = (): string => '';
export const check = (): void => undefined;
export const R = { ok: 0, bad: 0 };
export const player = (): any => ({ x: 0, z: 0, level: 0 });
export const findNpc = (): any => null;
