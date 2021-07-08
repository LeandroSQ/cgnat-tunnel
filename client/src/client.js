// Imports
const WebSocket = require("./client-socket.js");
const chalk = require("chalk");
const HTTPHandler = require("./http-handler.js");
const WSHandler = require("./ws-handler.js");

// Constants
const STATE_CONNECTED = 1;

// Class definition
module.exports = class Client {

    constructor({ secret, debug, remote_host, remote_protocol, local_host, local_protocol }) {
        this.secret = secret;
        this.debug = debug;
        this.remote_host = remote_host;
        this.local_host = local_host;
        this.remote_protocol = remote_protocol;
        this.local_protocol = local_protocol;

        this.http_handler = new HTTPHandler(this);
        this.ws_handler = new WSHandler(this);

        this.socket = new WebSocket(`ws://${this.remote_host}/${this.secret}`, null);

        this.reconnect_timeout = 2500;// In ms
        this.reconnect_timeout_handle = null;
    }

    //#region Utilities

    log() {
        if (this.debug) console.log.apply(console, [chalk.magenta(`[CLIENT] `), ...arguments]);
    }

    scheduleReconnect() {
        if (this.reconnect_timeout_handle) return;

        this.reconnect_timeout_handle = setTimeout(this.start.bind(this), this.reconnect_timeout);
    }

    //#endregion

    start() {
        try {
            this.reconnect_timeout_handle = null;
            this.log(`Trying to establish connection...`);

            // Creates the socket
            this.socket.connect();

            // Define it's event handlers
            this.socket.on("open", this.onConnect.bind(this));
            this.socket.on("close", this.onDisconnect.bind(this));
            this.socket.on("message", this.onMessage.bind(this));
        } catch (error) {
            this.log(`Error while establishing connection!\nError: ${error}`);
            console.trace(error);

            // Disposes the faulty socket
            if (this.socket) this.socket.dispose();

            this.scheduleReconnect();
        }
    }

    async sendMessage(message) {
        await this.socket.send(message);
    }

    //#region Event handlers

    async onConnect() {
        this.log(`Connection ${chalk.green("established")} with remote host!`);
    }

    async onDisconnect(code, reason) {
        this.log(`Connection ${chalk.red("lost")} with remote host! ${code}`);

        // Dispose the socket
        if (this.socket) {
            this.socket.dispose();
        }

        this.scheduleReconnect();
    }

    async onMessage(raw_data) {
        let data = JSON.parse(raw_data);

        // Redirect to the correct handler
        switch(data.type) {
            case "ws": return this.ws_handler.handle(data);
            case "http": return this.http_handler.handle(data);
        }
    }

    //#endregion

};