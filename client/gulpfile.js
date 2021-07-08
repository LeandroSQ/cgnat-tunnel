// Imports
const { src, dest, watch, series, parallel, task } = require("gulp");
const nodemon = require("nodemon");
const ChildProcess = require("child_process");

// Utility
function run(command, args) {
    return new Promise((resolve, reject) => {
        let p = ChildProcess.spawn(command, args);

        p.stdout.setEncoding("utf8");
        p.stdout.on("data", data => {
            console.log(data.toString());
        });

        p.stderr.setEncoding("utf8");
        p.stderr.on("data", data => {
            console.error(`Execution error -> `, data);
        });

        p.on("error", error => {
            console.error(`Spawn error -> `, error);
            reject(error);
        });

        p.on("close", code => {
            console.log(`Exit code ${code}`);

            if (code === 0) resolve(0);
            else reject(code);
        });
    });
}

// Tasks
function start(callback) {
    run("node", [`main.js`])
        .then(callback)
        .catch(callback);
}

function dev() {
    return nodemon({
        script: "src/main.js",
        ext: "js",
        signal: "SIGTERM",
        watch: "src/",
        // ignore: ".",
        // nodeArgs: "--inspect",
        delay: 100
    }).on("restart", () => {
        console.log(` `);
        console.log(` - - - - - - - - - - - - `);
        console.log(` `);
    });
}

// Exports
exports.start = start;
exports.dev = dev;