// Imports
const ws = require("ws");
const chalk = require("chalk");
const uuid = require("uuid").v4;
const Utility = require("./utility.js");

// Constants
const TIME_OUT = 1000 * 60;// 1 minute

// Class definition
module.exports = class WSServer {

    constructor({ secret, auto_sleep, debug }) {
        this.secret = secret;
        this.debug = debug;
        this.auto_sleep_time = auto_sleep;

        // Variables to be self-attached to
        this.http_server = null;
        this.ws_bridge_server = null;

        this.server = null;

        this.clients = [];
        this.queue = [];

        this.dequeue_time_handle = null;
    }

    //#region Utilities

    verifyClientSecret(socket_request) {
        const s = socket_request;

        // The url of the socket connection should contain the specified secret
        return decodeURIComponent(s.url).indexOf(this.secret) !== -1;
    }

    log() {
        if (this.debug) console.log.apply(console, [chalk.magenta(`[WS] `), ...arguments]);
    }

    timeoutEnqueuedRequests() {
        let now = Date.now();

        // Filters the expired requests that have been requested and not answered within the TIME_OUT time
        let expiredRequests = this.queue.filter(x => now - x.time >= TIME_OUT);

        if (expiredRequests > 0) this.log(`Expired ${expiredRequests.length} requests!`);

        for (let request of expiredRequests) {
            // Removes from the queue
            this.queue.splice(this.queue.indexOf(request), 1);

            // Resolves the promise
            request.reject();
        }

        // Re-schedule to run again
        this.dequeue_time_handle = setTimeout(this.timeoutEnqueuedRequests.bind(this), TIME_OUT);
    }

    routeRequestToClient(message) {
        return new Promise((resolve, reject) => {
            // Find any client connected
            let client = this.clients.find(x => x);

            // If there is no client connected, enqueue the message
            if (!client) return this.queue.push({ time: Date.now(), message, resolve, reject });

            // Converts it into a json string before sending, if needed
            if (typeof message !== "string") message = JSON.stringify(message);

            // Send the message
            client.socket.send(message);

            resolve();
        });
    }

    dequeueMessages(socket) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.queue.length <= 0) return;

                this.log(`Dequeueing ${this.queue.length} messages!`);

                while (this.queue.length > 0) {
                    // Fetch the message from the queue
                    let obj = this.queue[0];

                    // Tries to send to the local client
                    await this.routeRequestToClient(obj.message);

                    // If successful, pop the queue
                    this.queue.splice(0, 1);

                    // Resolves the message promise
                    obj.resolve();
                }
            } catch (error) {
                console.error(error);
                console.trace(error);

                resolve();
            }
        });
    }

    //#endregion

    start() {
        this.log(`Starting ws server...`);

        // Creates the server
        this.server = new ws.Server({
            noServer: true,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                }
            }
        });

        // Define the chandlers
        this.defineHandlers();

        // Start the timeout loop
        this.timeoutEnqueuedRequests();
    }

    stop() {
        return new Promise(async (resolve, reject) => {
            try {
                await this.http_server.onStop();
                await this.ws_bridge_server.onStop();

                this.log(`Stopping ws server...`);
                this.server.close(_ => {
                    process.exit(0);
                });
            } catch (error) {
                this.log(chalk.red(`Error while stopping server!\nError: ${error}`));
                reject(error);
            }
        });
    }

    defineHandlers() {
        this.server.on("connection", this.onConnection.bind(this));
    }

    //#region Event handlers

    async onUpgrade(request, socket, head) {
        this.log(`Received upgrade request from ${Utility.getIpAddress(request)}!`);

        this.server.handleUpgrade(request, socket, head, socket => {
            this.server.emit("connection", socket, request);
        });
    }

    async onConnection(socket, req) {
        // Gather information about the connection request
        let ip = Utility.getIpAddress(req);
        let id = uuid();

        this.log(`Received connection from ${chalk.gray(ip)}`);

        // Determine whether the connect request is from a Client or a Bridge socket
        if (this.verifyClientSecret(req)) {
            // This is a client, handle the connection
            await this.onClientConnect(socket, req, id, ip);
        } else {
            // Bridge server will handle the connection
            await this.ws_bridge_server.onConnection(id, ip, socket, req);
        }
    }

    async onClientConnect(socket, req, id, ip) {
        this.log(`Socket ${chalk.gray(ip)}-${chalk.gray(id)} authenticated as ${chalk.green("client!")}`);

        this.clients.push({ socket, id, ip });

        // Check the message queue
        this.dequeueMessages(socket);

        // Define the on disconnect handler
        socket.on("close", () => {
            this.log(`Client ${chalk.gray(ip)}-${chalk.gray(id)} disconnected!`);

            // Removes the socket from the client list
            this.clients.splice(this.clients.findIndex(x => x.id === id), 1);
        });

        // Define the on message handler
        socket.on("message", async raw_data => {
            let data = JSON.parse(raw_data);

            switch(data.type) {
                case "ws": return await this.ws_bridge_server.onMessageFromLocal(data);

                // Calls the http server to handle the client post back
                case "http": return await this.http_server.onPostBack(data);
            }
        });
    }

    //#endregion

};