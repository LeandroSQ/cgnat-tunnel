// Imports
const WebSocket = require("ws");
const chalk = require("chalk");

// Constants
const STATE_CONNECTED = 1;

// Class definition
module.exports = class ClientSocket {

    constructor(host, path) {
        this.host = host;
        this.path = path;

        this.socket = null;
        this.queue = [];
    }

    connect() {
        if (this.socket != null) return;

        this.socket = new WebSocket(this.host, { path: this.path });

        this.socket.on("open", this.onSocketConnected.bind(this));
    }

    on(event, handler) {
        this.socket.on(event, handler);
    }

    dispose() {
        try {
            this.socket.close();
            this.socket.terminate();
        } catch (error) { /* ignore */ }

        this.socket = null;
    }

    get isAvailable() {
        return this.socket && this.socket.readyState === STATE_CONNECTED;
    }

    enqueueSend(data, resolve, reject) {
        this.queue.push({ data, resolve, reject });
    }

    async dequeueMessages() {
        if (this.isAvailable && this.queue.length > 0) {
            try {
                //console.log(`Dequeueing ${this.queue.length} messages...`);

                do {
                    // Peeks the first message in the queue
                    let message = this.queue[0];

                    // Sends the message
                    await this.send(message.data, false);

                    // Resolves the message promise
                    message.resolve();

                    // Removes the message from the queue
                    this.queue.splice(0, 1);
                } while (this.queue.length > 0);
            } catch (error) {
                console.error(error);
            }
        }
    }

    send(data, enqueueIfNotAvailable=true) {
        return new Promise((resolve, reject) => {
            // Automatically stringifies the data if not in string
            if (typeof(data) !== "string") data = JSON.stringify(data);

            // If not available, enqueue the message sending
            if (!this.isAvailable) {
                if (!enqueueIfNotAvailable) return reject("Not available");

                console.log(`Enqueue`);

                return this.enqueueSend(data, resolve, reject);
            }

            // Send the message
            this.socket.send(data, error => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    async onSocketConnected() {
        this.dequeueMessages();
    }

}