// Imports
const axios = require("axios");
const chalk = require("chalk");

// Class definition
module.exports = class HTTPHandler {

    constructor(client) {
        this.client = client;
        this.debug = client.debug;
        this.use_https = client.local_protocol === 'https';
        this.local_host = client.local_host;
        this.remote_host = client.remote_host;

        this.header_blacklist = [
            `cors`,
            `same-origin`,
            `host`,
            `sec-fetch-`,
            `referer`,
            `access-control`
        ];
    }

    //#region Utilities

    log() {
        if (this.debug) console.log.apply(console, [chalk.green(`[HTTP] `), ...arguments]);
    }

    async removeBlacklistedHeaders(headers) {
        // Iterates trough every header
        for (let key in headers) {
            if (!headers.hasOwnProperty(key)) continue;

            let value = headers[key];

            // Check any occurrence of the blacklisted headers both in the key and the value
            if (this.header_blacklist.indexOf(key) !== -1 || this.header_blacklist.indexOf(value) !== -1) {
                // Remove the header
                delete headers[key];
            }
        }
    }

    async replaceHeaders(headers, from, to) {
        // Iterates trough every header
        for (let key in headers) {
            if (!headers.hasOwnProperty(key)) continue;

            let value = headers[key];

            // Check if the value has the specified value to replace
            if (value.indexOf(from) !== -1) {
                value = value.replace(from, to);
            }

            // Check if the key has the specified value to replace
            if (key.indexOf(from) !== -1) {
                // Remove the current entry
                delete headers[key];

                // Replace it with a new header
                let new_key = key.replace(from, to);
                headers[new_key] = value;
            }
        }
    }

    async injectHostHeader(headers, host) {
        headers["host"] = host;
    }

    doRequest(method, url, headers, payload) {
        return new Promise(async (resolve, reject) => {
            let path = url.replace(new RegExp(`http(s?)\:\/\/${this.client.local_host}`, "gi"), "");

            try {
                // this.log(`${chalk.cyan(method.toUpperCase())} ${chalk.gray(path)}`);

                // Do the request
                let response = await axios({
                    method,
                    url,
                    headers,
                    responseType: "arraybuffer",
                    data: Buffer.from(payload, "base64")
                });

                // Resolves with the response
                this.log(`${chalk.cyan(method.toUpperCase())} ${chalk.gray(path)} - [${chalk.green("OK")}]`);
                resolve(response);
            } catch (error) {
                this.log(`${chalk.cyan(method.toUpperCase())} ${chalk.gray(path)} - [${chalk.red("ERROR")}]`);

                // Check if it was a error response, if so resolves with the response
                if (error && error.response) return resolve(error.response);

                // It was a legit error
                reject(error);
            }
        });
    }

    async formatResponse(response) {
        // Process the response headers
        await this.replaceHeaders(response.headers, this.local_host, this.remote_host);
        await this.injectHostHeader(response.headers, this.remote_host);

        // Returns the message to be forwarded to the server
        return {
            code: response.status,
            headers: response.headers,
            response: Buffer.from(response.data, "binary").toString("base64")
        };
    }

    async formatRequest(method, path, headers, payload) {
        // Removes the root path /
        if (path.startsWith("/")) path = path.substring(1);

        // Pre-process the request headers
        await this.replaceHeaders(headers, this.remote_host, this.local_host);
        await this.removeBlacklistedHeaders(headers);
        await this.injectHostHeader(headers, this.local_host);

        // Mounts the request url
        let url = `${this.use_https ? 'https' : 'http'}://${this.local_host}/${path}`;

        // Simulates the request
        return await this.doRequest(method, url, headers, payload);
    }

    //#endregion

    async handle({ id, method, path, headers, payload }) {
        let response = await this.formatRequest(method, path, headers, payload);
        let message = await this.formatResponse(response);

        this.client.sendMessage({ id, type: "http", event: "response", payload: message });
    }

};