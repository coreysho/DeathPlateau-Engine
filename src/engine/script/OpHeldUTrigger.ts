import CategoryType from '#/cache/config/CategoryType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

/**
 * WHICH SCRIPT A HALF OF A "USE A ON B" CARRIES, obj trigger first and then its category - the same
 * two lookups OpHeldUHandler makes for each half.
 *
 * It lives here rather than in the handler because TWO places need to agree about it: the handler,
 * which runs one half's script, and opheldu_decline, which hands the click to the other half when
 * that script says it does not know the pair. A second copy of this answer is how the two would
 * come to disagree, and a disagreement here is a click that is accepted and then dropped.
 */
export function opHeldUTriggerFor(objId: number): ScriptFile | null {
    const type = ObjType.get(objId);
    if (typeof type === 'undefined') {
        return null;
    }

    const own = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, type.id, -1);
    if (own) {
        return own;
    }

    if (type.category !== -1) {
        const category = CategoryType.get(type.category);
        if (category) {
            return ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, category.id) ?? null;
        }
    }

    return null;
}

/**
 * The trigger belonging to the half that has NOT had a go yet, or null when there is nobody to hand
 * the click to.
 *
 * By the time any opheldu script is running, last_item is the half that carried the trigger and
 * last_useitem is the other one - that is the contract every [opheldu,x] script is written against.
 * So the half still owed a go is always last_useitem's, and `opHeldUTriggerFor(lastItem)`
 * reconstructs what is running without having to be told: whichever of the handler's four lookups
 * hit, repeating the obj-then-category pair on last_item lands on the same script.
 *
 * Null when both halves share one trigger (a category that covers them both), because running it
 * again would only decline again.
 */
export function opHeldUAlternate(player: { lastItem: number; lastUseItem: number }): ScriptFile | null {
    const running = opHeldUTriggerFor(player.lastItem);
    const other = opHeldUTriggerFor(player.lastUseItem);
    return other && other !== running ? other : null;
}
