// Imports
const express = require("express");
const bodyParser = require("body-parser");
const chalk = require("chalk");
const uuid = require("uuid").v4;

// Class definition
module.exports = class HTTPServer {

    constructor({ port, debug, ws_server }) {
        this.port = port;
        this.debug = debug;
        this.ws_server = ws_server;
        this.auto_sleep_time = this.ws_server.auto_sleep_time;
        this.ws_server.http_server = this;

        this.last_request_time = 0;

        this.host = "0.0.0.0";
        this.server = null;
        this.app = null;

        this.queue = [];
    }

    //#region Utilities

    log() {
        if (this.debug) console.log.apply(console, [chalk.yellow(`[HTTP] `), ...arguments]);
    }

    verifyLastRequestTime() {
        if (this.last_request_time <= 0) return setTimeout(this.verifyLastRequestTime.bind(this), this.auto_sleep_time);

        // Calculate the elapsed minutes since the last request was made
        let elapsedSinceLastRequest = ((Date.now() - this.last_request_time) / 1000) / 60;

        // Check if it is greater than the auto_sleep_time defined
        if (elapsedSinceLastRequest >= this.auto_sleep_time) {
            this.log(`No requests for ${elapsedSinceLastRequest}, sleeping...`);

            setTimeout(this.ws_server.stop.bind(this.ws_server), 200);
        } else {
            // If not, reschedule it
            setTimeout(this.verifyLastRequestTime.bind(this), this.auto_sleep_time);
        }
    }

    //#endregion

    start() {
        this.log(`Starting http server...`);

        // Creates the server
        this.app = express();

        // Define the http routes
        this.defineRoutes();

        // Starts the server
        this.server = this.app.listen(this.port, this.host, this.onStart.bind(this));

        // Catches WS upgrade request
        this.server.on("upgrade", this.onWSUpgrade.bind(this));
    }

    defineRoutes() {
        // Enables raw body payload
        this.app.use(bodyParser.raw({ type: "*/*" }));

        // Catches all requests
        this.app.all("*", this.onRequest.bind(this));
    }

    //#region Event handlers

    async onPostBack({ id, payload }) {
        this.log(`Received ${chalk.gray(id)} ` + chalk.blue(`postback!`));

        // Fetch the enqueued request
        let request = this.queue.find(x => x.id === id);
        if (!request) return;

        // Remove the request from the queue
        this.queue.splice(this.queue.indexOf(request), 1);

        // Answers the http client
        let response = request.res;
        response.set(payload.headers);
        response.status(payload.code);
        response.send(Buffer.from(payload.response, "base64"));
    }

    async onRequest(req, res) {
        // Saves the last time a request was made
        this.last_request_time = Date.now();

        this.log(chalk.blue(req.method.toUpperCase()) + " " + chalk.gray(req.path));

        // Generates the request id
        let request_id = uuid();

        // Enqueue the request to be answered
        this.queue.push({ id: request_id, path: req.path, res });

        // Define the request information
        let message = {
            id: request_id,
            type: 'http',
            method: req.method.toUpperCase(),
            path: req.path,
            headers: req.headers,
            payload: req.body.toString("base64")
        };

        // Route the received request to the connected clients
        await this.ws_server.routeRequestToClient(message);
    }

    async onWSUpgrade(req, socket, head) {
        await this.ws_server.onUpgrade(req, socket, head);
    }

    onStart() {
        this.log(`Server started at ${this.host}:${this.port}`);

        // If auto sleep is defined, start the check loop
        if (this.auto_sleep_time) this.verifyLastRequestTime();
    }

    onStop() {
        return new Promise((resolve, reject) => {
            this.log(`Stopping http server...`);

            this.server.close(error => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    //#endregion

};