// Imports
const chalk = require("chalk");
const Client = require("./client");
require("dotenv").config();

console.clear();

// Setup
const REMOTE_HOST = process.env.HOST;
const REMOTE_PROTOCOL = process.env.REMOTE_PROTOCOL || "http";
const LOCAL_HOST = process.env.LOCALHOST;
const LOCAL_PROTOCOL = process.env.LOCAL_PROTOCOL || "http";
const DEBUG = process.env.DEBUG || true;
const WS_SECRET = process.env.SECRET;

// Runtime
let client = new Client({
    secret: WS_SECRET,
    debug: DEBUG,
    remote_host: REMOTE_HOST,
    remote_protocol: REMOTE_PROTOCOL,
    local_host: LOCAL_HOST,
    local_protocol: LOCAL_PROTOCOL
});
client.start();

// Attach the unhandled promise rejection listener
process.on("unhandledRejection", (reason, promise) => {
    console.error(`Unhandled promise rejection at: ${promise}. Reason: ${reason}!`);
    if (reason && reason.stack) console.error(reason.stack);
});