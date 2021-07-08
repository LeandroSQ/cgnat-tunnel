// Imports
const net = require("net");
const chalk = require("chalk");
const WebSocket = require("./client-socket.js");

// Class definition
module.exports = class WSHandler {

    constructor(client) {
        this.client = client;
        this.debug = client.debug;
        this.local_host = client.local_host;
        this.remote_host = client.remote_host;

        this.socket = null;
    }

    //#region Utilities

    log() {
        if (this.debug) console.log.apply(console, [chalk.yellow(`[WS] `), ...arguments]);
    }

    //#endregion

    //#region Local socket handling

    async openSocket({ path }) {
        // Closes remaining sockets
        await this.closeSocket();

        if (this.local_host.endsWith("/")) this.local_host = this.local_host.substring(0, this.local_host.length - 1);
        if (path.startsWith("/")) path = path.substring(1);

        // Creates the socket
        let url = `ws://` + this.local_host.replace("https", "ws").replace("http", "ws") + "/" + path;
        this.log(`Opening socket ${chalk.gray("/" + path)}...`);
        this.socket = new WebSocket(url, null);
        this.socket.connect();

        // Bind event handlers
        this.socket.on("open", this.onSocketOpen.bind(this));
        this.socket.on("error", this.onSocketError.bind(this));
        this.socket.on("close", this.onSocketClosed.bind(this));
        this.socket.on("message", this.onSocketMessage.bind(this));
    }

    async closeSocket() {
        if (!this.socket) return;

        this.log(`Closing socket...`);

        this.socket.dispose();
        this.socket = null;
    }

    async sendMessage(payload) {
        if (typeof (payload) != "string") payload = JSON.stringify(payload);

        this.socket.send(payload);
    }

    //#endregion

    async handle({ event, payload }) {
        this.log(`${chalk.magenta("Incoming")} WS ${event}!`);

        switch (event) {
            case "open": return await this.openSocket(payload);
            case "close": return await this.closeSocket();
            case "message": return await this.sendMessage(payload.payload);
        }
    }

    //#region Event handlers

    async onSocketOpen() {
        this.client.sendMessage({ type: "ws", event: "open" });
    }

    async onSocketClosed(code, reason) {
        this.client.sendMessage({ type: "ws", event: "close", payload: { code, reason } });
    }

    async onSocketError(error) {
        this.log(chalk.red(`Socket error -> ${error}`));
        console.error(error);

        this.client.socket.dispose();
        this.client.scheduleReconnect();
        //this.client.sendMessage({ type: "ws", event: "error", payload: error });
    }

    async onSocketMessage(raw_data) {
        this.log(`${chalk.blue("Outcoming")} WS message! ${chalk.gray(raw_data.length + " bytes")}`);

        this.client.sendMessage({ type: "ws", event: "message", payload: raw_data });
    }

    //#endregion

};