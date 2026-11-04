import World from '#/engine/World.js';

import Player from '#/engine/entity/Player.js';

import Packet from '#/io/Packet.js';

import EventAppletFocus from '#/network/game/client/model/EventAppletFocus.js';
import EventCameraPosition from '#/network/game/client/model/EventCameraPosition.js';
import EventMouseClick from '#/network/game/client/model/EventMouseClick.js';
import EventMouseMove from '#/network/game/client/model/EventMouseMove.js';

enum InputTrackingEvent {
    CAMERA_POSITION = 1,
    APPLET_FOCUS,
    MOUSE_CLICK,
    MOUSE_MOVE
}

export default class InputTracking {
    private readonly player: Player;
    private softLimit: number = 1500;

    active: boolean = false;
    buf: Packet = Packet.alloc(1);

    // custom (2026-11-04) - HOW MUCH OF THIS SESSION CAME FROM A HUMAN AT A KEYBOARD, counted for
    // everybody, always, and costing five integers a player.
    //
    // The four below are what the client reports about the person using it: where the cursor went,
    // where it was clicked, whether the camera was turned, whether the window kept focus. A bot
    // that drives the real client produces all of it. A bot that speaks the protocol straight at
    // the server produces NONE of it, because nothing is moving a mouse to report - and that is a
    // thing you can see without decoding a single byte of what was reported. Hence counters here
    // rather than in the capture below: the counts are the triage, and the capture - which is off
    // unless somebody turns it on for a suspect, and costs about a megabyte per player-hour - is
    // the evidence afterwards.
    //
    // THE COUNTS ARE MEANINGLESS ALONE and the fifth is why. Somebody standing in a bank for an
    // hour moves no mouse either. It is a high action count against a near-zero mouse count that
    // says something, so actions are counted here beside them rather than inferred later from
    // session_log, whose rows are written for a chosen few events and would undercount.
    //
    // Deliberately NOT an accusation: naive autoclickers and packet bots fall out of this, a
    // humanised screen-scraper on the real client does not, and no number here should ban anybody
    // on its own. See tools/server/botcheck.ts, which ranks and leaves the judgement to a person.
    mouseMoves: number = 0;
    mouseClicks: number = 0;
    cameraMoves: number = 0;
    focusChanges: number = 0;
    userActions: number = 0;

    /** One thing the player did that the world acted on. NetworkPlayer.read calls this. */
    userAction(): void {
        this.userActions++;
    }

    /** Whether this session looks like nobody was holding the mouse. Read by the report tool. */
    get telemetry(): number {
        return this.mouseMoves + this.mouseClicks + this.cameraMoves + this.focusChanges;
    }

    constructor(player: Player) {
        this.player = player;
    }

    onCycle(): void {
        if (this.buf.pos >= this.softLimit) {
            this.flush();
        }
    }

    flush(): void {
        if (!this.active) {
            return;
        }

        if (this.buf.pos > 0) {
            World.submitInputTracking(this.player, this.buf.data.subarray(0, this.buf.pos));
        }

        this.buf.pos = 0;
    }

    cameraPosition(event: EventCameraPosition) {
        this.cameraMoves++;

        if (!this.active) {
            return;
        }

        if (this.buf.pos + 5 >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.CAMERA_POSITION);
        this.buf.p2(event.pitch);
        this.buf.p2(event.yaw);
    }

    appletFocus(event: EventAppletFocus) {
        this.focusChanges++;

        if (!this.active) {
            return;
        }

        if (this.buf.pos + 2 >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.APPLET_FOCUS);
        this.buf.p1(event.focus);
    }

    mouseClick(event: EventMouseClick) {
        this.mouseClicks++;

        if (!this.active) {
            return;
        }

        if (this.buf.pos + 5 >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.MOUSE_CLICK);
        this.buf.p4(event.info);
    }

    mouseMove(event: EventMouseMove) {
        this.mouseMoves++;

        if (!this.active || event.data.length === 0 || event.data.length > 160) {
            return;
        }

        if (this.buf.pos + event.data.length >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.MOUSE_MOVE);
        this.buf.p1(event.data.length);
        this.buf.pdata(event.data, 0, event.data.length);
    }
}
