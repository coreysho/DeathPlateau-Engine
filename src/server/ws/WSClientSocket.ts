import ClientSocket from '#/server/ClientSocket.js';

type RuntimeWebSocket = {
    readonly bufferedAmount: number;
    send(data: Uint8Array): void;
    close(): void;
    terminate(): void;
};

export default class WSClientSocket extends ClientSocket {
    socket: RuntimeWebSocket;

    constructor(socket: RuntimeWebSocket, remoteAddress: string) {
        super();

        this.socket = socket;
        this.remoteAddress = remoteAddress;
    }

    get bufferedBytes(): number {
        return this.socket.bufferedAmount;
    }

    send(src: Uint8Array): void {
        this.socket.send(src);
    }

    close(): void {
        this.state = -1;
        this.socket.close();
    }

    terminate(): void {
        this.state = -1;
        this.socket.terminate();
    }
}
