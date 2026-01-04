import { input, textarea } from "dkh-ui";
const pty = require("node-pty") as typeof import("node-pty");

const ptyProcess = pty.spawn("ls", ["-al"], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env,
});

ptyProcess.onData((data) => {
    console.log(data);
});

const inp = input().addInto();
const outp = textarea().addInto();
