import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import { toBase37 } from '#/util/JString.js';

// A bot is a real Player with no client. It is in the world like anyone (real clients see it through
// the normal player info), but nothing is ever written to it, it is never saved, and its "input" is
// its brain calling the same handlers a client's packets reach (BotInput).
export default class BotPlayer extends Player {
    // what a NetworkPlayer's decodeIn resets each tick; the handlers write these
    userPath: number[] = [];
    opcalled: boolean = false;

    // the last few game messages it was sent - its brain reads them ("I'm already under attack.")
    readonly messages: { tick: number; text: string }[] = [];

    constructor(username: string) {
        const name37 = toBase37(username);
        super(username, name37, name37);
        this.isBot = true;
        this.lastConnected = World.currentTick;
        this.lastResponse = World.currentTick;
    }

    messageGame(msg: string): void {
        this.messages.push({ tick: World.currentTick, text: msg });
        if (this.messages.length > 16) {
            this.messages.shift();
        }
    }

    /** Was this said to it in the last `ticks` ticks? */
    heard(text: string, ticks = 2): boolean {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            const m = this.messages[i];
            if (World.currentTick - m.tick > ticks) {
                return false;
            }
            if (m.text.includes(text)) {
                return true;
            }
        }
        return false;
    }
}
