import { initDKH, input, textarea, txt, view } from "dkh-ui";
const path = require("node:path") as typeof import("node:path");
const pty = require("node-pty") as typeof import("node-pty");
const process = require("node:process") as typeof import("node:process");

class Page {
    env: Record<string, string> = {};
    cwd: string = process.env.HOME || "";

    data: { startTime: number; finishTime: number; startCommand: string; outputRender: string }[] = [];

    mainEl = view();
    historyEl = view("y").addInto(this.mainEl);
    inputCommandEl = input().addInto(this.mainEl);
    constructor() {
        this.inputCommandEl.on("change", () => {
            const command = this.inputCommandEl.gv;
            this.inputCommandEl.sv("");
            this.inputCommandEl.attr({ disabled: true });

            const historyEl = view("y");
            txt(`$ ${command}`).addInto(historyEl);
            const outputEl = textarea().attr({ readOnly: true }).addInto(historyEl);

            historyEl.addInto(this.historyEl);

            const finish = () => {
                this.inputCommandEl.attr({ disabled: false });
                this.inputCommandEl.el.focus();
            };

            const com = command.split(" ");
            if (com.length === 0) {
                finish();
                return;
            }

            if (com[0] === "cd") {
                if (com.length > 1) {
                    const newPath = path.resolve(this.cwd, com[1]);
                    // todo check if path exists
                    this.cwd = newPath;
                } else {
                    this.cwd = process.env.HOME || "";
                }
                finish();
                return;
            }

            console.log("run", com, this.cwd, this.env);

            const ptyProcess = pty.spawn(com[0], com.slice(1), {
                name: "xterm-color",
                cols: 80,
                rows: 30,
                cwd: this.cwd,
                env: this.env,
            });

            ptyProcess.onData((data) => {
                outputEl.sv(outputEl.gv + data);
            });
            ptyProcess.onExit(() => {
                finish();
            });
        });
    }
}

initDKH({
    pureStyle: true,
});
const p1 = new Page();
p1.mainEl.addInto();
