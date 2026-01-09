import { button, initDKH, input, spacer, txt, view } from "dkh-ui";
import type { IPty } from "node-pty";
const path = require("node:path") as typeof import("node:path");
const fs = require("node:fs") as typeof import("node:fs");
const process = require("node:process") as typeof import("node:process");
const { sync: isexeSync } = require("isexe") as typeof import("isexe");
const pty = require("node-pty") as typeof import("node-pty");
const { Client } = require("ssh2") as typeof import("ssh2");
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { parseIn, parseIn2, type ShInputItem2 } from "./parser_in";
import { Render } from "./output_render";
import { pathMatchCursor } from "./path_match_cursor";

function tryX<T>(x: () => T): [T, null] | [null, Error] {
    try {
        return [x(), null];
    } catch (error) {
        return [null, error as Error];
    }
}

class Sh {
    private conn: import("ssh2").Client | undefined;
    init(op?: { host: string; port: number; username: string; privateKey: string }) {
        if (op) {
            this.conn = new Client();
            this.conn
                .on("ready", () => {
                    console.log("Client :: ready");
                })
                .connect({
                    host: op.host,
                    port: op.port,
                    username: op.username,
                    privateKey: op.privateKey,
                });
        }
    }
    run(
        command: string,
        args: string[],
        op: {
            cols: number;
            rows: number;
            cwd: string;
            env: Record<string, string>;
        },
    ): {
        onData: (cb: (data: string) => void) => void;
        onExit: (cb: () => void) => void;
        write: (data: string) => void;
    } & (
        | {
              type: "local";
              _local: IPty;
          }
        | {
              type: "ssh";
              _ssh: import("ssh2").Client;
          }
    ) {
        if (this.conn) {
            // ssh
            let dataCb = (_data: string) => {};
            let exitCb = () => {};
            let writeX = (_data: string) => {};
            // todo 验证执行
            this.conn?.exec(
                `${command} ${args.join(" ")}`,
                { env: op.env, pty: { cols: op.cols, rows: op.rows } },
                (err, stream) => {
                    if (err) throw err;
                    stream.on("data", (data) => {
                        dataCb(data.toString());
                    });
                    stream.on("close", () => {
                        exitCb();
                    });
                    writeX = (data: string) => {
                        stream.write(data);
                    };
                },
            );
            return {
                onData: (cb: (data: string) => void) => {
                    dataCb = cb;
                },
                onExit: (cb: () => void) => {
                    exitCb = cb;
                },
                write: (data: string) => {
                    writeX(data);
                },
                type: "ssh",
                _ssh: this.conn,
            };
        }
        // local
        const ptyProcess = pty.spawn(command, args, {
            name: "xterm-color",
            ...op,
        });
        return {
            onData: (cb: (data: string) => void) => {
                ptyProcess.onData((data) => {
                    // todo parse ANSI escape codes
                    // todo 数据有时不完整
                    // https://github.com/microsoft/node-pty/issues/72
                    // https://github.com/microsoft/node-pty/issues/85
                    cb(data);
                });
            },
            onExit: (cb: () => void) => {
                ptyProcess.onExit(() => {
                    cb();
                });
            },
            write: (data: string) => {
                ptyProcess.write(data);
            },
            type: "local",
            _local: ptyProcess,
        };
    }
}

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
    private inputCommandElP = view()
        .style({ position: "relative" })
        .addInto(this.inputAreaEl)
        .bindSet((v: string) => {
            this.inputCommandEl.sv(v);
            this.inputCommandEl.el.dispatchEvent(new Event("input"));
        });
    private inputCommandStyleEl = view().style({ whiteSpace: "pre" }).addInto(this.inputCommandElP);
    private inputCommandEl = input()
        .style({
            position: "absolute",
            top: 0,
            color: "transparent",
            backgroundColor: "transparent",
            caretColor: "black",
        })
        .attr({ spellcheck: false })
        .addInto(this.inputCommandElP);
    private inputTipEl = view()
        // todo 虚拟滚动
        .style({ width: "300px", maxHeight: "300px", overflow: "scroll" })
        .addInto(this.inputAreaEl);
    constructor(op: { inputPrompt?: string; sh: Sh }) {
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
                            return this.inputCommandElP;
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

        type InputTip = { show?: string; x: string; des: string }[];

        let tipController: ReturnType<typeof showInputTip> | null = null;
        let tipX: ReturnType<typeof getTip> | null = null;

        const showInputTip = (list: InputTip) => {
            let show = true;
            let index = 0;
            let cbSelect: (selected: string) => void = () => {};
            const ll = list.map((i) => {
                const el = view("x").add([i.show ?? i.x, spacer(), txt(i.des).style({ color: "#888" })]);
                el.on("click", () => {
                    cbSelect(i.x);
                    this.inputTipEl.clear();
                });
                return { ...i, el };
            });
            this.inputTipEl.clear().add(ll.map((i) => i.el));

            return {
                up: () => {
                    if (index > 0) index--;
                    if (index === 0) index = ll.length - 1;
                },
                down: () => {
                    if (index < ll.length - 1) index++;
                    else index = 0;
                },
                select: () => {
                    if (!show) return;
                    cbSelect(ll[index].x);
                    this.inputTipEl.clear();
                },
                clear: () => {
                    show = false;
                    this.inputTipEl.clear();
                },
                onSelect: (cb: (selected: string) => void) => {
                    cbSelect = cb;
                },
            };
        };

        const getTip = (
            input: string,
            cursorStart: number,
            cursorEnd: number,
        ): { list: InputTip; pre: string; last: string } => {
            const res: InputTip = [];

            const parse = parseIn2(parseIn(input));
            const pos = Math.min(cursorStart, cursorEnd);

            let matchIndex = -1;
            let matchParseItem: ShInputItem2 | undefined = undefined;
            const matchParseList = parse; // todo 处理嵌套

            for (const [i, item] of parse.entries()) {
                if (item.start <= pos && item.end >= pos) {
                    matchIndex = i;
                    matchParseItem = item;
                    if (item.type !== "blank") break;
                }
            }

            if (matchIndex === -1 || !matchParseItem) {
                console.log(input, parse, pos);
                throw new Error("No matching parse item found");
            }

            const curPosStart = matchParseItem.type === "blank" ? matchParseItem.end : matchParseItem.start;
            const curPosEnd = matchParseItem.end;
            const pre = input.slice(0, curPosStart);
            const last = input.slice(curPosEnd);
            const cur = input.slice(curPosStart, curPosEnd);
            const curValue = matchParseItem.value;

            console.log({ pre, cur, curValue, last, matchParseItem, parse });

            if (matchParseItem.type === "main" || !matchParseList.find((i) => i.type === "main")) {
                if (curValue) {
                    if (curValue.startsWith(".") || path.isAbsolute(curValue)) {
                        // is path
                        const { basePath, focusPart, p } = pathMatchCursor(
                            curValue,
                            cursorStart - curPosStart,
                            this.cwd,
                        );
                        const [dir] = tryX(() => fs.readdirSync(p)); // todo 如果是文件呢
                        for (const file of dir ?? []) {
                            if (!file.startsWith(focusPart)) continue; // todo 模糊
                            const nFile = file.replaceAll(" ", "\\ ").replaceAll("'", "\\'").replaceAll('"', '\\"');
                            const [stat] = tryX(() => fs.statSync(path.join(p, file)));
                            const nPath = curValue ? path.join(basePath, nFile) : nFile;
                            if (!stat) {
                                res.push({ show: file, x: nPath, des: "error" });
                            } else if (stat.isDirectory()) {
                                res.push({ show: file, x: nPath + path.sep, des: "dir" });
                            } else {
                                if (isexeSync(path.join(p, file), { ignoreErrors: true })) {
                                    res.push({ show: file, x: nPath, des: "file" });
                                }
                            }
                        }
                    }
                }
                const l = this.allCommands();
                for (const cmd of l) {
                    if (cmd.startsWith(cur)) {
                        res.push({ x: cmd, des: "" });
                    }
                }
            } else {
                // is path
                if (
                    !matchParseItem.input.endsWith(path.sep) &&
                    matchParseItem.type === "arg" &&
                    !matchParseItem.chindren
                ) {
                    const [stat] = tryX(() => fs.statSync(path.isAbsolute(cur) ? cur : path.join(this.cwd, cur)));
                    if (stat?.isDirectory()) return { list: [{ x: `${cur}${path.sep}`, des: "" }], pre, last };
                }
                const { basePath, focusPart, p } = pathMatchCursor(cur, cursorStart - curPosStart, this.cwd);
                const [dir] = tryX(() => fs.readdirSync(p));
                for (const file of dir ?? []) {
                    if (!file.startsWith(focusPart)) continue; // todo 模糊
                    const nFile = file.replaceAll(" ", "\\ ").replaceAll("'", "\\'").replaceAll('"', '\\"');
                    const [stat] = tryX(() => fs.statSync(path.join(p, file)));
                    const nPath = cur ? path.join(basePath, nFile) : nFile;
                    if (!stat) {
                        res.push({ show: file, x: nPath, des: "error" });
                    } else if (stat.isDirectory()) {
                        res.push({ show: file, x: nPath, des: "dir" });
                    } else {
                        res.push({ show: file, x: nPath, des: "file" });
                    }
                }
            }
            return { list: res.slice(0, 500), pre, last };
        };

        const getInputStyle = (input: string) => {
            const parse = parseIn2(parseIn(input));
            console.log("input", parse);
            return parse.map((item) => {
                const color =
                    item.type === "main"
                        ? "#0f0"
                        : item.type === "arg"
                          ? "#000"
                          : item.type === "blank"
                            ? "#fff"
                            : "#fff";
                const bg = item.type === "arg" ? "#eee" : "transparent";
                return txt(item.input).style({
                    color,
                    backgroundColor: bg,
                });
            });
        };

        this.inputCommandEl.on("input", () => {
            this.inputCommandStyleEl.clear().add(getInputStyle(this.inputCommandEl.gv));
        });

        this.inputCommandEl.on("keydown", (e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                if (tipController) {
                    e.preventDefault();
                    if (e.key === "ArrowUp") {
                        tipController.up();
                    } else {
                        tipController.down();
                    }
                }
            }
            if (e.key === "Tab") {
                e.preventDefault();
                tipX = getTip(
                    this.inputCommandEl.gv,
                    this.inputCommandEl.el.selectionStart || 0,
                    this.inputCommandEl.el.selectionEnd || 0,
                );
                const { list, pre, last } = tipX;
                if (list.length === 0) {
                    return;
                }
                if (list.length === 1) {
                    this.inputCommandElP.sv(pre + list[0].x + last);
                    return;
                }
                tipController = showInputTip(list);
                tipController.onSelect((selected) => {
                    if (tipX) {
                        const { pre, last } = tipX;
                        this.inputCommandElP.sv(pre + selected + last);
                        tipX = null;

                        this.inputCommandEl.el.focus();
                    }
                });
            }
            if (e.key === "Enter") {
                if (tipController && tipX) {
                    e.preventDefault();
                    tipController.select();
                    tipController = null;
                } else {
                    e.preventDefault();
                    commit();
                }
            }
            if (e.key === "Escape") {
                if (tipController && tipX) {
                    e.preventDefault();
                    tipController.clear();
                    tipController = null;
                    tipX = null;
                }
            }
        });

        const commit = () => {
            const command = this.inputCommandEl.gv;
            this.inputCommandElP.sv("");
            this.inputCommandEl.attr({ disabled: true });

            let rawT = "";

            const historyEl = view("y");
            const bar = view("x").addInto(historyEl);
            txt("$ ")
                .add(getInputStyle(command))
                .style({ position: "sticky", top: 0, zIndex: 1, backgroundColor: "#fff" })
                .addInto(bar);
            bar.add(spacer());
            let _term: Terminal | undefined;
            button("xterm")
                .addInto(bar)
                .on("click", () => {
                    const term = new Terminal({
                        fontFamily: "'FiraCode Nerd Font Mono'",
                        theme: {
                            background: "#fff",
                            foreground: "#000",
                            selectionBackground: "#00a",
                        },
                        rows: 30,
                        cols: 80,
                    });
                    _term = term;
                    let selection = "";
                    term.onKey(({ domEvent }) => {
                        if (domEvent.key === "c" && domEvent.ctrlKey) {
                            const select = term.getSelection();
                            selection = select;
                        }
                    });
                    term.onData((data) => {
                        console.log(JSON.stringify(data).slice(1, -1));
                        if (data === "\x03") {
                            const select = selection;
                            if (select.length > 0) {
                                navigator.clipboard.writeText(select);
                            } else {
                                shProcess.write(data);
                            }
                            return;
                        }
                        if (data === "\x16") {
                            navigator.clipboard.readText().then((text) => {
                                shProcess.write(text);
                            });
                            return;
                        }
                        shProcess.write(data);
                    });
                    const termEl = view().addInto(outputEl);
                    term.open(termEl.el);
                    term.write(rawT);
                    console.log(JSON.stringify(rawT).slice(1, -1));
                });

            const outputEl = view().addInto(historyEl);
            const term = new Render();
            term.setSize(30, 80);
            term.onData((data) => {
                shProcess.write(data);
            });
            term.el.style({ maxHeight: "80vh", overflowY: "scroll" });
            outputEl.add(term.el);

            historyEl.addInto(this.historyEl);

            const com = parseIn(command)
                .filter((i) => i.type !== "blank")
                .map((i) => i.value);
            if (com.length === 0) {
                finish();
                return;
            }

            const finish2 = () => {
                dataItem.finishTime = Date.now();
                dataItem.outputRender = rawT; // todo
                finish();
            };

            const dataItem: (typeof this.data)[0] = {
                startTime: Date.now(),
                finishTime: 0,
                startCommand: command,
                outputRender: "",
            };

            if (com[0] === "cd") {
                // todo 更标准的处理
                if (com.length > 1) {
                    const newPath = path.resolve(this.cwd, com[1]);
                    const [s] = tryX(() => fs.statSync(newPath));
                    if (!s || !s.isDirectory()) {
                        term.write(`cd: no such directory: ${com[1]}\n`);
                        finish2();
                        return;
                    }
                    this.cwd = newPath;
                } else {
                    this.cwd = process.env.HOME || "";
                }
                finish2();
                return;
            }

            if (!this.allCommands().has(com[0])) {
                let canRun = false;
                if (path.isAbsolute(com[0]) || com[0].startsWith("./") || com[0].startsWith("../")) {
                    const pathx = path.isAbsolute(com[0]) ? com[0] : path.join(this.cwd, com[0]);
                    const s = isexeSync(pathx, { ignoreErrors: true });
                    if (s) canRun = true;
                }
                if (!canRun) {
                    term.write(`Command not found: ${com[0]}\n`);
                    finish2();
                    return;
                }
            }

            console.log("run", com, this.cwd, this.env);

            const sh = op.sh;

            const shProcess = sh.run(com[0], com.slice(1), {
                cols: 80,
                rows: 30,
                cwd: this.cwd,
                env: this.env,
            });

            shProcess.onData((data) => {
                rawT += data;
                term.write(data);
                if (_term) _term.write(data);
            });
            shProcess.onExit(() => {
                finish2();
            });
        };

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
    sh: new Sh(),
});
p1.mainEl
    .style({
        fontFamily: "'FiraCode Nerd Font Mono'",
    })
    .addInto();
