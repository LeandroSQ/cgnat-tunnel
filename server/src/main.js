// Imports
const HTTPServer = require("./http-server.js");
const WSServer = require("./ws-server.js");
const WSBridgeServer = require("./ws-bridge-server.js");
require("dotenv").config();

console.clear();

// Environment variables fetch
const PORT = process.env.PORT || 3000;
const WS_SECRET = process.env.SECRET;
const DEBUG_MODE = process.env.DEBUG || false;
const AUTO_SLEEP = process.env.AUTO_SLEEP || 0;

// Servers startup
let ws = new WSServer({ secret: WS_SECRET, auto_sleep: AUTO_SLEEP, debug: DEBUG_MODE });
let http = new HTTPServer({ port: PORT, debug: DEBUG_MODE, ws_server: ws });
let ws_bridge = new WSBridgeServer({ debug: DEBUG_MODE, http_server: http, ws_server: ws });

// Runtime
http.start();
ws.start();

// Attach the unhandled promise rejection listener
process.on("unhandledRejection", (reason, promise) => {
    console.error(`Unhandled promise rejection at: ${promise}. Reason: ${reason}!`);
    if (reason && reason.stack) console.error(reason.stack);
});