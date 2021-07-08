// Imports
const chalk = require("chalk");
const uuid = require("uuid").v4;

// Class definition
module.exports = class WSBridgeServer {

    constructor({ debug, http_server, ws_server }) {
        this.debug = debug;
        this.ws_server = ws_server;
        this.ws_server.ws_bridge_server = this;
        this.auto_sleep_time = this.ws_server.auto_sleep_time;
        this.http_server = http_server;

        this.clients = [];
    }

    //#region Utilities

    log() {
        if (this.debug) console.log.apply(console, [chalk.cyan(`[WS-BRIDGE] `), ...arguments]);
    }

    validCloseCode(code) {
        return ((code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) || (code >= 3000 && code <= 4999));
    }

    async sendMessageToLocalClient(event, payload) {
        // Define the request information
        let message = {
            id: uuid(),
            type: 'ws',
            event,
            payload
        };

        // Route the received event to the client
        await this.ws_server.routeRequestToClient(message);
    }

    async sendMessageToRemoteClient(payload) {
        this.clients.forEach(x => {
            x.send(payload);
        });
    }

    //#endregion

    //#region Event handlers

    async onConnection(id, ip, remoteSocket, req) {
        this.log(`Received connection from ${chalk.gray(ip)}`);

        this.clients.push({ socket: remoteSocket, id, ip });

        // Notify to open a connection on the local client side
        await this.sendMessageToLocalClient("open", { id, path: req.url });

        // Define the on disconnect handler
        remoteSocket.on("close", async () => {
            this.log(`Client ${chalk.gray(ip)}-${chalk.gray(id)} disconnected!`);

            // Notify to close the connection on the local client side
            await this.sendMessageToLocalClient("close", null);

            // Removes the socket from the client list
            this.clients.splice(this.clients.findIndex(x => x.id === id));
        });

        // Define the on message handler
        remoteSocket.on("message", async raw_data => {
            this.log(`Incoming remote message from ${chalk.gray(ip)}-${chalk.gray(id)} ${chalk.cyan(raw_data.length + ' bytes')}`);
            console.log(raw_data);

            await this.sendMessageToLocalClient("message", {
                id: uuid(),
                type: "ws",
                event: "message",
                payload: raw_data
            });
        });
    }

    async onMessageFromLocal({ event, payload }) {
        switch(event) {

            case "open":
                //this.clients.forEach(x => x.open());
                break;

            case "close":
                // Omit reserved close codes
                if (!this.validCloseCode(payload.code)) payload.code = undefined;

                this.clients.forEach(x => x.socket.close(payload.code));
                break;

            case"message":
                this.clients.forEach(x => x.socket.send(payload));
                break;

        }
    }

    async onStop() {
        this.log(`Closing active bridge connections...`);

        this.clients.forEach(x => {
            x.socket.close();
        });
    }

    //#endregion

};