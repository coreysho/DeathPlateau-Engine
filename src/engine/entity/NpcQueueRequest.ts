import { ScriptArgument } from '#/engine/entity/PlayerQueueRequest.js';
import Linkable from '#/datastruct/Linkable.js';

export class NpcQueueRequest extends Linkable {
    queueId: number;

    /**
     * The arguments to execute the script with.
     */
    args: ScriptArgument[];

    /**
     * The number of ticks remaining until the queue executes.
     */
    delay: number;

    lastInt: number = 0;

    /**
     * Queued by npc_queue_maxhit: the hit (lastInt) is the attacker's max hit, so the damage splat the
     * queued script deals for exactly that amount is drawn as the max hit one (HitType.MAX_HIT).
     */
    maxHit: boolean = false;

    constructor(queueId: number, args: ScriptArgument[], delay: number) {
        super();
        this.queueId = queueId;
        this.args = args;
        this.delay = delay;
    }
}
