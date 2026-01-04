import { initDKH, input, spacer, textarea, txt, view } from "dkh-ui";
const path = require("node:path") as typeof import("node:path");
const fs = require("node:fs") as typeof import("node:fs");
const pty = require("node-pty") as typeof import("node-pty");
const process = require("node:process") as typeof import("node:process");

class Page {
    env: Record<string, string> = { ...process.env } as Record<string, string>;
    cwd: string = process.env.HOME || "";

    data: { startTime: number; finishTime: number; startCommand: string; outputRender: string }[] = [];

    bin = new Set<string>();
    innerCommand = new Set<string>(["cd"]);

    private inputPromptSymbol = { cursor: Symbol("cursor"), spacer: Symbol("spacer"), cwd: Symbol("cwd") };
    private inputPrompt: (string | symbol)[][] = [];

    mainEl = view();
    historyEl = view("y").addInto(this.mainEl);
    private inputAreaEl = view().addInto(this.mainEl);
    private inputPromptEl = view().addInto(this.inputAreaEl);
    private inputCommandEl = input().addInto(this.inputAreaEl);
    constructor(op?: { inputPrompt?: string }) {
        const finish = () => {
            const binDir = new Set(["/bin", "/usr/bin", "/usr/local/bin"]);
            for (const dir of process.env.PATH?.split(":") || []) binDir.add(dir);
            this.bin.clear();
            for (const dir of binDir) {
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        this.bin.add(file);
                    }
                } catch {
                    // ignore
                }
            }

            const promptRendered = this.inputPrompt.map((l) => {
                return l
                    .map((i) => {
                        if (i === this.inputPromptSymbol.cursor) {
                            return this.inputCommandEl;
                        }
                        if (i === this.inputPromptSymbol.spacer) {
                            return spacer();
                        }
                        if (i === this.inputPromptSymbol.cwd) {
                            return this.cwd;
                        }
                        return i;
                    })
                    .filter((i) => typeof i !== "symbol");
            });

            this.inputPromptEl.clear().add(promptRendered.map((l) => view("x").add(l)));

            this.inputCommandEl.attr({ disabled: false });
            this.inputCommandEl.el.focus();
        };

        this.inputCommandEl.on("change", () => {
            const command = this.inputCommandEl.gv;
            this.inputCommandEl.sv("");
            this.inputCommandEl.attr({ disabled: true });

            const historyEl = view("y");
            txt(`$ ${command}`).addInto(historyEl);
            const outputEl = textarea().attr({ readOnly: true }).addInto(historyEl);

            historyEl.addInto(this.historyEl);

            const com = command.split(" ");
            if (com.length === 0) {
                finish();
                return;
            }

            const finish2 = () => {
                dataItem.finishTime = Date.now();
                dataItem.outputRender = outputEl.gv;
                finish();
            };

            const dataItem: (typeof this.data)[0] = {
                startTime: Date.now(),
                finishTime: 0,
                startCommand: command,
                outputRender: "",
            };

            if (com[0] === "cd") {
                if (com.length > 1) {
                    const newPath = path.resolve(this.cwd, com[1]);
                    // todo check if path exists
                    this.cwd = newPath;
                } else {
                    this.cwd = process.env.HOME || "";
                }
                finish2();
                return;
            }

            if (!this.allCommands().has(com[0])) {
                outputEl.sv(`Command not found: ${com[0]}\n`);
                finish2();
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
                // todo parse ANSI escape codes
                // todo 数据有时不完整
                // https://github.com/microsoft/node-pty/issues/72
                // https://github.com/microsoft/node-pty/issues/85
                outputEl.sv(outputEl.gv + data);
            });
            ptyProcess.onExit(() => {
                finish2();
            });
        });

        if (op?.inputPrompt) {
            this.setInputPrompt(op.inputPrompt);
        }
        finish();
    }

    private allCommands() {
        return this.innerCommand.union(this.bin);
    }

    setInputPrompt(prompt: string) {
        const promptRendered = prompt.split("\n").map((line) => {
            const xsymbol = this.inputPromptSymbol;
            // todo 解析，转义
            const l: (string | (typeof xsymbol)[keyof typeof xsymbol])[] = [""];
            xx: for (let i = 0; i < line.length; ) {
                for (const [k, v] of Object.entries(xsymbol)) {
                    if (line.startsWith(`\${${k}}`, i)) {
                        l.push(v);
                        i += `\${${k}}`.length;
                        continue xx;
                    }
                }
                if (typeof l.at(-1) === "symbol") {
                    l.push("");
                }
                l[l.length - 1] = (l[l.length - 1] as string) + line[i];
                i += 1;
            }
            return l;
        });
        if (promptRendered.flat().find((i) => i === this.inputPromptSymbol.cursor) === undefined) {
            this.inputPrompt = [[this.inputPromptSymbol.cursor]];
        } else this.inputPrompt = promptRendered;
    }
}

initDKH({
    pureStyle: true,
});
const p1 = new Page({
    inputPrompt: "<${cwd}${spacer}>\n$ ${cursor}",
});
p1.mainEl
    .style({
        fontFamily: "'FiraCode Nerd Font Mono'",
    })
    .addInto();
