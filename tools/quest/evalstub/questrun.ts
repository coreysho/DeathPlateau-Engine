// The other half of the stub: play() captures the manifest instead of playing it.
//
// The sim's last statement hands its finished Manifest to play(). That object is what the helper
// wants, generated legs and all, so this keeps it and stops the file there - the quest is never
// run, no world exists to run it in, and the export costs a module load rather than a playthrough.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Step = any;
export type Manifest = any;
export type Result = any;

/** Where the captured manifest lands, read by EvalManifest after the import resolves. */
export const captured: any[] = [];

/** Thrown to stop the sim the instant it hands over its manifest. */
export const DONE = Symbol('manifest captured');

/**
 * Keep the manifest and stop the file there.
 *
 * Returning normally let the sim carry on into its own checks, which read a world that does not
 * exist (one printed "Prayer xp from the whole quest: NaN") and then called process.exit at the
 * end of itself - taking the process down before anything could print what had been captured.
 * Throwing leaves the sim no way to do either.
 */
export function play(m: any): any[] {
    captured.push(m);
    throw DONE;
}

export const drive = (): string[] => [];
export const travel = (): string => '';
